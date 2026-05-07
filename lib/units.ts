export const BASE_PX_PER_MM = 1.5;

export function pxPerMm(zoom: number): number {
  return BASE_PX_PER_MM * zoom;
}

export function mmToPx(mm: number, zoom: number): number {
  return mm * pxPerMm(zoom);
}

export function pxToMm(px: number, zoom: number): number {
  return px / pxPerMm(zoom);
}
