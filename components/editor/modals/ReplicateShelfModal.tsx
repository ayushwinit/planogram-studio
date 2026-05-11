"use client";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useEditorStore } from "@/lib/store/editorStore";
import { toast } from "sonner";
import { Layers, FlipHorizontal, SquareStack, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Mode = "exact" | "mirror" | "fillEmpty";

/** Push-style replication modal: takes one source inner shelf and a chosen
 *  set of destination shelves, copies all placements over. Three modes:
 *  - exact: clone as-is (x scaled if widths differ)
 *  - mirror: flip x positions for symmetric end-cap layouts
 *  - fillEmpty: only paste into shelves that are empty; skip the rest
 *
 *  The outer component is a thin shell that just keys the body by sourceRowId.
 *  Form state lives in the body, so React naturally resets it whenever the
 *  user opens the modal on a different source shelf.
 */
export function ReplicateShelfModal({
  open,
  sourceRowId,
  onClose,
}: {
  open: boolean;
  sourceRowId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      {sourceRowId ? (
        <ReplicateModalBody key={sourceRowId} sourceRowId={sourceRowId} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function ReplicateModalBody({
  sourceRowId,
  onClose,
}: {
  sourceRowId: string;
  onClose: () => void;
}) {
  const shelf = useEditorStore((s) => s.planogram.shelves[0]);
  const placements = useEditorStore((s) => s.planogram.placements);
  const replicateRowContents = useEditorStore((s) => s.replicateRowContents);

  const [targets, setTargets] = React.useState<Set<string>>(new Set());
  const [mode, setMode] = React.useState<Mode>("exact");
  const [replace, setReplace] = React.useState(false);

  if (!shelf) return null;
  const sourceRow = shelf.rows.find((r) => r.id === sourceRowId);
  if (!sourceRow) return null;

  const sourcePlacements = placements.filter(
    (p) => p.shelfId === shelf.id && p.rowId === sourceRowId,
  );
  const otherRows = shelf.rows.filter((r) => r.id !== sourceRowId);

  function toggleTarget(rowId: string) {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function selectAll() {
    setTargets(new Set(otherRows.map((r) => r.id)));
  }
  function clearAll() {
    setTargets(new Set());
  }

  function handleReplicate() {
    if (targets.size === 0) {
      toast.error("Pick at least one target shelf");
      return;
    }
    const count = replicateRowContents({
      srcShelfId: shelf.id,
      srcRowId: sourceRowId,
      dstRowIds: [...targets],
      mode,
      replaceExisting: replace,
    });
    if (count === 0) {
      toast.error("Nothing was replicated — target shelves already had products or none qualified");
    } else {
      toast.success(`Replicated ${count} placements into ${targets.size} ${targets.size === 1 ? "shelf" : "shelves"}`);
    }
    onClose();
  }

  return (
    <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Replicate “{sourceRow.label}”</DialogTitle>
          <DialogDescription>
            Copy all {sourcePlacements.length} placements from this shelf to the shelves you pick below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                Replicate to
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  className="text-indigo-600 hover:underline"
                  onClick={selectAll}
                >
                  All
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  className="text-slate-500 hover:underline"
                  onClick={clearAll}
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {otherRows.length === 0 ? (
                <div className="col-span-2 text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-md">
                  No other shelves to replicate to. Add a shelf first.
                </div>
              ) : (
                otherRows.map((r) => {
                  const checked = targets.has(r.id);
                  const placementCount = placements.filter(
                    (p) => p.shelfId === shelf.id && p.rowId === r.id,
                  ).length;
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer transition-colors text-xs",
                        checked
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTarget(r.id)}
                        className="accent-indigo-600"
                      />
                      <span className="flex-1 truncate">{r.label}</span>
                      {placementCount > 0 ? (
                        <span className="text-[10px] tabular-nums text-amber-600 font-semibold">
                          {placementCount}
                        </span>
                      ) : null}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
              Mode
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <ModeOption
                active={mode === "exact"}
                onClick={() => setMode("exact")}
                icon={<Layers className="h-4 w-4" />}
                label="Exact copy"
                hint="Same x positions"
              />
              <ModeOption
                active={mode === "mirror"}
                onClick={() => setMode("mirror")}
                icon={<FlipHorizontal className="h-4 w-4" />}
                label="Mirror"
                hint="Flip x positions"
              />
              <ModeOption
                active={mode === "fillEmpty"}
                onClick={() => setMode("fillEmpty")}
                icon={<SquareStack className="h-4 w-4" />}
                label="Empty only"
                hint="Skip occupied"
              />
            </div>
          </div>

          {mode !== "fillEmpty" ? (
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 cursor-pointer text-xs text-amber-900">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                className="mt-0.5 accent-amber-600"
              />
              <div>
                <div className="font-medium">Replace existing placements in target shelves</div>
                <div className="text-amber-800/80 mt-0.5 flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    Otherwise existing placements stay and the new ones are added alongside them.
                  </span>
                </div>
              </div>
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleReplicate} disabled={targets.size === 0}>
            Replicate to {targets.size} {targets.size === 1 ? "shelf" : "shelves"}
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}

function ModeOption({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border p-2 flex flex-col items-center gap-1 text-[11px] transition-colors",
        active
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 hover:border-slate-300 text-slate-700",
      )}
    >
      {icon}
      <span className="font-medium leading-tight">{label}</span>
      <span className="text-[9px] text-slate-500 leading-tight text-center">{hint}</span>
    </button>
  );
}
