import { domToPng } from "modern-screenshot";

export async function captureStagePng(): Promise<string> {
  const stage = document.getElementById("planogram-stage");
  if (!stage) throw new Error("Stage element not found");

  // Hide editor-only chrome (selection rings, handles, labels) during capture
  stage.setAttribute("data-exporting", "true");
  try {
    const dataUrl = await domToPng(stage, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    return dataUrl;
  } finally {
    stage.removeAttribute("data-exporting");
  }
}
