"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";

/** Dashed selection rectangle that follows the cursor during a shift-drag on
 *  the empty canvas. Pure visual — the actual hit-testing happens in
 *  Canvas.tsx when the pointer is released. */
export function MarqueeOverlay() {
  const m = useEditorStore((s) => s.marquee);
  if (!m) return null;
  const left = Math.min(m.startX, m.curX);
  const top = Math.min(m.startY, m.curY);
  const width = Math.abs(m.curX - m.startX);
  const height = Math.abs(m.curY - m.startY);
  if (width < 2 && height < 2) return null;
  return (
    <div
      className="absolute pointer-events-none rounded-sm"
      style={{
        left,
        top,
        width,
        height,
        border: "1.5px dashed rgb(99 102 241)",
        background: "rgb(99 102 241 / 0.08)",
      }}
    />
  );
}
