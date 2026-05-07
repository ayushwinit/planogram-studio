"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { PropertyRow, PropertySection } from "./PropertyRow";
import { Trash2 } from "lucide-react";

export function ShelfProperties({ shelfId }: { shelfId: string }) {
  const shelf = useEditorStore((s) => s.planogram.shelves.find((sh) => sh.id === shelfId));
  const updateShelf = useEditorStore((s) => s.updateShelf);
  const removeShelf = useEditorStore((s) => s.removeShelf);

  if (!shelf) return null;

  return (
    <div>
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
            if (confirm("Delete the entire shelf unit and every placement on it?")) removeShelf(shelfId);
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete shelf unit
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
