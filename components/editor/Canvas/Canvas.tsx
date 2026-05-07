"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { mmToPx } from "@/lib/units";
import { Shelf } from "./Shelf";
import { LayoutGrid } from "lucide-react";

export function Canvas() {
  const planogram = useEditorStore((s) => s.planogram);
  const zoom = useEditorStore((s) => s.zoom);
  const select = useEditorStore((s) => s.select);

  const widthPx = mmToPx(planogram.canvasWidthMm, zoom);
  const heightPx = mmToPx(planogram.canvasHeightMm, zoom);

  return (
    <div className="h-full bg-slate-100 overflow-auto relative" onClick={() => select({ kind: "none" })}>
      <div className="min-w-full min-h-full p-12 flex items-start justify-center">
        <div
          id="planogram-stage"
          className="relative bg-white rounded-lg shadow-lg ring-1 ring-slate-200 canvas-grid"
          style={{ width: widthPx, height: heightPx }}
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: "none" });
          }}
        >
          {/* Canvas dim label */}
          <div className="editor-only absolute -top-7 left-0 text-[10px] font-medium text-slate-400 tabular-nums select-none">
            {planogram.canvasWidthMm} × {planogram.canvasHeightMm} mm
          </div>

          {planogram.shelves.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-slate-400 text-sm pointer-events-none">
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-slate-100 grid place-items-center">
                  <LayoutGrid className="h-6 w-6 text-slate-400" />
                </div>
                <div className="font-medium text-slate-600">No shelves yet</div>
                <div className="text-xs text-slate-400">Click <span className="font-semibold text-indigo-600">Add Shelf</span> in the toolbar to begin.</div>
              </div>
            </div>
          ) : null}

          {planogram.shelves.map((shelf) => (
            <Shelf key={shelf.id} shelf={shelf} />
          ))}
        </div>
      </div>
    </div>
  );
}
