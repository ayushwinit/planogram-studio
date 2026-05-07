export interface ItemDimensions {
  widthMm: number;
  heightMm: number;
  /** Front-to-back depth (mm). Optional for backwards-compat with rows
   *  written before depth was a tracked dimension. */
  depthMm?: number;
}

/** Mirror of one row in the `tenant_products` table, camelCased for the client. */
export interface TenantProduct {
  productId: string;
  tenantId: string;
  category: string;
  brand: string;
  itemCode: string | null;
  barcode: string | null;
  itemDescription: string;
  uom: string | null;
  /** Short ~10-char image code; resolve via /api/catalog/image/[code]. Null if no image uploaded. */
  itemImageUrl: string | null;
  itemDimensions: ItemDimensions | null;
  createdAt: string;
  updatedAt: string;
}

export type CatalogActionResult =
  | { ok: true; product: TenantProduct }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
