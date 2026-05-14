"use client";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { useCatalogStore, brandAccentColor, toEditorProduct } from "@/lib/store/catalogStore";
import type { Arrangement, ArrangementKind } from "@/lib/types";
import { arrangementMetrics } from "@/lib/arrangement";
import { Rows3, Columns3, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PendingPlacement {
  productId: string;
  shelfId: string;
  rowId: import("@/lib/types").RowSlot;
  xMm: number;
  yMm: number;
  arrangement: Arrangement;
  rotationDeg: 0 | 90 | 180 | 270;
}

interface Props {
  pending: PendingPlacement | null;
  onClose: () => void;
  onConfirm: (p: PendingPlacement) => void;
}

export function PlaceProductModal({ pending, onClose, onConfirm }: Props) {
  // Select the raw row (stable reference) and derive the editor-shape product
  // locally. Calling `getProduct` directly inside the selector returned a fresh
  // object on every render and looped useSyncExternalStore.
  const rawProduct = useCatalogStore((s) =>
    pending ? s.products.find((p) => p.productId === pending.productId) : undefined,
  );
  const product = React.useMemo(
    () => (rawProduct ? toEditorProduct(rawProduct) : undefined),
    [rawProduct],
  );
  const brandColor = product ? brandAccentColor(product.mainBrand ?? "") : "#475569";
  const brandName = product?.mainBrand ?? "";

  const [kind, setKind] = React.useState<ArrangementKind>("horizontal");
  const [count, setCount] = React.useState<number>(4);
  const [cols, setCols] = React.useState<number>(3);
  const [rows, setRows] = React.useState<number>(2);
  const [gap, setGap] = React.useState<number>(2);
  const [rotation, setRotation] = React.useState<0 | 90 | 180 | 270>(0);

  // Reset form when a new pending opens — React's "Storing information from
  // previous renders" pattern. The setter call during render schedules a single
  // additional render before paint, no extra effect.
  const pendingKey = pending ? `${pending.productId}:${pending.shelfId}:${pending.rowId}` : null;
  const [lastPendingKey, setLastPendingKey] = React.useState<string | null>(null);
  if (pendingKey !== lastPendingKey) {
    setLastPendingKey(pendingKey);
    if (pending) {
      const a = pending.arrangement;
      setKind(a.kind);
      if (a.kind === "horizontal" || a.kind === "stacked") setCount(a.count);
      if (a.kind === "grid") {
        setCols(a.cols);
        setRows(a.rows);
      }
      setGap(a.gapMm ?? 2);
      setRotation(pending.rotationDeg);
    }
  }

  if (!pending || !product) return null;

  const arrangement: Arrangement =
    kind === "horizontal"
      ? { kind: "horizontal", count, gapMm: gap }
      : kind === "stacked"
      ? { kind: "stacked", count, gapMm: gap }
      : { kind: "grid", cols, rows, gapMm: gap };

  const metrics = arrangementMetrics(product, arrangement);

  return (
    <Dialog open={!!pending} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-md grid place-items-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {brandName[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <DialogTitle>Place {product.name}</DialogTitle>
              <DialogDescription>
                Choose how many units and how they should be arranged on the shelf.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_180px] gap-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arrangement</Label>
              <RadioGroup
                value={kind}
                onValueChange={(v) => setKind(v as ArrangementKind)}
                className="grid grid-cols-3 gap-2"
              >
                <ArrangementOption value="horizontal" current={kind} label="Side by side" icon={<Columns3 className="h-4 w-4" />} />
                <ArrangementOption value="stacked" current={kind} label="Piled vertically" icon={<Rows3 className="h-4 w-4" />} />
                <ArrangementOption value="grid" current={kind} label="Grid" icon={<Grid3x3 className="h-4 w-4" />} />
              </RadioGroup>
            </div>

            {kind !== "grid" ? (
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Columns</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={cols}
                    onChange={(e) => setCols(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rows</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={rows}
                    onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gap (mm)</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={gap}
                  onChange={(e) => setGap(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rotation</Label>
                <select
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value) as 0 | 90 | 180 | 270)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
                >
                  <option value={0}>0°</option>
                  <option value={90}>90°</option>
                  <option value={180}>180°</option>
                  <option value={270}>270°</option>
                </select>
              </div>
            </div>

            <div className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600 flex items-center gap-3">
              <span><span className="font-semibold text-slate-900">{metrics.totalUnits}</span> units</span>
              <span className="text-slate-300">·</span>
              <span>Footprint <span className="font-semibold tabular-nums text-slate-900">{Math.round(metrics.totalWidthMm)}×{Math.round(metrics.totalHeightMm)}mm</span></span>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 grid place-items-center">
            <PreviewArrangement
              imageUrl={product.imageUrl}
              metrics={metrics}
              gapMm={gap}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onConfirm({ ...pending, arrangement, rotationDeg: rotation })}
          >
            Place {metrics.totalUnits} unit{metrics.totalUnits === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArrangementOption({
  value,
  current,
  label,
  icon,
}: {
  value: ArrangementKind;
  current: ArrangementKind;
  label: string;
  icon: React.ReactNode;
}) {
  const active = value === current;
  return (
    <label
      className={cn(
        "relative cursor-pointer rounded-md border p-2.5 flex flex-col items-center gap-1 text-xs transition-colors",
        active ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <RadioGroupItem value={value} className="sr-only" />
      {icon}
      <span className="font-medium leading-tight text-center">{label}</span>
    </label>
  );
}

function PreviewArrangement({
  imageUrl,
  metrics,
  gapMm,
}: {
  imageUrl: string;
  metrics: ReturnType<typeof arrangementMetrics>;
  gapMm: number;
}) {
  const maxPx = 130;
  const scale = Math.min(maxPx / metrics.totalWidthMm, maxPx / metrics.totalHeightMm, 1);
  const cellW = metrics.cellWidthMm * scale;
  const cellH = metrics.cellHeightMm * scale;
  const gap = gapMm * scale;

  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < metrics.rows; r++)
    for (let c = 0; c < metrics.cols; c++) cells.push({ r, c });

  return (
    <div
      className="relative"
      style={{ width: metrics.totalWidthMm * scale, height: metrics.totalHeightMm * scale }}
    >
      {cells.map(({ r, c }) => (
        <div
          key={`${r}-${c}`}
          className="absolute"
          style={{ left: c * (cellW + gap), top: r * (cellH + gap), width: cellW, height: cellH }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="preview" className="w-full h-full object-contain" draggable={false} />
        </div>
      ))}
    </div>
  );
}
