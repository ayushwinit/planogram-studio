"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { PropertySection } from "./PropertyRow";

export function CanvasProperties() {
  const planogram = useEditorStore((s) => s.planogram);

  const placementCount = planogram.placements.length;
  const innerCount = planogram.shelves.reduce((acc, sh) => acc + sh.rows.length, 0);
  const totalUnits = planogram.placements.reduce((acc, p) => {
    if (p.arrangement.kind === "grid") return acc + p.arrangement.cols * p.arrangement.rows;
    return acc + p.arrangement.count;
  }, 0);

  return (
    <div>
      <PropertySection title="Stats">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Shelves" value={innerCount} />
          <Stat label="Placements" value={placementCount} />
          <Stat label="Units" value={totalUnits} />
        </div>
        <div className="text-[10px] text-slate-400 px-1 leading-relaxed">
          Tip: click a shelf or product to edit its properties. Drag products from the left panel onto a shelf.
        </div>
      </PropertySection>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 border border-slate-100 py-2">
      <div className="text-lg font-semibold text-slate-900 tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
