import type { Planogram } from "@/lib/types";
import type { ItemDimensions } from "@/lib/catalog/types";

/** Per-placement entry inside `shelf_details`. Shape is optimised for
 *  downstream image-recognition / layout-analysis consumers — every value
 *  the model could care about is denormalised here. */
export interface ShelfDetailPlacement {
  instanceId: string;
  productId: string;
  /** 1-based ordinal within the row (left → right). */
  position: number;
  /** Top-left of the placement bounding box, in canvas mm. */
  absoluteXMm: number;
  absoluteYMm: number;
  boundingBoxMm: { x: number; y: number; w: number; h: number };
  /** Author-side coords inside the row. */
  xMm: number;
  yMm: number;
  rotationDeg: 0 | 90 | 180 | 270;
  scaleX: number;
  scaleY: number;
  /** Number of physical units the arrangement adds to the shelf. */
  totalUnits: number;
  arrangement:
    | { kind: "horizontal"; count: number; gapMm: number }
    | { kind: "stacked"; count: number; gapMm: number }
    | { kind: "grid"; cols: number; rows: number; gapMm: number };
  product: {
    id: string;
    sku: string | null;
    barcode: string | null;
    mainBrand: string | null;
    subBrand: string | null;
    category: string;
    description: string;
    uom: string | null;
    dimensions: ItemDimensions | null;
    /** S3 image code (resolve via /api/catalog/image/[code]). */
    imageCode: string | null;
  };
}

export interface ShelfDetailRow {
  rowId: string;
  index: number;
  /** Always populated. Defaults to `"Shelf N"` (1-based) when the editor's
   *  row.label slot is empty, so downstream consumers never see a bare id. */
  label: string;
  xMm: number;
  widthMm: number;
  heightMm: number;
  borderWidthPx: number;
  borderColor: string;
  backgroundColor: string;
  placements: ShelfDetailPlacement[];
}

export interface ShelfDetail {
  shelfId: string;
  index: number;
  label: string | null;
  xMm: number;
  yMm: number;
  widthMm: number;
  topAreaMm: number;
  totalHeightMm: number;
  borderWidthPx: number;
  borderColor: string;
  backgroundColor: string;
  rows: ShelfDetailRow[];
  /** Placements sitting on the top area of the shelf (rowId === "top"). */
  topPlacements: ShelfDetailPlacement[];
}

/** Snapshot of the planogram + tenant captured at save time, embedded in
 *  the `shelf_details` JSONB column for self-contained downstream consumers. */
export interface ShelfDetails {
  schemaVersion: 1;
  capturedAt: string;
  tenant: { id: string; name: string };
  planogram: {
    id: string;
    name: string;
    customerName: string;
    canvasWidthMm: number;
    canvasHeightMm: number;
  };
  shelves: ShelfDetail[];
}

/** Mirror of one row in the `planograms` table, camelCased for the client. */
export interface PlanogramRecord {
  planogramId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planogramName: string;
  planogramSlug: string;
  customerName: string;
  shelvesCount: number;
  rowsCount: number;
  productsCount: number;
  placementsCount: number;
  unitsCount: number;
  canvasWidthMm: number;
  canvasHeightMm: number;
  planogramData: Planogram;
  shelfDetails: ShelfDetails;
  previewImageUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight row for the Browse page — omits the heavy JSON columns. */
export interface PlanogramSummary {
  planogramId: string;
  tenantSlug: string;
  planogramName: string;
  planogramSlug: string;
  customerName: string;
  /** Folder this planogram lives in; null = root. */
  folderId: string | null;
  shelvesCount: number;
  productsCount: number;
  unitsCount: number;
  previewImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlanogramActionResult =
  | { ok: true; planogram: PlanogramRecord }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** A planogram with the requested name already exists somewhere in the tenant.
 *  The client uses this to offer "move it here" vs "replace it". */
export interface PlanogramNameConflict {
  planogramId: string;
  planogramName: string;
  planogramSlug: string;
  tenantSlug: string;
  folderId: string | null;
  /** Human-readable location, e.g. "Choithrams / RAINBOW" or "All planograms". */
  folderPath: string;
  /** True when the existing planogram already sits in the target folder — the
   *  only case where neither move nor replace makes sense as a silent fix. */
  sameFolder: boolean;
}

export type CreatePlanogramResult =
  | { ok: true; tenantSlug: string; planogramSlug: string; planogramId: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      conflict?: PlanogramNameConflict;
    };
