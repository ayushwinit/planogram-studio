"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { PropertyRow, PropertySection } from "./PropertyRow";
import { ChevronDown, ChevronUp, Layers, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function ShelfProperties({ shelfId }: { shelfId: string }) {
  const shelf = useEditorStore((s) => s.planogram.shelves.find((sh) => sh.id === shelfId));
  const updateShelf = useEditorStore((s) => s.updateShelf);
  const removeShelf = useEditorStore((s) => s.removeShelf);
  const addRow = useEditorStore((s) => s.addRow);
  const updateRow = useEditorStore((s) => s.updateRow);
  const moveRow = useEditorStore((s) => s.moveRow);
  const removeRow = useEditorStore((s) => s.removeRow);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);

  if (!shelf) return null;

  return (
    <div>
      <PropertySection title="Identity">
        <PropertyRow label="Label">
          <Input
            value={shelf.label ?? ""}
            onChange={(e) => updateShelf(shelfId, { label: e.target.value })}
            placeholder="e.g. Beverage Bay"
          />
        </PropertyRow>
      </PropertySection>

      <PropertySection title="Position & Width (mm)">
        <PropertyRow label="Width">
          <Input
            type="number"
            value={Math.round(shelf.widthMm)}
            onChange={(e) => updateShelf(shelfId, { widthMm: Number(e.target.value) || 0 })}
          />
        </PropertyRow>
        <div className="grid grid-cols-2 gap-2">
          <PropertyRow label="X position">
            <Input
              type="number"
              value={Math.round(shelf.xMm)}
              onChange={(e) => updateShelf(shelfId, { xMm: Number(e.target.value) || 0 })}
            />
          </PropertyRow>
          <PropertyRow label="Y position">
            <Input
              type="number"
              value={Math.round(shelf.yMm)}
              onChange={(e) => updateShelf(shelfId, { yMm: Number(e.target.value) || 0 })}
            />
          </PropertyRow>
        </div>
      </PropertySection>

      <PropertySection title="Top placement area (mm)">
        <PropertyRow label="Height">
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              value={Math.round(shelf.topAreaMm)}
              onChange={(e) => updateShelf(shelfId, { topAreaMm: Math.max(0, Number(e.target.value) || 0) })}
            />
            <Button
              size="sm"
              variant={shelf.topAreaMm > 0 ? "outline" : "primary"}
              onClick={() =>
                updateShelf(shelfId, { topAreaMm: shelf.topAreaMm > 0 ? 0 : 80 })
              }
            >
              {shelf.topAreaMm > 0 ? "Disable" : "Enable"}
            </Button>
          </div>
        </PropertyRow>
        <div className="text-[10px] text-slate-400 leading-relaxed">
          When enabled, products can be placed on top of the shelf (above the topmost row).
        </div>
      </PropertySection>

      <PropertySection title={`Rows (${shelf.rows.length})`}>
        <Button size="sm" variant="primary" className="w-full gap-1.5" onClick={() => addRow(shelfId)}>
          <Plus className="h-4 w-4" /> Add row
        </Button>
        <div className="space-y-1.5">
          {shelf.rows.map((row, idx) => {
            const isRowSelected =
              selection.kind === "row" && selection.id === row.id;
            return (
              <div
                key={row.id}
                className={cn(
                  "rounded-md border p-2 space-y-2 transition-colors",
                  isRowSelected
                    ? "border-indigo-400 bg-indigo-50/40"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => select({ kind: "row", id: row.id, shelfId })}
                >
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-700">
                      {row.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {Math.round(row.heightMm)}mm
                  </span>
                </button>
                {isRowSelected ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        disabled={idx === 0}
                        onClick={() => moveRow(shelfId, row.id, "up")}
                        title="Move up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        disabled={idx === shelf.rows.length - 1}
                        onClick={() => moveRow(shelfId, row.id, "down")}
                        title="Move down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-[10px] text-slate-400">Row {idx + 1} of {shelf.rows.length}</span>
                    </div>
                    <PropertyRow label="Label">
                      <Input
                        value={row.label ?? ""}
                        onChange={(e) => updateRow(shelfId, row.id, { label: e.target.value })}
                      />
                    </PropertyRow>
                    <div className="grid grid-cols-2 gap-2">
                      <PropertyRow label="X position (mm)">
                        <Input
                          type="number"
                          value={Math.round(row.xMm)}
                          onChange={(e) => updateRow(shelfId, row.id, { xMm: Number(e.target.value) || 0 })}
                        />
                      </PropertyRow>
                      <PropertyRow label="Width (mm)">
                        <Input
                          type="number"
                          value={Math.round(row.widthMm)}
                          onChange={(e) => updateRow(shelfId, row.id, { widthMm: Number(e.target.value) || 0 })}
                        />
                      </PropertyRow>
                    </div>
                    <PropertyRow label="Height (mm)">
                      <Input
                        type="number"
                        value={Math.round(row.heightMm)}
                        onChange={(e) => updateRow(shelfId, row.id, { heightMm: Number(e.target.value) || 0 })}
                      />
                    </PropertyRow>
                    <PropertyRow label={`Border: ${row.borderWidthPx}px`}>
                      <Slider
                        value={[row.borderWidthPx]}
                        min={0}
                        max={10}
                        step={1}
                        onValueChange={([v]) => updateRow(shelfId, row.id, { borderWidthPx: v })}
                      />
                    </PropertyRow>
                    <div className="grid grid-cols-2 gap-2">
                      <PropertyRow label="Border color">
                        <ColorInput
                          value={row.borderColor}
                          onChange={(v) => updateRow(shelfId, row.id, { borderColor: v })}
                        />
                      </PropertyRow>
                      <PropertyRow label="Background">
                        <ColorInput
                          value={row.backgroundColor}
                          onChange={(v) => updateRow(shelfId, row.id, { backgroundColor: v })}
                        />
                      </PropertyRow>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full gap-1.5"
                      onClick={() => {
                        if (confirm(`Remove "${row.label}" and all its placements?`)) removeRow(shelfId, row.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove row
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </PropertySection>

      <PropertySection title="Outer border">
        <PropertyRow label={`Width: ${shelf.borderWidthPx}px`}>
          <Slider
            value={[shelf.borderWidthPx]}
            min={0}
            max={20}
            step={1}
            onValueChange={([v]) => updateShelf(shelfId, { borderWidthPx: v })}
          />
        </PropertyRow>
        <div className="grid grid-cols-2 gap-2">
          <PropertyRow label="Border color">
            <ColorInput
              value={shelf.borderColor}
              onChange={(v) => updateShelf(shelfId, { borderColor: v })}
            />
          </PropertyRow>
          <PropertyRow label="Background">
            <ColorInput
              value={shelf.backgroundColor}
              onChange={(v) => updateShelf(shelfId, { backgroundColor: v })}
            />
          </PropertyRow>
        </div>
      </PropertySection>

      <PropertySection>
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={() => {
            if (confirm("Delete this shelf and all its placements?")) removeShelf(shelfId);
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete shelf
        </Button>
      </PropertySection>
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 h-9 rounded-md border border-slate-200 bg-white px-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-5 w-5 rounded cursor-pointer border-0 bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none text-xs font-mono"
      />
    </div>
  );
}

