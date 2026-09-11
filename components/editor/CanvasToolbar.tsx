"use client";
import * as React from "react";
import { Plus, ZoomIn, ZoomOut, Eraser, Undo2, Redo2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { useEditorStore, MAX_INNER_SHELVES_LIMIT } from "@/lib/store/editorStore";
import { CreateShelfModal } from "./modals/CreateShelfModal";
import { cn } from "@/lib/cn";

export function CanvasToolbar() {
  const shelves = useEditorStore((s) => s.planogram.shelves);
  const addInnerShelf = useEditorStore((s) => s.addInnerShelf);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const resetView = useEditorStore((s) => s.resetView);
  const reset = useEditorStore((s) => s.reset);
  const placementCount = useEditorStore((s) => s.planogram.placements.length);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);

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

  /** Insert positions offered in the dropdown: top, after each existing shelf,
   *  and bottom. Numbering renumbers itself, so "after Shelf 2" really does
   *  become the new Shelf 3. */
  const insertPoints = outerShelf
    ? [
        { label: "At the top", atIndex: 0 },
        ...outerShelf.rows.slice(0, -1).map((r, i) => ({
          label: `After ${r.label ?? `Shelf ${i + 1}`}`,
          atIndex: i + 1,
        })),
        { label: "At the bottom", atIndex: outerShelf.rows.length },
      ]
    : [];

  const primaryLabel = hasShelf ? "Add Shelf" : "Add Shelf";
  const primaryTooltip = !hasShelf
    ? "Create the shelf and choose how many shelves it has"
    : innerAtMax
    ? `Maximum ${MAX_INNER_SHELVES_LIMIT} shelves reached`
    : "Add another horizontal shelf inside the unit";

  return (
    <>
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-slate-200 bg-white">
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handlePrimary}
                  disabled={hasShelf && innerAtMax}
                  className={cn("gap-1.5", hasShelf && "rounded-r-none")}
                >
                  <Plus className="h-4 w-4" /> {primaryLabel}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{primaryTooltip}</TooltipContent>
          </Tooltip>

          {hasShelf ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={innerAtMax}
                  aria-label="Choose where to add the shelf"
                  className="rounded-l-none border-l border-white/25 px-1.5"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[13rem]">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Add shelf
                </div>
                {insertPoints.map((pt, i) => (
                  <React.Fragment key={pt.atIndex}>
                    {i === insertPoints.length - 1 ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem
                      onSelect={() => addInnerShelf(outerShelf.id, pt.atIndex)}
                    >
                      <span className="flex-1">{pt.label}</span>
                    </DropdownMenuItem>
                  </React.Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Undo">
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Redo">
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
        </div>

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
