"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { Input } from "@/components/ui/Input";
import { PropertyRow, PropertySection } from "./PropertyRow";

export function CanvasProperties() {
  const planogram = useEditorStore((s) => s.planogram);
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize);
  const setMeta = useEditorStore((s) => s.setMeta);
  const setName = useEditorStore((s) => s.setName);

  const placementCount = planogram.placements.length;
  const shelfCount = planogram.shelves.length;
  const rowCount = planogram.shelves.reduce((acc, sh) => acc + sh.rows.length, 0);
  const totalUnits = planogram.placements.reduce((acc, p) => {
    if (p.arrangement.kind === "grid") return acc + p.arrangement.cols * p.arrangement.rows;
    return acc + p.arrangement.count;
  }, 0);

  return (
    <div>
      <PropertySection title="Identity">
        <PropertyRow label="Name">
          <Input value={planogram.name} onChange={(e) => setName(e.target.value)} />
        </PropertyRow>
      </PropertySection>

      <PropertySection title="Canvas (mm)">
        <div className="grid grid-cols-2 gap-2">
          <PropertyRow label="Width">
            <Input
              type="number"
              value={planogram.canvasWidthMm}
              onChange={(e) => setCanvasSize(Math.max(200, Number(e.target.value) || 0), planogram.canvasHeightMm)}
            />
          </PropertyRow>
          <PropertyRow label="Height">
            <Input
              type="number"
              value={planogram.canvasHeightMm}
              onChange={(e) => setCanvasSize(planogram.canvasWidthMm, Math.max(200, Number(e.target.value) || 0))}
            />
          </PropertyRow>
        </div>
      </PropertySection>

      <PropertySection title="Meta">
        <PropertyRow label="Store ID">
          <Input
            value={planogram.meta.storeId ?? ""}
            onChange={(e) => setMeta({ storeId: e.target.value })}
            placeholder="e.g. STORE-002"
          />
        </PropertyRow>
        <PropertyRow label="Aisle">
          <Input
            value={planogram.meta.aisle ?? ""}
            onChange={(e) => setMeta({ aisle: e.target.value })}
            placeholder="e.g. Aisle 4"
          />
        </PropertyRow>
      </PropertySection>

      <PropertySection title="Stats">
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Shelves" value={shelfCount} />
          <Stat label="Rows" value={rowCount} />
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
