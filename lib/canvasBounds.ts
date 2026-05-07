import type { Planogram } from "./types";
import { shelfTotalHeightMm } from "./shelfGeometry";

/** Margin (in mm) around the rightmost/bottommost shelf so the canvas doesn't crowd. */
const PADDING_MM = 200;

/** Minimum canvas size — what you see when no shelves exist yet. */
const MIN_W_MM = 1000;
const MIN_H_MM = 600;

/**
 * Compute the canvas size dynamically from the shelves' bounding box.
 * The canvas grows as shelves are added/moved/resized — there is no fixed
 * upper limit on planogram size.
 */
export function computeCanvasSizeMm(planogram: Planogram): { widthMm: number; heightMm: number } {
  let maxRight = 0;
  let maxBottom = 0;
  for (const sh of planogram.shelves) {
    const right = sh.xMm + sh.widthMm;
    const bottom = sh.yMm + shelfTotalHeightMm(sh);
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return {
    widthMm: Math.max(MIN_W_MM, Math.ceil(maxRight + PADDING_MM)),
    heightMm: Math.max(MIN_H_MM, Math.ceil(maxBottom + PADDING_MM)),
  };
}
