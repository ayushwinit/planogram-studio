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

export function defaultArrangement(): Arrangement {
  // One facing. The user grows it from the right panel once it's on the shelf.
  return { kind: "horizontal", count: 1, gapMm: 2 };
}
