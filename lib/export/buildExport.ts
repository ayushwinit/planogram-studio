import type { Planogram, PlanogramExport, Product, ResolvedPlacement } from "../types";
import { arrangementMetrics } from "../arrangement";
import { BASE_PX_PER_MM } from "../units";
import { rowTopOffsetMm, shelfTotalHeightMm } from "../shelfGeometry";
import { computeCanvasSizeMm } from "../canvasBounds";

export function buildExport(
  planogram: Planogram,
  catalog: { products: Product[] },
  imageBase64?: string
): PlanogramExport {
  const productById = new Map(catalog.products.map((p) => [p.id, p]));
  const shelfById = new Map(planogram.shelves.map((s) => [s.id, s]));

  const resolvedPlacements: ResolvedPlacement[] = [];
  for (const p of planogram.placements) {
    const product = productById.get(p.productId);
    const shelf = shelfById.get(p.shelfId);
    if (!product || !shelf) continue;
    const metrics = arrangementMetrics(product, p.arrangement);

    // Compute absolute Y of the placement's TOP edge in canvas mm.
    let bottomYMm: number;
    if (p.rowId === "top") {
      bottomYMm = shelf.yMm + shelf.topAreaMm - p.yMm;
    } else {
      const row = shelf.rows.find((r) => r.id === p.rowId);
      if (!row) continue;
      const topOffset = rowTopOffsetMm(shelf, row.id);
      bottomYMm = shelf.yMm + topOffset + row.heightMm - p.yMm;
    }
    const topYMm = bottomYMm - metrics.totalHeightMm;
    const absoluteXMm = shelf.xMm + p.xMm;

    resolvedPlacements.push({
      ...p,
      product,
      absoluteXMm,
      absoluteYMm: topYMm,
      boundingBoxMm: {
        x: absoluteXMm,
        y: topYMm,
        w: metrics.totalWidthMm,
        h: metrics.totalHeightMm,
      },
      totalUnits: metrics.totalUnits,
    });
  }

  // Use the dynamically-derived bounds for the export so PDF aspect ratios
  // and downstream consumers reflect the actual content area.
  const { widthMm, heightMm } = computeCanvasSizeMm(planogram);
  const planogramWithDerived: Planogram = {
    ...planogram,
    canvasWidthMm: widthMm,
    canvasHeightMm: heightMm,
    shelves: planogram.shelves.map((s) => ({ ...s })),
  };
  void shelfTotalHeightMm;

  return {
    ...planogramWithDerived,
    resolvedPlacements,
    exportedAt: new Date().toISOString(),
    pixelsPerMm: BASE_PX_PER_MM,
    imageBase64,
  };
}
