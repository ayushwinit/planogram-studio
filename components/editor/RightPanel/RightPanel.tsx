"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { ShelfProperties } from "./ShelfProperties";
import { PlacementProperties } from "./PlacementProperties";
import { CanvasProperties } from "./CanvasProperties";
import { Sliders } from "lucide-react";

export function RightPanel() {
  const selection = useEditorStore((s) => s.selection);

  return (
    <aside className="h-full bg-white border-l border-slate-200 flex flex-col">
      <div className="px-4 h-11 shrink-0 flex items-center gap-2 border-b border-slate-100">
        <Sliders className="h-4 w-4 text-slate-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {selection.kind === "shelf"
            ? "Shelf Properties"
            : selection.kind === "row"
            ? "Shelf Properties"
            : selection.kind === "placement"
            ? "Placement Properties"
            : "Planogram"}
        </h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selection.kind === "shelf" ? (
          <ShelfProperties shelfId={selection.id} />
        ) : selection.kind === "row" ? (
          <ShelfProperties shelfId={selection.shelfId} />
        ) : selection.kind === "placement" ? (
          <PlacementProperties placementId={selection.id} />
        ) : (
          <CanvasProperties />
        )}
      </div>
    </aside>
  );
}
