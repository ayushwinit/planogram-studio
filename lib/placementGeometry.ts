import { arrangementMetrics } from "./arrangement";
import type { PlacedProduct, Product } from "./types";

export interface PlacementSize {
  widthMm: number;
  heightMm: number;
}

/** Real footprint of a placement on the shelf: the arrangement's block size
 *  multiplied by the placement's own scale. `scaleX`/`scaleY` fall back to the
 *  legacy uniform `scale` so pre-split placements still measure correctly. */
export function placementSize(
  product: Product,
  p: Pick<PlacedProduct, "arrangement" | "scaleX" | "scaleY" | "scale">,
): PlacementSize {
  const m = arrangementMetrics(product, p.arrangement);
  const sx = p.scaleX ?? p.scale ?? 1;
  const sy = p.scaleY ?? p.scale ?? 1;
  return { widthMm: m.totalWidthMm * sx, heightMm: m.totalHeightMm * sy };
}

export interface SizedPlacement {
  placement: PlacedProduct;
  size: PlacementSize;
}

/** Height (mm above the row floor) at which something dropped at `xMm` should
 *  come to rest: either the floor, or the top of a placement already sitting
 *  under that point. The candidate nearest the raw drop height wins, so a low
 *  drop lands on the shelf and a high one lands on the product below — and
 *  nothing is ever left floating in mid-air.
 *
 *  `xMm` is the left edge of the incoming item. Its own width is unknown while
 *  a new product is still in the place-modal, so support is decided by that one
 *  point rather than by rectangle overlap. */
export function restingYMm(xMm: number, rawYMm: number, siblings: SizedPlacement[]): number {
  const tops = siblings
    .filter((s) => xMm >= s.placement.xMm && xMm <= s.placement.xMm + s.size.widthMm)
    .map((s) => s.placement.yMm + s.size.heightMm);

  let best = 0;
  let bestGap = Math.abs(rawYMm);
  for (const top of tops) {
    const gap = Math.abs(rawYMm - top);
    if (gap < bestGap) {
      best = top;
      bestGap = gap;
    }
  }
  return best;
}
