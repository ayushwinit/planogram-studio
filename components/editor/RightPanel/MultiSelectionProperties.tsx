"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { useCatalogStore, toEditorProduct, brandAccentColor } from "@/lib/store/catalogStore";
import { Button } from "@/components/ui/Button";
import { PropertySection } from "./PropertyRow";
import { Copy, CopyPlus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

/** Right-panel surface when 2+ placements are selected. Shows a compact list
 *  of what's in the selection and bulk actions (Copy / Duplicate / Delete).
 *  Per-placement properties (arrangement, position, etc.) are hidden because
 *  applying them across heterogenous placements is ambiguous. */
export function MultiSelectionProperties({ ids }: { ids: string[] }) {
  // IMPORTANT: subscribe to the raw placements array (stable reference between
  // store updates) and derive the filtered subset in useMemo. Returning a
  // freshly-filtered array from the Zustand selector breaks under React 19's
  // useSyncExternalStore equality check ("getSnapshot should be cached"),
  // which crashes the page on every multi-select click.
  const allPlacements = useEditorStore((s) => s.planogram.placements);
  const products = useCatalogStore((s) => s.products);
  const copySelectionToClipboard = useEditorStore((s) => s.copySelectionToClipboard);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);
  const removePlacements = useEditorStore((s) => s.removePlacements);
  const togglePlacementSelection = useEditorStore((s) => s.togglePlacementSelection);

  const placements = React.useMemo(() => {
    const set = new Set(ids);
    return allPlacements.filter((p) => set.has(p.instanceId));
  }, [allPlacements, ids]);

  // Count duplicates by product so the list reads naturally for typical
  // shelf compositions (e.g. "Coca-Cola 330ml × 6").
  const byProduct = React.useMemo(() => {
    const m = new Map<string, { name: string; brand: string; count: number; imageUrl: string }>();
    for (const p of placements) {
      const raw = products.find((rp) => rp.productId === p.productId);
      if (!raw) continue;
      const ep = toEditorProduct(raw);
      const entry = m.get(p.productId);
      if (entry) {
        entry.count += 1;
      } else {
        m.set(p.productId, { name: ep.name, brand: ep.brand, count: 1, imageUrl: ep.imageUrl });
      }
    }
    return [...m.values()];
  }, [placements, products]);

  function handleCopy() {
    const n = copySelectionToClipboard();
    if (n > 0) toast.success(`Copied ${n} ${n === 1 ? "item" : "items"}`);
  }
  function handleDuplicate() {
    const next = duplicateSelection({ dxMm: 20, dyMm: 0 });
    if (next.length > 0) toast.success(`Duplicated ${next.length} ${next.length === 1 ? "item" : "items"}`);
  }
  function handleDelete() {
    if (!confirm(`Delete ${ids.length} placements?`)) return;
    removePlacements(ids);
  }

  return (
    <div>
      <PropertySection title={`${ids.length} placements selected`}>
        <div className="rounded-md bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span>
            Per-placement properties are hidden. Use the actions below — or shift+click an item to drop it from the selection.
          </span>
        </div>
      </PropertySection>

      <PropertySection title="Selection">
        <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
          {byProduct.map((entry, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
            >
              <div className="h-7 w-7 rounded bg-slate-50 border border-slate-200 grid place-items-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.imageUrl}
                  alt={entry.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-800 truncate">{entry.name}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  <span
                    className="px-1 py-px rounded text-white text-[9px] mr-1 align-middle"
                    style={{ background: brandAccentColor(entry.brand) }}
                  >
                    {entry.brand}
                  </span>
                </div>
              </div>
              <span className="text-[11px] tabular-nums font-semibold text-slate-700 shrink-0">
                × {entry.count}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="text-[11px] text-slate-500 hover:text-slate-700"
          onClick={() => {
            // Drop the most-recently-added placement from the selection (visual
            // "undo last shift-click" affordance).
            const last = ids[ids.length - 1];
            if (last) togglePlacementSelection(last);
          }}
        >
          Drop last item from selection
        </button>
      </PropertySection>

      <PropertySection title="Actions">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDuplicate}>
            <CopyPlus className="h-3.5 w-3.5" /> Duplicate
          </Button>
        </div>
        <Button
          size="sm"
          variant="destructive"
          className="w-full gap-1.5"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete {ids.length} placements
        </Button>
      </PropertySection>
    </div>
  );
}
