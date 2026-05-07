"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { useCatalogStore, brandAccentColor, toEditorProduct } from "@/lib/store/catalogStore";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { PropertyRow, PropertySection } from "./PropertyRow";
import { Columns3, Grid3x3, Rows3, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Arrangement, ArrangementKind } from "@/lib/types";
import { arrangementMetrics } from "@/lib/arrangement";

export function PlacementProperties({ placementId }: { placementId: string }) {
  const placement = useEditorStore((s) => s.planogram.placements.find((p) => p.instanceId === placementId));
  // Stable raw row → memoized editor product (avoids snapshot loop).
  const rawProduct = useCatalogStore((s) =>
    placement ? s.products.find((p) => p.productId === placement.productId) : undefined,
  );
  const product = React.useMemo(
    () => (rawProduct ? toEditorProduct(rawProduct) : undefined),
    [rawProduct],
  );
  const updatePlacement = useEditorStore((s) => s.updatePlacement);
  const removePlacement = useEditorStore((s) => s.removePlacement);

  if (!placement || !product) return null;
  const brandColor = brandAccentColor(product.brand);

  const arr = placement.arrangement;
  const metrics = arrangementMetrics(product, arr);

  function setArrangement(patch: Partial<Arrangement>) {
    if (!placement) return;
    const merged = { ...placement.arrangement, ...patch } as Arrangement;
    updatePlacement(placement.instanceId, { arrangement: merged });
  }

  function setKind(kind: ArrangementKind) {
    if (!placement) return;
    let next: Arrangement;
    if (kind === "horizontal") {
      next = { kind: "horizontal", count: arr.kind === "horizontal" || arr.kind === "stacked" ? arr.count : 4, gapMm: arr.gapMm ?? 2 };
    } else if (kind === "stacked") {
      next = { kind: "stacked", count: arr.kind === "horizontal" || arr.kind === "stacked" ? arr.count : 3, gapMm: arr.gapMm ?? 2 };
    } else {
      next = {
        kind: "grid",
        cols: arr.kind === "grid" ? arr.cols : 3,
        rows: arr.kind === "grid" ? arr.rows : 2,
        gapMm: arr.gapMm ?? 2,
      };
    }
    updatePlacement(placement.instanceId, { arrangement: next });
  }

  return (
    <div>
      <PropertySection title="Product">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-md bg-slate-50 border border-slate-200 grid place-items-center overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.imageUrl} alt={product.name} className="max-h-full max-w-full object-contain p-0.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{product.name}</div>
            <div className="text-[11px] text-slate-500">
              <span className="px-1.5 py-0.5 rounded text-white text-[10px] mr-1.5 align-middle" style={{ background: brandColor }}>
                {product.brand}
              </span>
              {product.sku ?? ""}
            </div>
          </div>
        </div>
      </PropertySection>

      <PropertySection title="Arrangement">
        <RadioGroup value={arr.kind} onValueChange={(v) => setKind(v as ArrangementKind)} className="grid grid-cols-3 gap-2">
          <ArrOpt v="horizontal" current={arr.kind} label="Side by side" icon={<Columns3 className="h-4 w-4" />} />
          <ArrOpt v="stacked" current={arr.kind} label="Piled" icon={<Rows3 className="h-4 w-4" />} />
          <ArrOpt v="grid" current={arr.kind} label="Grid" icon={<Grid3x3 className="h-4 w-4" />} />
        </RadioGroup>

        {arr.kind !== "grid" ? (
          <PropertyRow label="Quantity">
            <Input
              type="number"
              min={1}
              max={50}
              value={arr.count}
              onChange={(e) => setArrangement({ count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
            />
          </PropertyRow>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <PropertyRow label="Columns">
              <Input
                type="number"
                min={1}
                max={20}
                value={arr.cols}
                onChange={(e) => setArrangement({ cols: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
              />
            </PropertyRow>
            <PropertyRow label="Rows">
              <Input
                type="number"
                min={1}
                max={20}
                value={arr.rows}
                onChange={(e) => setArrangement({ rows: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
              />
            </PropertyRow>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <PropertyRow label="Gap (mm)">
            <Input
              type="number"
              min={0}
              max={50}
              value={arr.gapMm ?? 0}
              onChange={(e) => setArrangement({ gapMm: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
            />
          </PropertyRow>
          <PropertyRow label="Rotation">
            <select
              value={placement.rotationDeg}
              onChange={(e) =>
                updatePlacement(placement.instanceId, {
                  rotationDeg: Number(e.target.value) as 0 | 90 | 180 | 270,
                })
              }
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
            >
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </PropertyRow>
        </div>

        <div className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600 flex items-center gap-3">
          <span><span className="font-semibold text-slate-900">{metrics.totalUnits}</span> units</span>
          <span className="text-slate-300">·</span>
          <span>Footprint <span className="font-semibold tabular-nums text-slate-900">{Math.round(metrics.totalWidthMm)}×{Math.round(metrics.totalHeightMm)}mm</span></span>
        </div>
      </PropertySection>

      <PropertySection title="Position on shelf (mm)">
        <div className="grid grid-cols-2 gap-2">
          <PropertyRow label="X">
            <Input
              type="number"
              value={Math.round(placement.xMm)}
              onChange={(e) => updatePlacement(placement.instanceId, { xMm: Number(e.target.value) || 0 })}
            />
          </PropertyRow>
          <PropertyRow label="Y">
            <Input
              type="number"
              value={Math.round(placement.yMm)}
              onChange={(e) => updatePlacement(placement.instanceId, { yMm: Number(e.target.value) || 0 })}
            />
          </PropertyRow>
        </div>
      </PropertySection>

      <PropertySection title="Notes">
        <Textarea
          value={placement.notes ?? ""}
          onChange={(e) => updatePlacement(placement.instanceId, { notes: e.target.value })}
          placeholder="Internal notes for this placement…"
        />
      </PropertySection>

      <PropertySection>
        <Button variant="destructive" className="w-full gap-2" onClick={() => removePlacement(placement.instanceId)}>
          <Trash2 className="h-4 w-4" /> Remove placement
        </Button>
      </PropertySection>
    </div>
  );
}

function ArrOpt({
  v,
  current,
  label,
  icon,
}: {
  v: ArrangementKind;
  current: ArrangementKind;
  label: string;
  icon: React.ReactNode;
}) {
  const active = v === current;
  return (
    <label
      className={cn(
        "relative cursor-pointer rounded-md border p-2 flex flex-col items-center gap-1 text-[11px] transition-colors",
        active ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <RadioGroupItem value={v} className="sr-only" />
      {icon}
      <span className="font-medium leading-tight text-center">{label}</span>
    </label>
  );
}
