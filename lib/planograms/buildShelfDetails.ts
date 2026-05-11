import type { Planogram, Product } from "@/lib/types";
import type { TenantProduct } from "@/lib/catalog/types";
import { arrangementMetrics } from "@/lib/arrangement";
import { rowTopOffsetMm, shelfTotalHeightMm } from "@/lib/shelfGeometry";
import type {
  ShelfDetail,
  ShelfDetailPlacement,
  ShelfDetailRow,
  ShelfDetails,
} from "./types";

const DEFAULT_DIM_MM = 100;

/** Minimal TenantProduct → Product projection for arrangement maths only.
 *  Mirrors `lib/store/catalogStore#toEditorProduct` but stays out of the
 *  client store to keep this builder usable server-side. */
function projectProduct(t: TenantProduct): Product {
  const dims = t.itemDimensions;
  return {
    id: t.productId,
    name: t.itemDescription,
    sku: t.itemCode,
    brand: t.brand,
    category: t.category,
    imageUrl: "", // unused by arrangement maths
    widthMm: dims?.widthMm ?? DEFAULT_DIM_MM,
    heightMm: dims?.heightMm ?? DEFAULT_DIM_MM,
  };
}

interface BuildArgs {
  planogram: Planogram;
  customerName: string;
  tenant: { id: string; name: string };
  /** Raw catalog rows, keyed for full attribute capture. */
  products: TenantProduct[];
}

interface Stats {
  shelvesCount: number;
  rowsCount: number;
  /** Distinct SKUs placed. */
  productsCount: number;
  placementsCount: number;
  unitsCount: number;
}

export function buildShelfDetailsAndStats(
  args: BuildArgs,
): { details: ShelfDetails; stats: Stats } {
  const productById = new Map(args.products.map((p) => [p.productId, p]));
  const shelves: ShelfDetail[] = [];
  const distinctProducts = new Set<string>();
  let placementsCount = 0;
  let unitsCount = 0;
  let rowsCount = 0;

  for (const shelf of args.planogram.shelves) {
    rowsCount += shelf.rows.length;

    // Inner shelves always end up with a user-readable label in the DB —
    // even if the row.label slot is empty for any reason, we default to the
    // 1-based "Shelf N" so downstream consumers never see a bare nanoid.
    const rows: ShelfDetailRow[] = shelf.rows.map((row) => ({
      rowId: row.id,
      index: row.index,
      label: row.label && row.label.trim().length > 0 ? row.label : `Shelf ${row.index + 1}`,
      xMm: row.xMm,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      borderWidthPx: row.borderWidthPx,
      borderColor: row.borderColor,
      backgroundColor: row.backgroundColor,
      placements: [],
    }));
    const topPlacements: ShelfDetailPlacement[] = [];

    const placementsForShelf = args.planogram.placements
      .filter((p) => p.shelfId === shelf.id)
      .sort((a, b) => a.xMm - b.xMm);

    for (const p of placementsForShelf) {
      const product = productById.get(p.productId);
      if (!product) continue;
      const metrics = arrangementMetrics(projectProduct(product), p.arrangement);

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

      const detail: ShelfDetailPlacement = {
        instanceId: p.instanceId,
        productId: p.productId,
        position: 0, // filled in below after grouping
        absoluteXMm,
        absoluteYMm: topYMm,
        boundingBoxMm: {
          x: absoluteXMm,
          y: topYMm,
          w: metrics.totalWidthMm,
          h: metrics.totalHeightMm,
        },
        xMm: p.xMm,
        yMm: p.yMm,
        rotationDeg: p.rotationDeg,
        scaleX: p.scaleX ?? p.scale ?? 1,
        scaleY: p.scaleY ?? p.scale ?? 1,
        totalUnits: metrics.totalUnits,
        arrangement: p.arrangement,
        product: {
          id: product.productId,
          sku: product.itemCode,
          barcode: product.barcode,
          brand: product.brand,
          category: product.category,
          description: product.itemDescription,
          uom: product.uom,
          dimensions: product.itemDimensions,
          imageCode: product.itemImageUrl,
        },
      };

      placementsCount += 1;
      unitsCount += metrics.totalUnits;
      distinctProducts.add(p.productId);

      if (p.rowId === "top") {
        topPlacements.push(detail);
      } else {
        const target = rows.find((r) => r.rowId === p.rowId);
        if (target) target.placements.push(detail);
      }
    }

    // Assign 1-based positions per row + top area (left-to-right).
    for (const row of rows) {
      row.placements.forEach((pl, i) => (pl.position = i + 1));
    }
    topPlacements.forEach((pl, i) => (pl.position = i + 1));

    shelves.push({
      shelfId: shelf.id,
      index: shelf.index,
      label: shelf.label ?? null,
      xMm: shelf.xMm,
      yMm: shelf.yMm,
      widthMm: shelf.widthMm,
      topAreaMm: shelf.topAreaMm,
      totalHeightMm: shelfTotalHeightMm(shelf),
      borderWidthPx: shelf.borderWidthPx,
      borderColor: shelf.borderColor,
      backgroundColor: shelf.backgroundColor,
      rows,
      topPlacements,
    });
  }

  const details: ShelfDetails = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    tenant: args.tenant,
    planogram: {
      id: args.planogram.id,
      name: args.planogram.name,
      customerName: args.customerName,
      canvasWidthMm: args.planogram.canvasWidthMm,
      canvasHeightMm: args.planogram.canvasHeightMm,
    },
    shelves,
  };

  return {
    details,
    stats: {
      shelvesCount: args.planogram.shelves.length,
      rowsCount,
      productsCount: distinctProducts.size,
      placementsCount,
      unitsCount,
    },
  };
}
