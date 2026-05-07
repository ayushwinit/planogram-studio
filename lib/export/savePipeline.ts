"use client";
import { toast } from "sonner";
import { useEditorStore } from "../store/editorStore";
import { useCatalogStore } from "../store/catalogStore";
import { buildExport } from "./buildExport";
import { captureStagePng } from "./exportImage";
import { buildPdf } from "./exportPdf";
import { downloadBlob, downloadDataUrl, nameSlug, tsSlug } from "./downloadFiles";

function getPlanogram() {
  return useEditorStore.getState().planogram;
}

function getCatalog() {
  const s = useCatalogStore.getState();
  return { products: s.products, brands: s.brands };
}

export async function exportJson() {
  try {
    const planogram = getPlanogram();
    const data = buildExport(planogram, getCatalog());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, `planogram-${nameSlug(planogram.name)}-${tsSlug()}.json`);
    toast.success("JSON exported", { description: `${data.resolvedPlacements.length} placements written.` });
  } catch (e) {
    console.error(e);
    toast.error("Failed to export JSON", { description: String(e) });
  }
}

export async function exportPng() {
  try {
    const planogram = getPlanogram();
    const dataUrl = await captureStagePng();
    downloadDataUrl(dataUrl, `planogram-${nameSlug(planogram.name)}-${tsSlug()}.png`);
    toast.success("PNG exported");
  } catch (e) {
    console.error(e);
    toast.error("Failed to export PNG", { description: String(e) });
  }
}

export async function exportPdf() {
  try {
    const planogram = getPlanogram();
    const data = buildExport(planogram, getCatalog());
    const dataUrl = await captureStagePng();
    const blob = buildPdf({ ...data, imageBase64: dataUrl }, dataUrl);
    downloadBlob(blob, `planogram-${nameSlug(planogram.name)}-${tsSlug()}.pdf`);
    toast.success("PDF exported");
  } catch (e) {
    console.error(e);
    toast.error("Failed to export PDF", { description: String(e) });
  }
}

export async function saveAll() {
  try {
    const planogram = getPlanogram();
    const dataUrl = await captureStagePng();
    const data = buildExport(planogram, getCatalog(), dataUrl);

    // JSON
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const stamp = tsSlug();
    const slug = nameSlug(planogram.name);
    downloadBlob(jsonBlob, `planogram-${slug}-${stamp}.json`);

    // PNG
    downloadDataUrl(dataUrl, `planogram-${slug}-${stamp}.png`);

    // PDF
    const pdfBlob = buildPdf(data, dataUrl);
    downloadBlob(pdfBlob, `planogram-${slug}-${stamp}.pdf`);

    toast.success("Saved 3 files", {
      description: `${data.shelves.length} shelves, ${data.resolvedPlacements.length} placements, ${data.resolvedPlacements.reduce((a, p) => a + p.totalUnits, 0)} units.`,
    });
  } catch (e) {
    console.error(e);
    toast.error("Save failed", { description: String(e) });
  }
}
