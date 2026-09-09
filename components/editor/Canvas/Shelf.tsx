"use client";
import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Wand2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { mmToPx, pxToMm } from "@/lib/units";
import type { RowSlot, Shelf as ShelfModel, ShelfRow as ShelfRowModel } from "@/lib/types";
import { rowTopOffsetMm, shelfTotalHeightMm } from "@/lib/shelfGeometry";
import { PlacedProductView } from "./PlacedProductView";
import { cn } from "@/lib/cn";

interface Props {
  shelf: ShelfModel;
}

export function Shelf({ shelf }: Props) {
  const zoom = useEditorStore((s) => s.zoom);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const updateShelf = useEditorStore((s) => s.updateShelf);
  const setShelfTotalHeight = useEditorStore((s) => s.setShelfTotalHeight);
  const autoFitShelf = useEditorStore((s) => s.autoFitShelf);

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

  type ShelfHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

  function startResize(e: React.PointerEvent, edge: ShelfHandle) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = shelf.widthMm;
    const startH = totalHeightMm;
    const startXMm = shelf.xMm;
    const startYMm = shelf.yMm;
    const movesWestEdge = edge === "w" || edge === "nw" || edge === "sw";
    const movesEastEdge = edge === "e" || edge === "ne" || edge === "se";
    const movesNorthEdge = edge === "n" || edge === "ne" || edge === "nw";
    const movesSouthEdge = edge === "s" || edge === "se" || edge === "sw";

    function onMove(ev: PointerEvent) {
      const dxMm = pxToMm(ev.clientX - startX, zoom);
      const dyMm = pxToMm(ev.clientY - startY, zoom);

      const widthPatch: Partial<ShelfModel> = {};
      if (movesEastEdge) widthPatch.widthMm = Math.max(20, startW + dxMm);
      if (movesWestEdge) {
        widthPatch.widthMm = Math.max(20, startW - dxMm);
        widthPatch.xMm = startXMm + dxMm;
      }

      let nextHeightMm: number | null = null;
      if (movesSouthEdge) nextHeightMm = Math.max(20, startH + dyMm);
      if (movesNorthEdge) {
        nextHeightMm = Math.max(20, startH - dyMm);
        widthPatch.yMm = startYMm + dyMm;
      }

      if (ev.shiftKey) {
        if (widthPatch.widthMm) widthPatch.widthMm = Math.round(widthPatch.widthMm / 10) * 10;
        if (widthPatch.xMm !== undefined) widthPatch.xMm = Math.round(widthPatch.xMm / 10) * 10;
        if (widthPatch.yMm !== undefined) widthPatch.yMm = Math.round(widthPatch.yMm / 10) * 10;
        if (nextHeightMm !== null) nextHeightMm = Math.round(nextHeightMm / 10) * 10;
      }

      if (Object.keys(widthPatch).length > 0) updateShelf(shelf.id, widthPatch);
      if (nextHeightMm !== null) setShelfTotalHeight(shelf.id, nextHeightMm);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // The body uses content-box so the border surrounds the inner content (where
  // rows live) without overlapping it on the right edge. The wrapper grows by
  // 2*borderWidth on each axis so the resize handles still anchor to the
  // visible outer edge.
  const bw = shelf.borderWidthPx;
  const wrapperWidthPx = widthPx + bw * 2;
  const wrapperHeightPx = heightPx + bw * 2;

  return (
    <div
      onPointerDown={(e) => {
        // Anywhere on the wrapper that isn't a row/handle drags the shelf.
        if (e.target !== e.currentTarget) return;
        startMove(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "shelf", id: shelf.id });
      }}
      className={cn(
        "absolute cursor-grab active:cursor-grabbing transition-shadow"
      )}
      style={{
        left: xPx,
        top: yPx,
        width: wrapperWidthPx,
        height: wrapperHeightPx,
        background: shelf.backgroundColor,
        border: `${bw}px solid ${shelf.borderColor}`,
        borderRadius: 4,
        boxSizing: "content-box",
      }}
    >
      {/* Inline label badge — purely informational, never grabs events. */}
      <div
        className="editor-only absolute -top-5 left-0 px-1.5 h-4 flex items-center text-[10px] font-medium text-slate-500 tabular-nums select-none pointer-events-none"
      >
        <span>{shelf.label ?? "Shelf unit"}</span>
        <span className="opacity-60 ml-1">· {Math.round(shelf.widthMm)}mm</span>
      </div>

      {/* Auto-fit — one click tidies every row of this shelf. Sits on the label
          rail so it never covers the shelf surface or a placement. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          autoFitShelf(shelf.id);
        }}
        className="editor-only absolute -top-5 right-0 h-4 px-1.5 flex items-center gap-1 rounded border border-slate-300 bg-white text-[10px] font-medium text-slate-600 shadow-sm hover:border-indigo-400 hover:text-indigo-600"
        title="Auto-fit: resize and align every product on this shelf (unit counts unchanged)"
      >
        <Wand2 className="h-2.5 w-2.5" />
        Auto-fit
      </button>

      {/* Top placement area */}
      {shelf.topAreaMm > 0 ? (
        <TopArea shelf={shelf} onShelfPointerDown={startMove} />
      ) : null}

      {/* Rows */}
      {shelf.rows.map((row) => (
        <Row key={row.id} shelf={shelf} row={row} onShelfPointerDown={startMove} />
      ))}

      {/* MS-Word-style 8 selection handles. */}
      {isSelected ? (
        <>
          {/* edges */}
          <div
            onPointerDown={(e) => startResize(e, "w")}
            onClick={(e) => e.stopPropagation()}
            className="editor-only absolute top-1/2 -translate-y-1/2 h-6 w-2.5 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ left: -6, cursor: "ew-resize" }}
          />
          <div
            onPointerDown={(e) => startResize(e, "e")}
            onClick={(e) => e.stopPropagation()}
            className="editor-only absolute top-1/2 -translate-y-1/2 h-6 w-2.5 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ right: -6, cursor: "ew-resize" }}
          />
          <div
            onPointerDown={(e) => startResize(e, "n")}
            onClick={(e) => e.stopPropagation()}
            className="editor-only absolute left-1/2 -translate-x-1/2 h-2.5 w-6 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ top: -6, cursor: "ns-resize" }}
          />
          <div
            onPointerDown={(e) => startResize(e, "s")}
            onClick={(e) => e.stopPropagation()}
            className="editor-only absolute left-1/2 -translate-x-1/2 h-2.5 w-6 rounded bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ bottom: -6, cursor: "ns-resize" }}
          />
          {/* corners */}
          <div
            onPointerDown={(e) => startResize(e, "nw")}
            onClick={(e) => e.stopPropagation()}
            className="editor-only absolute h-3 w-3 rounded-sm bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ top: -6, left: -6, cursor: "nwse-resize" }}
          />
          <div
            onPointerDown={(e) => startResize(e, "ne")}
            onClick={(e) => e.stopPropagation()}
            className="editor-only absolute h-3 w-3 rounded-sm bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ top: -6, right: -6, cursor: "nesw-resize" }}
          />
          <div
            onPointerDown={(e) => startResize(e, "sw")}
            onClick={(e) => e.stopPropagation()}
            className="editor-only absolute h-3 w-3 rounded-sm bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ bottom: -6, left: -6, cursor: "nesw-resize" }}
          />
          <div
            onPointerDown={(e) => startResize(e, "se")}
            onClick={(e) => e.stopPropagation()}
            className="editor-only absolute h-3 w-3 rounded-sm bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
            style={{ bottom: -6, right: -6, cursor: "nwse-resize" }}
          />
        </>
      ) : null}

      {/* Selection ring — drawn after handles so it sits behind them but on top of body. */}
      {isSelected ? (
        <div
          className="absolute inset-0 pointer-events-none rounded ring-2 ring-indigo-500"
        />
      ) : null}
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
