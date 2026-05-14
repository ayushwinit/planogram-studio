"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, getCurrentTenant } from "@/lib/auth/dal";
import { listTenantProducts } from "@/lib/catalog/actions";
import {
  newImageCode,
  presignedPlanogramPreviewUploadUrl,
  deletePlanogramPreview,
} from "@/lib/s3";
import type { Planogram } from "@/lib/types";
import { planogramSlug, tenantSlug as makeTenantSlug } from "./slug";
import { buildShelfDetailsAndStats } from "./buildShelfDetails";
import type {
  CreatePlanogramResult,
  PlanogramActionResult,
  PlanogramRecord,
  PlanogramSummary,
  ShelfDetails,
} from "./types";

type Row = {
  planogram_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  planogram_name: string;
  planogram_slug: string;
  customer_name: string;
  shelves_count: number;
  rows_count: number;
  products_count: number;
  placements_count: number;
  units_count: number;
  canvas_width_mm: string | number;
  canvas_height_mm: string | number;
  planogram_data: Planogram;
  shelf_details: ShelfDetails;
  preview_image_url: string | null;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type SummaryRow = Pick<
  Row,
  | "planogram_id"
  | "tenant_slug"
  | "planogram_name"
  | "planogram_slug"
  | "customer_name"
  | "shelves_count"
  | "products_count"
  | "units_count"
  | "preview_image_url"
  | "created_at"
  | "updated_at"
>;

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

function rowToRecord(r: Row): PlanogramRecord {
  return {
    planogramId: r.planogram_id,
    tenantId: r.tenant_id,
    tenantName: r.tenant_name,
    tenantSlug: r.tenant_slug,
    planogramName: r.planogram_name,
    planogramSlug: r.planogram_slug,
    customerName: r.customer_name,
    shelvesCount: r.shelves_count,
    rowsCount: r.rows_count,
    productsCount: r.products_count,
    placementsCount: r.placements_count,
    unitsCount: r.units_count,
    canvasWidthMm: toNumber(r.canvas_width_mm),
    canvasHeightMm: toNumber(r.canvas_height_mm),
    planogramData: r.planogram_data,
    shelfDetails: r.shelf_details,
    previewImageUrl: r.preview_image_url,
    createdBy: r.created_by,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function rowToSummary(r: SummaryRow): PlanogramSummary {
  return {
    planogramId: r.planogram_id,
    tenantSlug: r.tenant_slug,
    planogramName: r.planogram_name,
    planogramSlug: r.planogram_slug,
    customerName: r.customer_name,
    shelvesCount: r.shelves_count,
    productsCount: r.products_count,
    unitsCount: r.units_count,
    previewImageUrl: r.preview_image_url,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

const FULL_COLUMNS = `planogram_id, tenant_id, tenant_name, tenant_slug,
  planogram_name, planogram_slug, customer_name,
  shelves_count, rows_count, products_count, placements_count, units_count,
  canvas_width_mm, canvas_height_mm,
  planogram_data, shelf_details, preview_image_url,
  created_by, created_at, updated_at`;

const SUMMARY_COLUMNS = `planogram_id, tenant_slug, planogram_name, planogram_slug,
  customer_name, shelves_count, products_count, units_count,
  preview_image_url, created_at, updated_at`;

const NameSchema = z
  .string()
  .trim()
  .min(2, { error: "Planogram name must be at least 2 characters." })
  .max(120, { error: "Planogram name is too long (max 120)." });

const CustomerSchema = z
  .string()
  .trim()
  .min(1, { error: "Customer / Mart is required." })
  .max(120, { error: "Customer / Mart is too long (max 120)." });

const CreateInputSchema = z.object({
  planogramName: NameSchema,
  customerName: CustomerSchema,
});

function isUniqueViolation(err: unknown, indexName: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505" &&
    "constraint" in err &&
    typeof (err as { constraint?: string }).constraint === "string" &&
    (err as { constraint: string }).constraint === indexName
  );
}

function flattenZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Stub planogram (no shelves yet) used as the initial DB row. */
function emptyPlanogramData(name: string): Planogram {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    canvasWidthMm: 1200,
    canvasHeightMm: 800,
    shelves: [],
    placements: [],
    meta: { version: 1 },
  };
}

export async function createPlanogram(formData: FormData): Promise<CreatePlanogramResult> {
  const session = await requireSession();
  const tenant = await getCurrentTenant();

  const parsed = CreateInputSchema.safeParse({
    planogramName: formData.get("planogramName"),
    customerName: formData.get("customerName"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input.", fieldErrors: flattenZod(parsed.error) };
  }

  const tSlug = makeTenantSlug(tenant.tenantName);
  const pSlug = planogramSlug(parsed.data.planogramName);
  const stub = emptyPlanogramData(parsed.data.planogramName);
  const empty: ShelfDetails = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    tenant: { id: tenant.tenantId, name: tenant.tenantName },
    planogram: {
      id: stub.id,
      name: parsed.data.planogramName,
      customerName: parsed.data.customerName,
      canvasWidthMm: stub.canvasWidthMm,
      canvasHeightMm: stub.canvasHeightMm,
    },
    shelves: [],
  };

  try {
    const result = await db.query<{ planogram_id: string; planogram_slug: string }>(
      `INSERT INTO planograms
         (tenant_id, tenant_name, tenant_slug, planogram_name, planogram_slug,
          customer_name, planogram_data, shelf_details, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
       RETURNING planogram_id, planogram_slug`,
      [
        tenant.tenantId,
        tenant.tenantName,
        tSlug,
        parsed.data.planogramName,
        pSlug,
        parsed.data.customerName,
        JSON.stringify(stub),
        JSON.stringify(empty),
        session.userId,
      ],
    );
    const row = result.rows[0];
    return {
      ok: true,
      tenantSlug: tSlug,
      planogramSlug: row.planogram_slug,
      planogramId: row.planogram_id,
    };
  } catch (err) {
    if (isUniqueViolation(err, "planograms_tenant_name_key")) {
      return {
        ok: false,
        error: "A planogram with this name already exists for your account.",
        fieldErrors: { planogramName: "Name already in use." },
      };
    }
    if (isUniqueViolation(err, "planograms_tenant_slug_key")) {
      return {
        ok: false,
        error: "A planogram with a similar name already exists. Try a more distinctive name.",
        fieldErrors: { planogramName: "Slug collides with an existing planogram." },
      };
    }
    return { ok: false, error: (err as Error).message };
  }
}

const PreviewCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{6,32}$/, { error: "Invalid preview code." });

const SaveSchema = z.object({
  planogramId: z.uuid(),
  planogramName: NameSchema,
  customerName: CustomerSchema,
  planogramData: z.string().min(2),
  /** S3 object code for the preview PNG the client already uploaded via
   *  the presigned URL from requestPlanogramPreviewUpload. Omitted when
   *  the client did not capture a preview. */
  previewCode: PreviewCodeSchema.optional(),
});

/** Issue a presigned PUT URL the client can use to upload a preview PNG
 *  directly to S3, bypassing the Server Action body size limit. The
 *  returned code is what the client passes back in savePlanogram. */
export async function requestPlanogramPreviewUpload(): Promise<
  { ok: true; code: string; uploadUrl: string } | { ok: false; error: string }
> {
  try {
    await requireSession();
    const code = newImageCode();
    const uploadUrl = await presignedPlanogramPreviewUploadUrl(code, "image/png");
    return { ok: true, code, uploadUrl };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function savePlanogram(formData: FormData): Promise<PlanogramActionResult> {
  const session = await requireSession();
  const tenant = await getCurrentTenant();

  const parsed = SaveSchema.safeParse({
    planogramId: formData.get("planogramId"),
    planogramName: formData.get("planogramName"),
    customerName: formData.get("customerName"),
    planogramData: formData.get("planogramData"),
    previewCode: formData.get("previewCode") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input.", fieldErrors: flattenZod(parsed.error) };
  }

  let planogram: Planogram;
  try {
    planogram = JSON.parse(parsed.data.planogramData) as Planogram;
  } catch {
    return { ok: false, error: "Could not parse planogram data." };
  }

  // Authorize: row must exist and belong to caller's tenant.
  const existingResult = await db.query<{ preview_image_url: string | null }>(
    `SELECT preview_image_url FROM planograms
      WHERE planogram_id = $1 AND tenant_id = $2 LIMIT 1`,
    [parsed.data.planogramId, tenant.tenantId],
  );
  if (existingResult.rows.length === 0) {
    return { ok: false, error: "Planogram not found." };
  }
  const oldPreviewCode = existingResult.rows[0].preview_image_url;

  // Need full product attributes for the recognition snapshot.
  const products = await listTenantProducts();
  const { details, stats } = buildShelfDetailsAndStats({
    planogram,
    customerName: parsed.data.customerName,
    tenant: { id: tenant.tenantId, name: tenant.tenantName },
    products,
  });

  // Client uploaded a new preview directly to S3 — swap codes and schedule
  // the old object for cleanup. No new code = keep the existing preview.
  let previewCode: string | null = oldPreviewCode;
  let codeToDelete: string | null = null;
  if (parsed.data.previewCode) {
    codeToDelete = oldPreviewCode;
    previewCode = parsed.data.previewCode;
  }

  const newSlug = planogramSlug(parsed.data.planogramName);
  const tSlug = makeTenantSlug(tenant.tenantName);

  try {
    const result = await db.query<Row>(
      `UPDATE planograms
          SET planogram_name   = $1,
              planogram_slug   = $2,
              customer_name    = $3,
              tenant_slug      = $4,
              tenant_name      = $5,
              shelves_count    = $6,
              rows_count       = $7,
              products_count   = $8,
              placements_count = $9,
              units_count      = $10,
              canvas_width_mm  = $11,
              canvas_height_mm = $12,
              planogram_data   = $13::jsonb,
              shelf_details    = $14::jsonb,
              preview_image_url = $15,
              updated_at       = now()
        WHERE planogram_id = $16 AND tenant_id = $17
        RETURNING ${FULL_COLUMNS}`,
      [
        parsed.data.planogramName,
        newSlug,
        parsed.data.customerName,
        tSlug,
        tenant.tenantName,
        stats.shelvesCount,
        stats.rowsCount,
        stats.productsCount,
        stats.placementsCount,
        stats.unitsCount,
        planogram.canvasWidthMm,
        planogram.canvasHeightMm,
        JSON.stringify(planogram),
        JSON.stringify(details),
        previewCode,
        parsed.data.planogramId,
        tenant.tenantId,
      ],
    );
    if (codeToDelete && codeToDelete !== previewCode) {
      await deletePlanogramPreview(codeToDelete);
    }
    void session;
    return { ok: true, planogram: rowToRecord(result.rows[0]) };
  } catch (err) {
    if (isUniqueViolation(err, "planograms_tenant_name_key")) {
      return {
        ok: false,
        error: "A planogram with this name already exists for your account.",
        fieldErrors: { planogramName: "Name already in use." },
      };
    }
    if (isUniqueViolation(err, "planograms_tenant_slug_key")) {
      return {
        ok: false,
        error: "Another planogram already uses this URL slug. Try a more distinctive name.",
        fieldErrors: { planogramName: "Slug collides with an existing planogram." },
      };
    }
    return { ok: false, error: (err as Error).message };
  }
}

export interface PlanogramListFilters {
  /** Free-text query, matched against planogram_name OR customer_name (ILIKE). */
  q?: string;
  /** Exact-match filter on customer_name (driven by the Customer dropdown,
   *  which is populated from existing values). */
  customer?: string;
  /** Match only planograms containing at least one placement whose product has
   *  the given main brand (DB column `main_brand`, surfaced as `mainBrand` in
   *  the shelf_details snapshot — older snapshots used the legacy `brand` key,
   *  which the filter also covers). */
  mainBrand?: string;
  /** Same idea for sub-brand. */
  subBrand?: string;
}

function escapeLikeSpecials(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listPlanograms(
  filters: PlanogramListFilters = {},
): Promise<PlanogramSummary[]> {
  const session = await requireSession();

  const where: string[] = ["tenant_id = $1"];
  const params: unknown[] = [session.tenantId];

  if (filters.q?.trim()) {
    const like = `%${escapeLikeSpecials(filters.q.trim())}%`;
    params.push(like);
    const idx = params.length;
    where.push(`(planogram_name ILIKE $${idx} OR customer_name ILIKE $${idx})`);
  }

  if (filters.customer?.trim()) {
    params.push(filters.customer.trim());
    where.push(`customer_name = $${params.length}`);
  }

  // Brand filters use Postgres' jsonpath EXISTS — `$.**.product` walks every
  // descendant `product` object in shelf_details (covering rows + topPlacements)
  // and the predicate matches when the brand field equals the requested value.
  // The brand value is passed via jsonpath vars to dodge SQL/JSONPath injection.
  //
  // The sub-brand predicate also accepts the legacy `.brand` key so snapshots
  // saved before the brand/sub-brand split (where the only field was `brand`)
  // surface in the Sub brand filter — that legacy value is treated as
  // sub-brand data per the user's intent.
  if (filters.mainBrand?.trim()) {
    params.push(JSON.stringify({ val: filters.mainBrand.trim() }));
    where.push(
      `jsonb_path_exists(shelf_details, '$.**.product ? (@.mainBrand == $val)', $${params.length}::jsonb)`,
    );
  }
  if (filters.subBrand?.trim()) {
    params.push(JSON.stringify({ val: filters.subBrand.trim() }));
    where.push(
      `jsonb_path_exists(shelf_details, '$.**.product ? (@.subBrand == $val || @.brand == $val)', $${params.length}::jsonb)`,
    );
  }

  const result = await db.query<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS}
       FROM planograms
      WHERE ${where.join(" AND ")}
      ORDER BY updated_at DESC`,
    params,
  );
  return result.rows.map(rowToSummary);
}

export async function listPlanogramCustomers(): Promise<string[]> {
  const session = await requireSession();
  const result = await db.query<{ customer_name: string }>(
    `SELECT DISTINCT customer_name
       FROM planograms
      WHERE tenant_id = $1 AND customer_name <> ''
      ORDER BY customer_name`,
    [session.tenantId],
  );
  return result.rows.map((r) => r.customer_name);
}

export async function listPlanogramBrands(): Promise<{
  mainBrands: string[];
  subBrands: string[];
}> {
  const session = await requireSession();
  // Flatten every product object across every planogram for this tenant via
  // jsonpath, then aggregate distinct brand / subBrand values. Cheap enough
  // for the tenant-scoped row count we expect; if it grows, swap for a
  // denormalised brand-array column maintained on save.
  const result = await db.query<{ main_brand: string | null; sub_brand: string | null }>(
    // Legacy snapshots (pre brand/sub-brand split) only have a `brand` key
    // which holds what is now treated as sub-brand data — so the Sub brand
    // dropdown falls back to that legacy key, while Main brand looks only at
    // the explicit `mainBrand` field that newer snapshots carry.
    `SELECT DISTINCT
            product->>'mainBrand'                              AS main_brand,
            COALESCE(product->>'subBrand', product->>'brand') AS sub_brand
       FROM planograms p,
            LATERAL jsonb_path_query(p.shelf_details, '$.**.product') AS product
      WHERE p.tenant_id = $1`,
    [session.tenantId],
  );

  const mains = new Set<string>();
  const subs = new Set<string>();
  for (const row of result.rows) {
    if (row.main_brand) mains.add(row.main_brand);
    if (row.sub_brand) subs.add(row.sub_brand);
  }
  return {
    mainBrands: Array.from(mains).sort((a, b) => a.localeCompare(b)),
    subBrands: Array.from(subs).sort((a, b) => a.localeCompare(b)),
  };
}

export async function getPlanogramBySlug(
  expectedTenantSlug: string,
  slug: string,
): Promise<PlanogramRecord | null> {
  const session = await requireSession();
  const tenant = await getCurrentTenant();
  // The URL tenant slug must match the caller's session tenant. We could also
  // look up by tenant_slug column, but anchoring to the session avoids a class
  // of cross-tenant URL-poking attacks.
  if (makeTenantSlug(tenant.tenantName) !== expectedTenantSlug) return null;

  const result = await db.query<Row>(
    `SELECT ${FULL_COLUMNS}
       FROM planograms
      WHERE tenant_id = $1 AND planogram_slug = $2
      LIMIT 1`,
    [session.tenantId, slug],
  );
  if (result.rows.length === 0) return null;
  return rowToRecord(result.rows[0]);
}

export async function deletePlanogram(
  planogramId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const result = await db.query<{ preview_image_url: string | null }>(
    `DELETE FROM planograms
      WHERE planogram_id = $1 AND tenant_id = $2
      RETURNING preview_image_url`,
    [planogramId, session.tenantId],
  );
  if (result.rows.length === 0) {
    return { ok: false, error: "Planogram not found." };
  }
  const code = result.rows[0].preview_image_url;
  if (code) await deletePlanogramPreview(code);
  return { ok: true };
}
