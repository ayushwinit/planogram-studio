import { jsPDF } from "jspdf";
import type { PlanogramExport } from "../types";

export function buildPdf(planogram: PlanogramExport, imageDataUrl: string): Blob {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Page 1: Title + image
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(planogram.name, margin, margin + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text(
    `Generated ${new Date(planogram.exportedAt).toLocaleString()}  ·  ${planogram.shelves.length} shelves  ·  ${planogram.resolvedPlacements.length} placements`,
    margin,
    margin + 9
  );
  pdf.setTextColor(0);

  // Image — fit within remaining page area while preserving aspect
  const imgY = margin + 14;
  const availW = pageW - margin * 2;
  const availH = pageH - imgY - margin;
  const aspect = planogram.canvasWidthMm / planogram.canvasHeightMm;
  let imgW = availW;
  let imgH = imgW / aspect;
  if (imgH > availH) {
    imgH = availH;
    imgW = imgH * aspect;
  }
  const imgX = (pageW - imgW) / 2;
  try {
    pdf.addImage(imageDataUrl, "PNG", imgX, imgY, imgW, imgH, undefined, "FAST");
  } catch {
    pdf.text("(Image failed to render)", margin, imgY + 10);
  }

  // Page 2: Placement table
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Placements", margin, margin + 4);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");

  const headers = [
    "#",
    "Main Brand",
    "Sub Brand",
    "Product",
    "UOM",
    "Shelf",
    "Qty",
    "Arrangement",
    "X (mm)",
    "Y (mm)",
    "W×H (mm)",
  ];
  const colX = [
    margin,
    margin + 8,
    margin + 33,
    margin + 58,
    margin + 102,
    margin + 116,
    margin + 136,
    margin + 145,
    margin + 185,
    margin + 205,
    margin + 225,
  ];
  let y = margin + 12;
  pdf.setFont("helvetica", "bold");
  headers.forEach((h, i) => pdf.text(h, colX[i], y));
  pdf.setLineWidth(0.2);
  pdf.line(margin, y + 1.5, pageW - margin, y + 1.5);
  pdf.setFont("helvetica", "normal");
  y += 6;

  planogram.resolvedPlacements.forEach((p, idx) => {
    if (y > pageH - margin) {
      pdf.addPage();
      y = margin + 6;
    }
    const arr = p.arrangement;
    const arrStr =
      arr.kind === "horizontal"
        ? `H ×${arr.count}`
        : arr.kind === "stacked"
        ? `Stack ×${arr.count}`
        : `Grid ${arr.cols}×${arr.rows}`;
    // The user-facing "Shelf 1/2/3" labels live on the inner row, not the
    // outer shelf unit — so we look up the row by rowId. Top-area placements
    // get their own label, and as a last resort we fall back to a 1-based
    // index from the row's `index` field (never the raw nanoid).
    const shelf = planogram.shelves.find((s) => s.id === p.shelfId);
    let shelfLabel: string;
    if (p.rowId === "top") {
      shelfLabel = "Top area";
    } else {
      const row = shelf?.rows.find((r) => r.id === p.rowId);
      shelfLabel = row?.label ?? `Shelf ${(row?.index ?? 0) + 1}`;
    }
    pdf.text(String(idx + 1), colX[0], y);
    pdf.text(truncate(p.product.mainBrand ?? "—", 12), colX[1], y);
    pdf.text(truncate(p.product.subBrand ?? "—", 12), colX[2], y);
    pdf.text(truncate(p.product.name, 22), colX[3], y);
    pdf.text(truncate(p.product.uom ?? "—", 6), colX[4], y);
    pdf.text(truncate(shelfLabel, 11), colX[5], y);
    pdf.text(String(p.totalUnits), colX[6], y);
    pdf.text(arrStr, colX[7], y);
    pdf.text(String(Math.round(p.absoluteXMm)), colX[8], y);
    pdf.text(String(Math.round(p.absoluteYMm)), colX[9], y);
    pdf.text(`${Math.round(p.boundingBoxMm.w)}×${Math.round(p.boundingBoxMm.h)}`, colX[10], y);
    y += 5;
  });

  return pdf.output("blob");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
