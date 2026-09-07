"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth/dal";
import { deletePlanogramPreview } from "@/lib/s3";
import type {
  FolderActionResult,
  FolderCrumb,
  FolderDeleteResult,
  FolderSummary,
} from "./types";

const NameSchema = z
  .string()
  .trim()
  .min(1, { error: "Folder name is required." })
  .max(120, { error: "Folder name is too long (max 120)." });

const IdSchema = z.uuid();

function flattenZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

/** Normalise the `?folder=` query value: anything that is not a uuid is root. */
export async function parseFolderId(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  return IdSchema.safeParse(raw).success ? raw : null;
}

type FolderRow = {
  folder_id: string;
  parent_folder_id: string | null;
  folder_name: string;
  subfolder_count: string | number;
  planogram_count: string | number;
  created_at: Date | string;
  updated_at: Date | string;
};

/** Direct children of `parentId` (null = root), with per-folder child counts. */
export async function listFolderChildren(
  parentId: string | null,
): Promise<FolderSummary[]> {
  const session = await requireSession();
  const result = await db.query<FolderRow>(
    `SELECT f.folder_id,
            f.parent_folder_id,
            f.folder_name,
            (SELECT count(*) FROM planogram_folders c
              WHERE c.parent_folder_id = f.folder_id)          AS subfolder_count,
            (SELECT count(*) FROM planograms p
              WHERE p.folder_id = f.folder_id)                 AS planogram_count,
            f.created_at,
            f.updated_at
       FROM planogram_folders f
      WHERE f.tenant_id = $1
        AND f.parent_folder_id IS NOT DISTINCT FROM $2
      ORDER BY lower(f.folder_name) ASC`,
    [session.tenantId, parentId],
  );
  return result.rows.map((r) => ({
    folderId: r.folder_id,
    parentFolderId: r.parent_folder_id,
    folderName: r.folder_name,
    subfolderCount: Number(r.subfolder_count),
    planogramCount: Number(r.planogram_count),
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  }));
}

/** Root → folder path. Empty array for the root view or an unknown folder. */
export async function getFolderBreadcrumb(folderId: string | null): Promise<FolderCrumb[]> {
  if (!folderId) return [];
  const session = await requireSession();
  const result = await db.query<{ folder_id: string; folder_name: string; depth: number }>(
    `WITH RECURSIVE trail AS (
       SELECT folder_id, parent_folder_id, folder_name, 0 AS depth
         FROM planogram_folders
        WHERE folder_id = $1 AND tenant_id = $2
       UNION ALL
       SELECT f.folder_id, f.parent_folder_id, f.folder_name, t.depth + 1
         FROM planogram_folders f
         JOIN trail t ON f.folder_id = t.parent_folder_id
        WHERE f.tenant_id = $2
     )
     SELECT folder_id, folder_name, depth FROM trail ORDER BY depth DESC`,
    [folderId, session.tenantId],
  );
  return result.rows.map((r) => ({ folderId: r.folder_id, folderName: r.folder_name }));
}

export async function createFolder(formData: FormData): Promise<FolderActionResult> {
  const session = await requireSession();

  const parsed = z
    .object({ folderName: NameSchema, parentFolderId: IdSchema.nullable() })
    .safeParse({
      folderName: formData.get("folderName"),
      parentFolderId: (formData.get("parentFolderId") as string) || null,
    });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input.", fieldErrors: flattenZod(parsed.error) };
  }

  // A parent must belong to the caller's tenant, else this is cross-tenant poking.
  if (parsed.data.parentFolderId) {
    const parent = await db.query(
      `SELECT 1 FROM planogram_folders WHERE folder_id = $1 AND tenant_id = $2 LIMIT 1`,
      [parsed.data.parentFolderId, session.tenantId],
    );
    if (parent.rows.length === 0) return { ok: false, error: "Parent folder not found." };
  }

  try {
    const result = await db.query<{ folder_id: string }>(
      `INSERT INTO planogram_folders (tenant_id, parent_folder_id, folder_name, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING folder_id`,
      [session.tenantId, parsed.data.parentFolderId, parsed.data.folderName, session.userId],
    );
    return { ok: true, folderId: result.rows[0].folder_id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "A folder with that name already exists here.",
        fieldErrors: { folderName: "Name already in use." },
      };
    }
    return { ok: false, error: (err as Error).message };
  }
}

