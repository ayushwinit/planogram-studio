import { domToPng } from "modern-screenshot";
import { useEditorStore } from "@/lib/store/editorStore";
import { computeCanvasSizeMm } from "@/lib/canvasBounds";
import { mmToPx } from "@/lib/units";

/**
 * Capture the canvas as PNG. The world wrapper (#planogram-stage) is normally
 * transparent and pan/zoom-translated; for the duration of the capture we pin
 * its size to the content bounding box, reset the transform, and paint a white
 * background so modern-screenshot sees a proper region.
 */
export async function captureStagePng(): Promise<string> {
  const stage = document.getElementById("planogram-stage");
  if (!stage) throw new Error("Stage element not found");

  const { planogram, zoom } = useEditorStore.getState();
  const { widthMm, heightMm } = computeCanvasSizeMm(planogram);
  const widthPx = mmToPx(widthMm, zoom);
  const heightPx = mmToPx(heightMm, zoom);

  const orig = {
    transform: stage.style.transform,
    width: stage.style.width,
    height: stage.style.height,
    backgroundColor: stage.style.backgroundColor,
  };

  stage.setAttribute("data-exporting", "true");
  stage.style.transform = "none";
  stage.style.width = `${widthPx}px`;
  stage.style.height = `${heightPx}px`;
  stage.style.backgroundColor = "#ffffff";

  try {
    const dataUrl = await domToPng(stage, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    return dataUrl;
  } finally {
    stage.style.transform = orig.transform;
    stage.style.width = orig.width;
    stage.style.height = orig.height;
    stage.style.backgroundColor = orig.backgroundColor;
    stage.removeAttribute("data-exporting");
  }
}
