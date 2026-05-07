"use client";
import * as React from "react";
import { useEditorStore, MAX_INNER_SHELVES_LIMIT } from "@/lib/store/editorStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { PropertyRow, PropertySection } from "./PropertyRow";
import { ChevronDown, Layers, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** Always-visible list of inner shelves for the (single) outer shelf. */
export function ShelvesList() {
  const shelf = useEditorStore((s) => s.planogram.shelves[0]);
  const addInnerShelf = useEditorStore((s) => s.addInnerShelf);
  const updateRow = useEditorStore((s) => s.updateRow);
  const removeRow = useEditorStore((s) => s.removeRow);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);

  if (!shelf) return null;
  const shelfId = shelf.id;
  const innerAtMax = shelf.rows.length >= MAX_INNER_SHELVES_LIMIT;

  return (
    <PropertySection title={`Shelves (${shelf.rows.length} of ${MAX_INNER_SHELVES_LIMIT})`}>
      <Button
        size="sm"
        variant="primary"
        className="w-full gap-1.5"
        disabled={innerAtMax}
        onClick={() => addInnerShelf(shelfId)}
      >
        <Plus className="h-4 w-4" /> Add shelf
      </Button>
      <div className="space-y-1.5">
        {shelf.rows.map((row) => {
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
                type="button"
                className="w-full flex items-center justify-between text-left"
                onClick={() =>
                  isRowSelected
                    ? select({ kind: "none" })
                    : select({ kind: "row", id: row.id, shelfId })
                }
                aria-expanded={isRowSelected}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {Math.round(row.heightMm)}mm
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-slate-400 transition-transform",
                      isRowSelected && "rotate-180"
                    )}
                  />
                </div>
              </button>
              {isRowSelected ? (
                <div className="space-y-2">
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
                    <Trash2 className="h-3.5 w-3.5" /> Remove shelf
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </PropertySection>
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
