"use client";
import * as React from "react";
import { Plus, ZoomIn, ZoomOut, Eraser } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { useEditorStore, MAX_INNER_SHELVES_LIMIT } from "@/lib/store/editorStore";
import { CreateShelfModal } from "./modals/CreateShelfModal";

export function CanvasToolbar() {
  const shelves = useEditorStore((s) => s.planogram.shelves);
  const addInnerShelf = useEditorStore((s) => s.addInnerShelf);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const resetView = useEditorStore((s) => s.resetView);
  const reset = useEditorStore((s) => s.reset);
  const placementCount = useEditorStore((s) => s.planogram.placements.length);

  const outerShelf = shelves[0];
  const hasShelf = !!outerShelf;
  const innerCount = outerShelf?.rows.length ?? 0;
  const isEmpty = !hasShelf && placementCount === 0;
  const innerAtMax = innerCount >= MAX_INNER_SHELVES_LIMIT;

  const [createOpen, setCreateOpen] = React.useState(false);

  function handlePrimary() {
    if (!hasShelf) {
      setCreateOpen(true);
    } else if (!innerAtMax) {
      addInnerShelf(outerShelf.id);
    }
  }

  const primaryLabel = hasShelf ? "Add Shelf" : "Add Shelf";
  const primaryTooltip = !hasShelf
    ? "Create the shelf and choose how many shelves it has"
    : innerAtMax
    ? `Maximum ${MAX_INNER_SHELVES_LIMIT} shelves reached`
    : "Add another horizontal shelf inside the unit";

  return (
    <>
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-slate-200 bg-white">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                variant="primary"
                onClick={handlePrimary}
                disabled={hasShelf && innerAtMax}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> {primaryLabel}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{primaryTooltip}</TooltipContent>
        </Tooltip>

        {hasShelf ? (
          <span className="text-xs text-slate-500 tabular-nums">
            {innerCount} of {MAX_INNER_SHELVES_LIMIT} shelves
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={zoomOut} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>
            <button
              onClick={resetView}
              className="px-2 text-xs font-medium text-slate-700 tabular-nums hover:bg-slate-100 rounded"
              title="Reset view (zoom + pan)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={zoomIn} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isEmpty}
                onClick={() => {
                  if (confirm("Clear the shelf and all placements?")) reset();
                }}
                className="gap-1.5"
              >
                <Eraser className="h-4 w-4" /> Clear
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove the shelf and every placement</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <CreateShelfModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
