"use client";
import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { GripVertical, Move } from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { mmToPx, pxToMm } from "@/lib/units";
import type { RowSlot, Shelf as ShelfModel, ShelfRow as ShelfRowModel } from "@/lib/types";
import { rowTopOffsetMm, shelfTotalHeightMm } from "@/lib/shelfGeometry";
import { PlacedProductView } from "./PlacedProductView";
import { cn } from "@/lib/cn";

interface Props {
  shelf: ShelfModel;
}

const RAIL_WIDTH = 18;

export function Shelf({ shelf }: Props) {
  const zoom = useEditorStore((s) => s.zoom);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const updateShelf = useEditorStore((s) => s.updateShelf);

  const isSelected = selection.kind === "shelf" && selection.id === shelf.id;
  const totalHeightMm = shelfTotalHeightMm(shelf);
  const widthPx = mmToPx(shelf.widthMm, zoom);
  const heightPx = mmToPx(totalHeightMm, zoom);
  const xPx = mmToPx(shelf.xMm, zoom);
  const yPx = mmToPx(shelf.yMm, zoom);

  function startMove(e: React.PointerEvent) {
    // Don't preventDefault yet - we want clicks to fire if pointer doesn't move.
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startXMm = shelf.xMm;
    const startYMm = shelf.yMm;
    let dragging = false;
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < 4) return;
      dragging = true;
      const dxMm = pxToMm(dx, zoom);
      const dyMm = pxToMm(dy, zoom);
      let nextX = startXMm + dxMm;
      let nextY = startYMm + dyMm;
      if (ev.shiftKey) {
        nextX = Math.round(nextX / 10) * 10;
        nextY = Math.round(nextY / 10) * 10;
      }
      updateShelf(shelf.id, { xMm: Math.max(0, nextX), yMm: Math.max(0, nextY) });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResizeWidth(e: React.PointerEvent, edge: "e" | "w") {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = shelf.widthMm;
    const startXMm = shelf.xMm;
    function onMove(ev: PointerEvent) {
      const dxMm = pxToMm(ev.clientX - startX, zoom);
      const patch: Partial<ShelfModel> = {};
      if (edge === "e") patch.widthMm = Math.max(1, startW + dxMm);
      else {
        patch.widthMm = Math.max(1, startW - dxMm);
        patch.xMm = startXMm + dxMm;
      }
      if (ev.shiftKey) {
        if (patch.widthMm) patch.widthMm = Math.round(patch.widthMm / 10) * 10;
        if (patch.xMm !== undefined) patch.xMm = Math.round(patch.xMm / 10) * 10;
      }
      updateShelf(shelf.id, patch);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "shelf", id: shelf.id });
      }}
      className={cn(
        "absolute transition-shadow",
        isSelected && "ring-2 ring-indigo-500"
      )}
      style={{
        left: xPx,
        top: yPx,
        width: widthPx + RAIL_WIDTH, // include rail to the left
        height: heightPx,
      }}
    >
      {/* Left-rail drag handle (always visible). Sits flush with the shelf, easy to grab. */}
      <div
        onPointerDown={startMove}
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "shelf", id: shelf.id });
        }}
        className={cn(
          "editor-only absolute top-0 bottom-0 left-0 flex flex-col items-center justify-center gap-1 select-none rounded-l-md cursor-grab active:cursor-grabbing transition-colors",
          isSelected
            ? "bg-indigo-500 text-white"
            : "bg-slate-300 text-slate-600 hover:bg-slate-400 hover:text-white"
        )}
        style={{ width: RAIL_WIDTH }}
        title="Drag to move shelf"
      >
        <Move className="h-3.5 w-3.5" />
        <GripVertical className="h-3 w-3 opacity-70" />
      </div>

      {/* Shelf body to the right of the rail */}
      <div
        onPointerDown={(e) => {
          // Empty zones between rows / outside row widths drag the shelf.
          if (e.target !== e.currentTarget) return;
          startMove(e);
        }}
        className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing"
        style={{
          left: RAIL_WIDTH,
          width: widthPx,
          background: shelf.backgroundColor,
          border: `${shelf.borderWidthPx}px solid ${shelf.borderColor}`,
          borderRadius: 4,
        }}
      >
        {/* Top tab handle for label/info, also draggable */}
        <div
          onPointerDown={startMove}
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: "shelf", id: shelf.id });
          }}
          className={cn(
            "editor-only absolute -top-6 left-0 h-5 px-1.5 flex items-center gap-1 rounded-t-md text-[10px] font-medium tabular-nums select-none cursor-grab active:cursor-grabbing transition-colors",
            isSelected ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
          )}
          title="Drag to move shelf"
        >
          <GripVertical className="h-3 w-3 -ml-0.5 opacity-80" />
          <span>{shelf.label ?? `Shelf ${shelf.index + 1}`}</span>
          <span className="opacity-60 ml-1">{Math.round(shelf.widthMm)}mm</span>
        </div>

        {/* Top placement area */}
        {shelf.topAreaMm > 0 ? (
          <TopArea shelf={shelf} onShelfPointerDown={startMove} />
        ) : null}

        {/* Rows */}
        {shelf.rows.map((row) => (
          <Row key={row.id} shelf={shelf} row={row} onShelfPointerDown={startMove} />
        ))}

        {/* Width resize handles */}
        {isSelected ? (
          <>
            <div
              onPointerDown={(e) => startResizeWidth(e, "w")}
              onClick={(e) => e.stopPropagation()}
              className="editor-only absolute top-1/2 -translate-y-1/2 h-6 w-2.5 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
              style={{ left: -6, cursor: "ew-resize" }}
            />
            <div
              onPointerDown={(e) => startResizeWidth(e, "e")}
              onClick={(e) => e.stopPropagation()}
              className="editor-only absolute top-1/2 -translate-y-1/2 h-6 w-2.5 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
              style={{ right: -6, cursor: "ew-resize" }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

interface RowProps {
  shelf: ShelfModel;
  row: ShelfRowModel;
  onShelfPointerDown: (e: React.PointerEvent) => void;
}

function Row({ shelf, row, onShelfPointerDown }: RowProps) {
  const zoom = useEditorStore((s) => s.zoom);
  const placements = useEditorStore((s) => s.planogram.placements);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const updateRow = useEditorStore((s) => s.updateRow);
  const hoverDropTarget = useEditorStore((s) => s.hoverDropTarget);

  const { setNodeRef, isOver, active } = useDroppable({
    id: `row:${shelf.id}:${row.id}`,
    data: { kind: "row", shelfId: shelf.id, rowId: row.id },
  });

  const isSelected = selection.kind === "row" && selection.id === row.id;
  const isHoverTarget =
    hoverDropTarget?.shelfId === shelf.id && hoverDropTarget.rowId === row.id;

  const topOffsetMm = rowTopOffsetMm(shelf, row.id);
  const topPx = mmToPx(topOffsetMm, zoom);
  const leftPx = mmToPx(row.xMm, zoom);
  const widthPx = mmToPx(row.widthMm, zoom);
  const heightPx = mmToPx(row.heightMm, zoom);

  const rowPlacements = placements.filter(
    (p) => p.shelfId === shelf.id && p.rowId === row.id
  );

  function startResize(
    e: React.PointerEvent,
    edge: "e" | "w" | "s" | "n"
  ) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = row.widthMm;
    const startH = row.heightMm;
    const startXMm = row.xMm;
    function onMove(ev: PointerEvent) {
      const dxMm = pxToMm(ev.clientX - startX, zoom);
      const dyMm = pxToMm(ev.clientY - startY, zoom);
      const patch: Partial<ShelfRowModel> = {};
      if (edge === "e") patch.widthMm = Math.max(1, startW + dxMm);
      if (edge === "w") {
        patch.widthMm = Math.max(1, startW - dxMm);
        patch.xMm = startXMm + dxMm;
      }
      if (edge === "s") patch.heightMm = Math.max(1, startH + dyMm);
      if (edge === "n") patch.heightMm = Math.max(1, startH - dyMm);
      if (ev.shiftKey) {
        if (patch.widthMm) patch.widthMm = Math.round(patch.widthMm / 10) * 10;
        if (patch.heightMm) patch.heightMm = Math.round(patch.heightMm / 10) * 10;
        if (patch.xMm !== undefined) patch.xMm = Math.round(patch.xMm / 10) * 10;
      }
      updateRow(shelf.id, row.id, patch);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      ref={setNodeRef}
      onPointerDown={(e) => {
        // Pointerdown anywhere on the row body (not a placement/handle) drags the SHELF.
        // This way the user can grab the shelf from anywhere on its surface, not just the rail.
        if (e.target !== e.currentTarget) return;
        onShelfPointerDown(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "row", id: row.id, shelfId: shelf.id });
      }}
      className={cn(
        "absolute transition-colors cursor-grab active:cursor-grabbing",
        (isHoverTarget || (isOver && active)) && "outline outline-2 outline-indigo-400 outline-offset-[-2px] bg-indigo-50/60",
        isSelected && !isHoverTarget && "outline outline-2 outline-indigo-400/60 outline-offset-[-2px]"
      )}
      style={{
        left: leftPx,
        top: topPx,
        width: widthPx,
        height: heightPx,
        background: row.backgroundColor,
        borderTop: `${row.borderWidthPx}px solid ${row.borderColor}`,
        borderBottom: `${row.borderWidthPx}px solid ${row.borderColor}`,
      }}
    >
      {/* Row label */}
      <div className="editor-only absolute top-0.5 left-1.5 text-[9px] font-medium text-slate-500 tabular-nums select-none pointer-events-none">
        {row.label} · {Math.round(row.widthMm)}×{Math.round(row.heightMm)}mm
      </div>

      {/* Plank shading at the bottom = the shelf surface where products sit */}
      <div
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{
          height: 4,
          background: `linear-gradient(to bottom, ${row.borderColor}33, ${row.borderColor})`,
        }}
      />

      {/* Placements */}
      {rowPlacements.map((p) => (
        <PlacedProductView key={p.instanceId} placement={p} />
      ))}

      {/* Resize handles when selected */}
      {isSelected ? (
        <>
          <div onPointerDown={(e) => startResize(e, "w")} onClick={(e) => e.stopPropagation()}
            className="editor-only absolute top-1/2 -translate-y-1/2 h-5 w-2 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ left: -5, cursor: "ew-resize" }} />
          <div onPointerDown={(e) => startResize(e, "e")} onClick={(e) => e.stopPropagation()}
            className="editor-only absolute top-1/2 -translate-y-1/2 h-5 w-2 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ right: -5, cursor: "ew-resize" }} />
          <div onPointerDown={(e) => startResize(e, "s")} onClick={(e) => e.stopPropagation()}
            className="editor-only absolute left-1/2 -translate-x-1/2 h-2 w-10 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ bottom: -5, cursor: "ns-resize" }} />
          <div onPointerDown={(e) => startResize(e, "n")} onClick={(e) => e.stopPropagation()}
            className="editor-only absolute left-1/2 -translate-x-1/2 h-2 w-10 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ top: -5, cursor: "ns-resize" }} />
        </>
      ) : null}
    </div>
  );
}

function TopArea({
  shelf,
  onShelfPointerDown,
}: {
  shelf: ShelfModel;
  onShelfPointerDown: (e: React.PointerEvent) => void;
}) {
  const zoom = useEditorStore((s) => s.zoom);
  const placements = useEditorStore((s) => s.planogram.placements);
  const hoverDropTarget = useEditorStore((s) => s.hoverDropTarget);

  const { setNodeRef, isOver, active } = useDroppable({
    id: `top:${shelf.id}`,
    data: { kind: "row", shelfId: shelf.id, rowId: "top" as RowSlot },
  });

  const heightPx = mmToPx(shelf.topAreaMm, zoom);
  const topPlacements = placements.filter((p) => p.shelfId === shelf.id && p.rowId === "top");
  const isHoverTarget = hoverDropTarget?.shelfId === shelf.id && hoverDropTarget.rowId === "top";

  return (
    <div
      ref={setNodeRef}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        onShelfPointerDown(e);
      }}
      className={cn(
        "absolute top-0 left-0 right-0 transition-colors border-b border-dashed border-indigo-300 cursor-grab active:cursor-grabbing",
        (isHoverTarget || (isOver && active)) && "bg-indigo-100"
      )}
      style={{ height: heightPx, background: "#eef2ff" }}
    >
      <div className="editor-only absolute top-0.5 left-1.5 text-[9px] font-medium text-indigo-500 select-none pointer-events-none">
        Top area · {Math.round(shelf.topAreaMm)}mm
      </div>
      {topPlacements.map((p) => (
        <PlacedProductView key={p.instanceId} placement={p} />
      ))}
    </div>
  );
}
