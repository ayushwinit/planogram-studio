"use client";
import * as React from "react";
import { useEditorStore, MAX_INNER_SHELVES_LIMIT } from "@/lib/store/editorStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { PropertyRow, PropertySection } from "./PropertyRow";
import { ArrowDownToLine, ArrowUpDown, ArrowUpToLine, ChevronDown, Copy, Eraser, GripVertical, Layers, MoreVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReplicateShelfModal } from "../modals/ReplicateShelfModal";
import { toast } from "sonner";

/** Always-visible list of inner shelves for the (single) outer shelf. */
export function ShelvesList() {
  const shelf = useEditorStore((s) => s.planogram.shelves[0]);
  const addInnerShelf = useEditorStore((s) => s.addInnerShelf);
  const updateRow = useEditorStore((s) => s.updateRow);
  const removeRow = useEditorStore((s) => s.removeRow);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const placements = useEditorStore((s) => s.planogram.placements);
  const replicateRowContents = useEditorStore((s) => s.replicateRowContents);
  const swapRowContents = useEditorStore((s) => s.swapRowContents);
  const clearRowContents = useEditorStore((s) => s.clearRowContents);

  const [replicateSourceRowId, setReplicateSourceRowId] = React.useState<string | null>(null);
  // Native HTML5 drag — the canvas already owns a dnd-kit context, and mixing a
  // second one into the side panel is more trouble than this list is worth.
  const [dragRowId, setDragRowId] = React.useState<string | null>(null);
  const [dropRowId, setDropRowId] = React.useState<string | null>(null);

  if (!shelf) return null;
  const shelfId = shelf.id;
  const innerAtMax = shelf.rows.length >= MAX_INNER_SHELVES_LIMIT;

  function pullFrom(targetRowId: string, srcRowId: string, replace: boolean) {
    if (!shelf) return;
    if (replace) {
      const existing = placements.filter((p) => p.shelfId === shelf.id && p.rowId === targetRowId);
      if (existing.length > 0) {
        // The replicateRowContents action handles the clear when replaceExisting=true,
        // but we still want to be sure the user knows what happened.
      }
    }
    const created = replicateRowContents({
      srcShelfId: shelf.id,
      srcRowId: srcRowId,
      dstRowIds: [targetRowId],
      mode: "exact",
      replaceExisting: replace,
    });
    if (created === 0) {
      toast.error("Source shelf is empty");
    } else {
      toast.success(`Copied ${created} placements from source shelf`);
    }
  }

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
          const rowPlacementCount = placements.filter(
            (p) => p.shelfId === shelf.id && p.rowId === row.id,
          ).length;
          const otherRows = shelf.rows.filter((r) => r.id !== row.id);
          return (
            <div
              key={row.id}
              onDragOver={(e) => {
                if (!dragRowId || dragRowId === row.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropRowId !== row.id) setDropRowId(row.id);
              }}
              onDragLeave={() => {
                if (dropRowId === row.id) setDropRowId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const srcId = dragRowId ?? e.dataTransfer.getData("text/plain");
                setDragRowId(null);
                setDropRowId(null);
                if (!srcId || srcId === row.id) return;
                swapRowContents(shelfId, srcId, row.id);
                const src = shelf?.rows.find((r) => r.id === srcId);
                toast.success(
                  `Swapped ${src?.label ?? "shelf"} with ${row.label ?? "shelf"}`,
                );
              }}
              className={cn(
                "rounded-md border p-2 space-y-2 transition-colors",
                dragRowId === row.id && "opacity-40",
                dropRowId === row.id
                  ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300"
                  : isRowSelected
                  ? "border-indigo-400 bg-indigo-50/40"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-1">
                <span
                  draggable
                  onDragStart={(e) => {
                    setDragRowId(row.id);
                    e.dataTransfer.effectAllowed = "move";
                    // Firefox refuses to start a drag without a payload.
                    e.dataTransfer.setData("text/plain", row.id);
                  }}
                  onDragEnd={() => {
                    setDragRowId(null);
                    setDropRowId(null);
                  }}
                  title="Drag onto another shelf to swap their contents"
                  className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-between text-left min-w-0"
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
                    {rowPlacementCount > 0 ? (
                      <span className="text-[9px] tabular-nums text-slate-400 shrink-0">
                        · {rowPlacementCount}
                      </span>
                    ) : null}
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

                <ShelfRowMenu
                  hasOthers={otherRows.length > 0}
                  otherRows={otherRows.map((r) => ({
                    id: r.id,
                    label: r.label ?? `Shelf ${r.index + 1}`,
                    count: placements.filter(
                      (p) => p.shelfId === shelf.id && p.rowId === r.id,
                    ).length,
                  }))}
                  rowHasPlacements={rowPlacementCount > 0}
                  onPullFrom={(srcId, replace) => pullFrom(row.id, srcId, replace)}
                  onReplicate={() => setReplicateSourceRowId(row.id)}
                  onSwap={(otherRowId) => swapRowContents(shelfId, row.id, otherRowId)}
                  onClear={() => {
                    const label = row.label ?? `Shelf ${row.index + 1}`;
                    if (!confirm(`Remove all ${rowPlacementCount} products from "${label}"?`)) return;
                    const n = clearRowContents(shelfId, row.id);
                    toast.success(`Cleared ${n} placement${n === 1 ? "" : "s"} from ${label}`);
                  }}
                  canInsert={!innerAtMax}
                  onInsert={(where) =>
                    addInnerShelf(shelfId, where === "above" ? row.index : row.index + 1)
                  }
                  canDelete={shelf.rows.length > 1}
                  onDelete={() => {
                    const label = row.label ?? `Shelf ${row.index + 1}`;
                    if (confirm(`Remove "${label}" and all its placements?`)) {
                      removeRow(shelfId, row.id);
                    }
                  }}
                />
              </div>

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

      <ReplicateShelfModal
        open={replicateSourceRowId !== null}
        sourceRowId={replicateSourceRowId}
        onClose={() => setReplicateSourceRowId(null)}
      />
    </PropertySection>
  );
}

/** Per-row "..." menu: pull contents from another shelf, or push this shelf
 *  to many shelves via the replicate modal. */
function ShelfRowMenu({
  hasOthers,
  otherRows,
  rowHasPlacements,
  onPullFrom,
  onReplicate,
  onSwap,
  onClear,
  canInsert,
  onInsert,
  canDelete,
  onDelete,
}: {
  hasOthers: boolean;
  otherRows: { id: string; label: string; count: number }[];
  rowHasPlacements: boolean;
  onPullFrom: (srcRowId: string, replace: boolean) => void;
  onReplicate: () => void;
  onSwap: (otherRowId: string) => void;
  onClear: () => void;
  /** False once the unit is at MAX_INNER_SHELVES. */
  canInsert: boolean;
  onInsert: (where: "above" | "below") => void;
  /** False for the last remaining shelf — the unit must keep at least one. */
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [copyFromOpen, setCopyFromOpen] = React.useState(false);
  const [swapOpen, setSwapOpen] = React.useState(false);

  // Same two-step pattern as "Copy from", picking the shelf to trade with.
  if (swapOpen) {
    return (
      <DropdownMenu
        open
        onOpenChange={(o) => {
          if (!o) setSwapOpen(false);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Swap with another shelf"
            className="h-7 w-7 grid place-items-center rounded text-slate-500 hover:bg-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            Swap contents with
          </div>
          {otherRows.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-slate-500">No other shelves</div>
          ) : (
            otherRows.map((r) => (
              <DropdownMenuItem
                key={r.id}
                onSelect={() => {
                  setSwapOpen(false);
                  onSwap(r.id);
                }}
              >
                <span className="flex-1 truncate">{r.label}</span>
                <span className="text-[10px] tabular-nums text-slate-400">{r.count}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // The two-step "Copy from → which shelf?" flow is implemented as a second
  // dropdown so we don't need a Radix submenu primitive in this codebase.
  if (copyFromOpen) {
    return (
      <DropdownMenu
        open
        onOpenChange={(o) => {
          if (!o) setCopyFromOpen(false);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Copy from another shelf"
            className="h-7 w-7 grid place-items-center rounded text-slate-500 hover:bg-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            Copy contents from
          </div>
          {otherRows.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-slate-500">No other shelves</div>
          ) : (
            otherRows
              .filter((r) => r.count > 0)
              .map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onSelect={() => {
                    setCopyFromOpen(false);
                    if (rowHasPlacements) {
                      const replace = confirm(
                        `This shelf already has products. Replace them with “${r.label}” contents?\n\nOK = Replace · Cancel = Keep both (merge)`,
                      );
                      onPullFrom(r.id, replace);
                    } else {
                      onPullFrom(r.id, false);
                    }
                  }}
                >
                  <span className="flex-1 truncate">{r.label}</span>
                  <span className="text-[10px] tabular-nums text-slate-400">{r.count}</span>
                </DropdownMenuItem>
              ))
          )}
          {otherRows.every((r) => r.count === 0) ? (
            <div className="px-2 py-1.5 text-[11px] text-slate-400">
              Other shelves are empty
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Shelf actions"
          className="h-7 w-7 grid place-items-center rounded text-slate-500 hover:bg-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuItem
          disabled={!hasOthers}
          onSelect={(e) => {
            e.preventDefault();
            setOpen(false);
            setCopyFromOpen(true);
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="flex-1">Copy from…</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasOthers || !rowHasPlacements}
          onSelect={() => {
            setOpen(false);
            onReplicate();
          }}
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="flex-1">Replicate to…</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasOthers}
          onSelect={(e) => {
            e.preventDefault();
            setOpen(false);
            setSwapOpen(true);
          }}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="flex-1">Swap with…</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canInsert}
          onSelect={() => {
            setOpen(false);
            onInsert("above");
          }}
        >
          <ArrowUpToLine className="h-3.5 w-3.5" />
          <span className="flex-1">Insert shelf above</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canInsert}
          onSelect={() => {
            setOpen(false);
            onInsert("below");
          }}
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
          <span className="flex-1">Insert shelf below</span>
        </DropdownMenuItem>
        {!rowHasPlacements ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[10px] text-slate-400">
              Add products first to replicate this shelf
            </div>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!rowHasPlacements}
          onSelect={() => {
            setOpen(false);
            onClear();
          }}
        >
          <Eraser className="h-3.5 w-3.5" />
          <span className="flex-1">Clear products</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canDelete}
          className="text-rose-600 focus:text-rose-600"
          onSelect={() => {
            setOpen(false);
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="flex-1">Delete shelf</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
