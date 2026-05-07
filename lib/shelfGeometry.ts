import type { Shelf, ShelfRow } from "./types";

export function shelfTotalHeightMm(shelf: Shelf): number {
  return shelf.topAreaMm + shelf.rows.reduce((acc, r) => acc + r.heightMm, 0);
}

/** Returns the y offset (in mm, from shelf top) where a row STARTS (its top edge). */
export function rowTopOffsetMm(shelf: Shelf, rowId: string): number {
  let offset = shelf.topAreaMm;
  for (const r of shelf.rows) {
    if (r.id === rowId) return offset;
    offset += r.heightMm;
  }
  return offset;
}

export function findRow(shelf: Shelf, rowId: string): ShelfRow | undefined {
  return shelf.rows.find((r) => r.id === rowId);
}