export async function renameFolder(
  folderId: string,
  folderName: string,
): Promise<FolderActionResult> {
  const session = await requireSession();
  const parsed = z
    .object({ folderId: IdSchema, folderName: NameSchema })
    .safeParse({ folderId, folderName });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input.", fieldErrors: flattenZod(parsed.error) };
  }

  try {
    const result = await db.query<{ folder_id: string }>(
      `UPDATE planogram_folders
          SET folder_name = $1, updated_at = now()
        WHERE folder_id = $2 AND tenant_id = $3
        RETURNING folder_id`,
      [parsed.data.folderName, parsed.data.folderId, session.tenantId],
    );
    if (result.rows.length === 0) return { ok: false, error: "Folder not found." };
    return { ok: true, folderId: result.rows[0].folder_id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "A folder with that name already exists here.",
        fieldErrors: { folderName: "Name already in use." },
      };
    }
    return { ok: false, error: (err as Error).message };
  }
}

/** Recursive subtree of `folderId`, including itself. Tenant-scoped. */
const SUBTREE_CTE = `
  WITH RECURSIVE subtree AS (
    SELECT folder_id FROM planogram_folders
     WHERE folder_id = $1 AND tenant_id = $2
    UNION ALL
    SELECT f.folder_id FROM planogram_folders f
      JOIN subtree s ON f.parent_folder_id = s.folder_id
     WHERE f.tenant_id = $2
  )`;

/** What a cascade delete would take with it — used to warn in the confirm dialog. */
export async function countFolderContents(
  folderId: string,
): Promise<{ folders: number; planograms: number }> {
  const session = await requireSession();
  const result = await db.query<{ folders: string; planograms: string }>(
    `${SUBTREE_CTE}
     SELECT (SELECT count(*) FROM subtree) - 1                              AS folders,
            (SELECT count(*) FROM planograms
              WHERE folder_id IN (SELECT folder_id FROM subtree))           AS planograms`,
    [folderId, session.tenantId],
  );
  const row = result.rows[0];
  return { folders: Math.max(0, Number(row?.folders ?? 0)), planograms: Number(row?.planograms ?? 0) };
}

/**
 * Delete a folder and everything under it. The DB cascades rows, but S3 preview
 * objects have no such cascade — so we collect their codes first and clean them
 * up after the delete commits.
 */
export async function deleteFolder(folderId: string): Promise<FolderDeleteResult> {
  const session = await requireSession();
  if (!IdSchema.safeParse(folderId).success) {
    return { ok: false, error: "Invalid folder id." };
  }

  const doomed = await db.query<{ folder_id: string }>(
    `${SUBTREE_CTE} SELECT folder_id FROM subtree`,
    [folderId, session.tenantId],
  );
  if (doomed.rows.length === 0) return { ok: false, error: "Folder not found." };
  const folderIds = doomed.rows.map((r) => r.folder_id);

  const previews = await db.query<{ preview_image_url: string | null }>(
    `SELECT preview_image_url FROM planograms
      WHERE tenant_id = $1 AND folder_id = ANY($2::uuid[])`,
    [session.tenantId, folderIds],
  );

  await db.query(`DELETE FROM planogram_folders WHERE folder_id = $1 AND tenant_id = $2`, [
    folderId,
    session.tenantId,
  ]);

  for (const row of previews.rows) {
    if (row.preview_image_url) await deletePlanogramPreview(row.preview_image_url);
  }

  return {
    ok: true,
    deletedFolders: folderIds.length,
    deletedPlanograms: previews.rowCount ?? previews.rows.length,
  };
}
