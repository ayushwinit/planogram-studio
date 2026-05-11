"use client";
import { toast } from "sonner";
import { useEditorStore } from "../store/editorStore";
import { useCatalogStore, toEditorProduct } from "../store/catalogStore";
import { savePlanogram, requestPlanogramPreviewUpload } from "../planograms/actions";
import { buildExport } from "./buildExport";
import { captureStagePng } from "./exportImage";
import { buildPdf } from "./exportPdf";
import { downloadBlob, downloadDataUrl, nameSlug, tsSlug } from "./downloadFiles";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

function getPlanogram() {
  return useEditorStore.getState().planogram;
}

function getCatalog() {
  const s = useCatalogStore.getState();
  return { products: s.products.map(toEditorProduct) };
}

/** Persist the current editor state to the database. Captures a PNG of the
 *  outer shelf + uploads it as the preview. Resolves with the new slug so
 *  callers can update the URL if the planogram name changed.
 *
 *  Returns null on failure (toast is already shown). */
export async function saveToCloud(): Promise<{ planogramSlug: string; tenantSlug: string } | null> {
  const state = useEditorStore.getState();
  if (!state.planogramId) {
    toast.error("This planogram is not bound to a saved row.");
    return null;
  }
  if (!state.customerName.trim()) {
    toast.error("Customer / Mart is required before saving.");
    return null;
  }
  if (!state.planogram.name.trim()) {
    toast.error("Planogram name is required.");
    return null;
  }

  // Capture the PNG and upload it directly to S3 via a presigned PUT.
  // Both steps are best-effort: a failure here must not block the save,
  // and the row keeps its previous preview (or none).
  let previewCode: string | undefined;
  if (state.planogram.shelves.length > 0) {
    try {
      const dataUrl = await captureStagePng();
      const blob = await dataUrlToBlob(dataUrl);
      const presign = await requestPlanogramPreviewUpload();
      if (!presign.ok) throw new Error(presign.error);
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      if (!put.ok) throw new Error(`S3 PUT failed: ${put.status}`);
      previewCode = presign.code;
    } catch (err) {
      console.warn("preview capture/upload failed", err);
    }
  }

  const fd = new FormData();
  fd.set("planogramId", state.planogramId);
  fd.set("planogramName", state.planogram.name);
  fd.set("customerName", state.customerName);
  fd.set("planogramData", JSON.stringify(state.planogram));
  if (previewCode) fd.set("previewCode", previewCode);

  const res = await savePlanogram(fd);
  if (!res.ok) {
    toast.error(res.error);
    return null;
  }
  useEditorStore.getState().markSaved(res.planogram.updatedAt, res.planogram.planogramSlug);
  toast.success("Saved", {
    description: `${res.planogram.shelvesCount} shelves · ${res.planogram.placementsCount} placements · ${res.planogram.unitsCount} units.`,
  });
  return {
    planogramSlug: res.planogram.planogramSlug,
    tenantSlug: res.planogram.tenantSlug,
  };
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
