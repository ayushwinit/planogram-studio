"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth/dal";
import { newImageCode, uploadProductImage, deleteProductImage } from "@/lib/s3";
import type { CatalogActionResult, ItemDimensions, TenantProduct } from "./types";

type Row = {
  product_id: string;
  tenant_id: string;
  category: string;
  main_brand: string | null;
  brand: string | null;
  item_code: string | null;
  barcode: string | null;
  item_description: string;
  uom: string | null;
  item_image_url: string | null;
  item_dimensions: ItemDimensions | null;
  created_at: Date;
  updated_at: Date;
};

function rowToProduct(r: Row): TenantProduct {
  return {
    productId: r.product_id,
    tenantId: r.tenant_id,
    category: r.category,
    mainBrand: r.main_brand,
    subBrand: r.brand,
    itemCode: r.item_code,
    barcode: r.barcode,
    itemDescription: r.item_description,
    uom: r.uom,
    itemImageUrl: r.item_image_url,
    itemDimensions: r.item_dimensions,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

const DimensionsSchema = z
  .object({
    widthMm: z.number().positive().finite(),
    heightMm: z.number().positive().finite(),
    depthMm: z.number().positive().finite().optional(),
  })
  .strict();

const BaseFieldsSchema = z.object({
  category: z.string().trim().min(1, { error: "Category is required." }),
  mainBrand: z.string().trim().min(1, { error: "Brand is required." }),
  subBrand: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  itemCode: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  barcode: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  itemDescription: z.string().trim().min(1, { error: "Item description is required." }),
  uom: z
    .string()
    .trim()
    .min(1, { error: "UOM is required." })
    .max(60),
  itemDimensions: DimensionsSchema.nullable().optional(),
});

function parseDimensionsField(raw: FormDataEntryValue | null): ItemDimensions | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const obj = JSON.parse(s);
    const parsed = DimensionsSchema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function flattenFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

async function uploadImageFromForm(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is larger than 5MB.");
  }
  const code = newImageCode();
  const buf = Buffer.from(await file.arrayBuffer());
  await uploadProductImage(code, buf, file.type);
  return code;
}

export async function listTenantProducts(): Promise<TenantProduct[]> {
  const session = await requireSession();
  const result = await db.query<Row>(
    `SELECT product_id, tenant_id, category, main_brand, brand, item_code, barcode,
            item_description, uom, item_image_url, item_dimensions,
            created_at, updated_at
       FROM tenant_products
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
    [session.tenantId],
  );
  return result.rows.map(rowToProduct);
}

export async function createTenantProduct(formData: FormData): Promise<CatalogActionResult> {
  const session = await requireSession();

  const parsed = BaseFieldsSchema.safeParse({
    category: formData.get("category"),
    mainBrand: formData.get("mainBrand"),
    subBrand: formData.get("subBrand") ?? undefined,
    itemCode: formData.get("itemCode") ?? undefined,
    barcode: formData.get("barcode") ?? undefined,
    itemDescription: formData.get("itemDescription"),
    uom: formData.get("uom"),
    itemDimensions: parseDimensionsField(formData.get("itemDimensions")),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input.", fieldErrors: flattenFieldErrors(parsed.error) };
  }

  let imageCode: string | null = null;
  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageCode = await uploadImageFromForm(imageFile);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  const dims = parsed.data.itemDimensions ?? null;

  try {
    const result = await db.query<Row>(
      `INSERT INTO tenant_products
         (tenant_id, category, main_brand, brand, item_code, barcode,
          item_description, uom, item_image_url, item_dimensions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING product_id, tenant_id, category, main_brand, brand, item_code, barcode,
                 item_description, uom, item_image_url, item_dimensions,
                 created_at, updated_at`,
      [
        session.tenantId,
        parsed.data.category,
        parsed.data.mainBrand,
        parsed.data.subBrand,
        parsed.data.itemCode,
        parsed.data.barcode,
        parsed.data.itemDescription,
        parsed.data.uom,
        imageCode,
        dims ? JSON.stringify(dims) : null,
      ],
    );
    return { ok: true, product: rowToProduct(result.rows[0]) };
  } catch (err) {
    if (imageCode) await deleteProductImage(imageCode);
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateTenantProduct(
  productId: string,
  formData: FormData,
): Promise<CatalogActionResult> {
  const session = await requireSession();

  const existingResult = await db.query<{ item_image_url: string | null }>(
    `SELECT item_image_url FROM tenant_products
      WHERE product_id = $1 AND tenant_id = $2 LIMIT 1`,
    [productId, session.tenantId],
  );
  const existing = existingResult.rows[0];
  if (!existing) {
    return { ok: false, error: "Product not found." };
  }

  const parsed = BaseFieldsSchema.safeParse({
    category: formData.get("category"),
    mainBrand: formData.get("mainBrand"),
    subBrand: formData.get("subBrand") ?? undefined,
    itemCode: formData.get("itemCode") ?? undefined,
    barcode: formData.get("barcode") ?? undefined,
    itemDescription: formData.get("itemDescription"),
    uom: formData.get("uom"),
    itemDimensions: parseDimensionsField(formData.get("itemDimensions")),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input.", fieldErrors: flattenFieldErrors(parsed.error) };
  }

  // Image handling:
  //   - new file uploaded → replace and queue old code for deletion
  //   - imageRemoved=1 sent → drop existing image
  //   - otherwise → keep existing
  let nextImageCode: string | null = existing.item_image_url;
  let codeToDelete: string | null = null;
  const imageFile = formData.get("image");
  const imageRemoved = formData.get("imageRemoved") === "1";

  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const newCode = await uploadImageFromForm(imageFile);
      codeToDelete = existing.item_image_url;
      nextImageCode = newCode;
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  } else if (imageRemoved) {
    codeToDelete = existing.item_image_url;
    nextImageCode = null;
  }

  const dims = parsed.data.itemDimensions ?? null;

  try {
    const result = await db.query<Row>(
      `UPDATE tenant_products
          SET category = $1,
              main_brand = $2,
              brand = $3,
              item_code = $4,
              barcode = $5,
              item_description = $6,
              uom = $7,
              item_image_url = $8,
              item_dimensions = $9::jsonb,
              updated_at = now()
        WHERE product_id = $10 AND tenant_id = $11
        RETURNING product_id, tenant_id, category, main_brand, brand, item_code, barcode,
                  item_description, uom, item_image_url, item_dimensions,
                  created_at, updated_at`,
      [
        parsed.data.category,
        parsed.data.mainBrand,
        parsed.data.subBrand,
        parsed.data.itemCode,
        parsed.data.barcode,
        parsed.data.itemDescription,
        parsed.data.uom,
        nextImageCode,
        dims ? JSON.stringify(dims) : null,
        productId,
        session.tenantId,
      ],
    );
    if (codeToDelete) await deleteProductImage(codeToDelete);
    return { ok: true, product: rowToProduct(result.rows[0]) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteTenantProduct(productId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const result = await db.query<{ item_image_url: string | null }>(
    `DELETE FROM tenant_products
      WHERE product_id = $1 AND tenant_id = $2
      RETURNING item_image_url`,
    [productId, session.tenantId],
  );
  const row = result.rows[0];
  if (!row) return { ok: false, error: "Product not found." };
  if (row.item_image_url) await deleteProductImage(row.item_image_url);
  return { ok: true };
}
