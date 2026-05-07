import type { Brand, Planogram, PlanogramExport, Product, ResolvedPlacement } from "../types";
import { arrangementMetrics } from "../arrangement";
import { BASE_PX_PER_MM } from "../units";
import { rowTopOffsetMm, shelfTotalHeightMm } from "../shelfGeometry";

export function buildExport(
  planogram: Planogram,
  catalog: { products: Product[]; brands: Brand[] },
  imageBase64?: string
): PlanogramExport {
  const productById = new Map(catalog.products.map((p) => [p.id, p]));
  const brandById = new Map(catalog.brands.map((b) => [b.id, b]));
  const shelfById = new Map(planogram.shelves.map((s) => [s.id, s]));

  const resolvedPlacements: ResolvedPlacement[] = [];
  for (const p of planogram.placements) {
    const product = productById.get(p.productId);
    const shelf = shelfById.get(p.shelfId);
    if (!product || !shelf) continue;
    const brand = brandById.get(product.brandId);
    if (!brand) continue;
    const metrics = arrangementMetrics(product, p.arrangement);

    // Compute absolute Y of the placement's TOP edge in canvas mm.
    // - In a row: the row's bottom = shelf.yMm + (rowTopOffset + row.heightMm).
    //   The placement's bottom sits at row.bottom - p.yMm; its top = bottom - placement.height.
    // - On the top area: placements sit at shelf.yMm + topAreaMm - p.yMm (bottom),
    //   so top = bottom - placement.height.
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
      brand,
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

  // Compute total shelf heights for the consumer's convenience (not stored on Shelf).
  const planogramWithDerived: Planogram = {
    ...planogram,
    shelves: planogram.shelves.map((s) => ({ ...s })),
  };
  void shelfTotalHeightMm; // keep import; consumers can compute from rows

  return {
    ...planogramWithDerived,
    resolvedPlacements,
    exportedAt: new Date().toISOString(),
    pixelsPerMm: BASE_PX_PER_MM,
    imageBase64,
  };
}
