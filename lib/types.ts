/**
 * Product shape consumed by the editor (canvas / placements / arrangement maths).
 * It is derived from a `TenantProduct` row by `lib/store/catalogStore.ts`.
 */
export interface Product {
  id: string;
  name: string;
  sku: string | null;
  brand: string;
  category: string;
  imageUrl: string;
  widthMm: number;
  heightMm: number;
}

export type ArrangementKind = "horizontal" | "stacked" | "grid";

export type Arrangement =
  | { kind: "horizontal"; count: number; gapMm: number }
  | { kind: "stacked"; count: number; gapMm: number }
  | { kind: "grid"; cols: number; rows: number; gapMm: number };

export type RowSlot = string | "top"; // "top" = placement on the top area of the shelf

export interface PlacedProduct {
  instanceId: string;
  productId: string;
  shelfId: string;
  rowId: RowSlot;
  xMm: number; // X within the row (left edge = 0)
  yMm: number; // Y offset from the row's bottom (0 = sitting on the row floor)
  arrangement: Arrangement;
  rotationDeg: 0 | 90 | 180 | 270;
  /** Independent horizontal scale (default 1). Driven by E/W edge handles
   *  and the X axis of corner handles. */
  scaleX?: number;
  /** Independent vertical scale (default 1). Driven by N/S edge handles
   *  and the Y axis of corner handles. */
  scaleY?: number;
  /** Legacy uniform scale, kept for back-compat with previously stored
   *  placements; falls back when scaleX/scaleY are absent. */
  scale?: number;
  notes?: string;
}

export interface ShelfRow {
  id: string;
  index: number; // 0 = top row
  xMm: number; // horizontal offset within the shelf
  widthMm: number; // width of this row (can be less than shelf.widthMm)
  heightMm: number;
  borderWidthPx: number;
  borderColor: string;
  backgroundColor: string;
  label?: string;
}

export interface Shelf {
  id: string;
  index: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  topAreaMm: number; // height of the area on TOP of the shelf for placing products (0 = none)
  rows: ShelfRow[];
  borderWidthPx: number;
  borderColor: string;
  backgroundColor: string;
  label?: string;
}

export interface Planogram {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvasWidthMm: number;
  canvasHeightMm: number;
  shelves: Shelf[];
  placements: PlacedProduct[];
  meta: { storeId?: string; aisle?: string; version: number };
}

export interface ResolvedPlacement extends PlacedProduct {
  product: Product;
  absoluteXMm: number;
  absoluteYMm: number;
  boundingBoxMm: { x: number; y: number; w: number; h: number };
  totalUnits: number;
}

export interface PlanogramExport extends Planogram {
  resolvedPlacements: ResolvedPlacement[];
  exportedAt: string;
  pixelsPerMm: number;
  imageBase64?: string;
}

export type Selection =
  | { kind: "shelf"; id: string }
  | { kind: "row"; id: string; shelfId: string }
  | { kind: "placement"; id: string }
  | { kind: "none" };
