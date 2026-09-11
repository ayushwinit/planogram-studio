import type { Arrangement, Product } from "./types";

export interface ArrangementMetrics {
  totalUnits: number;
  cols: number;
  rows: number;
  cellWidthMm: number;
  cellHeightMm: number;
  totalWidthMm: number;
  totalHeightMm: number;
}

export function arrangementMetrics(product: Product, arrangement: Arrangement): ArrangementMetrics {
  const w = product.widthMm;
  const h = product.heightMm;
  const gap = arrangement.gapMm ?? 0;

  if (arrangement.kind === "horizontal") {
    const n = Math.max(1, arrangement.count);
    return {
      totalUnits: n,
      cols: n,
      rows: 1,
      cellWidthMm: w,
      cellHeightMm: h,
      totalWidthMm: n * w + (n - 1) * gap,
      totalHeightMm: h,
    };
  }
  if (arrangement.kind === "stacked") {
    const n = Math.max(1, arrangement.count);
    return {
      totalUnits: n,
      cols: 1,
      rows: n,
      cellWidthMm: w,
      cellHeightMm: h,
      totalWidthMm: w,
      totalHeightMm: n * h + (n - 1) * gap,
    };
  }
  // grid
  const cols = Math.max(1, arrangement.cols);
  const rows = Math.max(1, arrangement.rows);
  return {
    totalUnits: cols * rows,
    cols,
    rows,
    cellWidthMm: w,
    cellHeightMm: h,
    totalWidthMm: cols * w + (cols - 1) * gap,
    totalHeightMm: rows * h + (rows - 1) * gap,
  };
}

/** Upper bound on facings in a single placement. Mirrors the Quantity input's
 *  cap in RightPanel/PlacementProperties, so a typed count can never exceed
 *  what the user is then able to edit back down. */
export const MAX_FACINGS = 50;

/** Gap between the facings of one placement. */
const DEFAULT_GAP_MM = 2;

export function defaultArrangement(): Arrangement {
  // One facing. The user grows it from the right panel once it's on the shelf.
  return { kind: "horizontal", count: 1, gapMm: DEFAULT_GAP_MM };
}

/** One placement holding `count` facings side by side — what a repeated product
 *  name (or an explicit `NAME x4`) in the shelf builder collapses to, so the
 *  saved JSON carries one entry per SKU run instead of one entry per facing. */
export function facingsArrangement(count: number): Arrangement {
  const n = Math.min(MAX_FACINGS, Math.max(1, Math.floor(count)));
  return { kind: "horizontal", count: n, gapMm: DEFAULT_GAP_MM };
}
