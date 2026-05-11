"use client";
import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { useEditorStore } from "@/lib/store/editorStore";
import { useCatalogStore, toEditorProduct } from "@/lib/store/catalogStore";
import { mmToPx } from "@/lib/units";
import { arrangementMetrics } from "@/lib/arrangement";
import type { PlacedProduct, Product } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  placement: PlacedProduct;
}

const SCALE_MIN = 0.2;
const SCALE_MAX = 5;

export function PlacedProductView({ placement }: Props) {
  const zoom = useEditorStore((s) => s.zoom);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const updatePlacement = useEditorStore((s) => s.updatePlacement);
  const togglePlacementSelection = useEditorStore((s) => s.togglePlacementSelection);
  const openContextMenu = useEditorStore((s) => s.openContextMenu);
  // Select the raw row (stable ref) and derive the editor-shape product
  // locally — `getProduct` returns a fresh object and would loop the snapshot.
  const rawProduct = useCatalogStore((s) =>
    s.products.find((p) => p.productId === placement.productId),
  );
  const product = React.useMemo(
    () => (rawProduct ? toEditorProduct(rawProduct) : undefined),
    [rawProduct],
  );
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `placement:${placement.instanceId}`,
    data: { kind: "placement", placementId: placement.instanceId },
  });

  if (!product) return null;

  // Independent X/Y scales — falls back to the legacy uniform `scale` so old
  // placements still render and resize correctly.
  const legacyScale = placement.scale ?? 1;
  const scaleX = placement.scaleX ?? legacyScale;
  const scaleY = placement.scaleY ?? legacyScale;

  const metrics = arrangementMetrics(product, placement.arrangement);
  const xMm = Math.max(0, placement.xMm);
  const yMm = Math.max(0, placement.yMm);
  const widthPx = mmToPx(metrics.totalWidthMm, zoom) * scaleX;
  const heightPx = mmToPx(metrics.totalHeightMm, zoom) * scaleY;

  const xPx = mmToPx(xMm, zoom);
  const bottomPx = mmToPx(yMm, zoom);

  const isSelected =
    selection.kind === "placement" && selection.ids.includes(placement.instanceId);
  const isPrimarySelected =
    selection.kind === "placement" &&
    selection.ids.length === 1 &&
    selection.ids[0] === placement.instanceId;

  const cellWPx = mmToPx(metrics.cellWidthMm, zoom) * scaleX;
  const cellHPx = mmToPx(metrics.cellHeightMm, zoom) * scaleY;
  const gapXPx = mmToPx(placement.arrangement.gapMm ?? 0, zoom) * scaleX;
  const gapYPx = mmToPx(placement.arrangement.gapMm ?? 0, zoom) * scaleY;

  const cells: { row: number; col: number }[] = [];
  for (let r = 0; r < metrics.rows; r++) {
    for (let c = 0; c < metrics.cols; c++) {
      cells.push({ row: r, col: c });
    }
  }

  // Edge handles change one axis only; corner handles change both axes
  // independently (so dragging diagonally lets you stretch width and height
  // simultaneously without locking aspect).
  type ProductHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

  function startScale(e: React.PointerEvent, handle: ProductHandle) {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const affectsX = handle === "e" || handle === "w" || handle === "ne" ||
      handle === "se" || handle === "nw" || handle === "sw";
    const affectsY = handle === "n" || handle === "s" || handle === "ne" ||
      handle === "se" || handle === "nw" || handle === "sw";

    const startDx = Math.abs(e.clientX - cx);
    const startDy = Math.abs(e.clientY - cy);
    const startScaleX = scaleX;
    const startScaleY = scaleY;

    function clamp(v: number): number {
      return Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
    }

    function onMove(ev: PointerEvent) {
      const patch: { scaleX?: number; scaleY?: number; scale?: undefined } = {};
      if (affectsX && startDx > 1) {
        const dx = Math.abs(ev.clientX - cx);
        patch.scaleX = Math.round(clamp(startScaleX * (dx / startDx)) * 100) / 100;
      }
      if (affectsY && startDy > 1) {
        const dy = Math.abs(ev.clientY - cy);
        patch.scaleY = Math.round(clamp(startScaleY * (dy / startDy)) * 100) / 100;
      }
      if (Object.keys(patch).length === 0) return;
      // Drop the legacy uniform `scale` once the user resizes — scaleX/scaleY
      // are now authoritative.
      patch.scale = undefined;
      updatePlacement(placement.instanceId, patch);
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
      ref={(node) => {
        setNodeRef(node);
        containerRef.current = node;
      }}
      data-placement-id={placement.instanceId}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        if (additive) {
          togglePlacementSelection(placement.instanceId);
        } else {
          select({ kind: "placement", ids: [placement.instanceId] });
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // If the right-clicked placement is already part of the selection,
        // keep the whole selection as the menu's targets. Otherwise make
        // this placement the single new selection.
        const currentIds =
          selection.kind === "placement" && selection.ids.includes(placement.instanceId)
            ? selection.ids
            : [placement.instanceId];
        if (!(selection.kind === "placement" && selection.ids.includes(placement.instanceId))) {
          select({ kind: "placement", ids: [placement.instanceId] });
        }
        openContextMenu({ x: e.clientX, y: e.clientY, placementIds: currentIds });
      }}
      className={cn(
        "absolute group cursor-grab active:cursor-grabbing transition-shadow",
        isSelected && "outline-2 outline outline-indigo-500 outline-offset-2 rounded-sm",
        isSelected && !isPrimarySelected && "outline-dashed",
        isDragging && "opacity-30"
      )}
      style={{
        left: xPx,
        bottom: bottomPx,
        width: widthPx,
        height: heightPx,
        transform: placement.rotationDeg ? `rotate(${placement.rotationDeg}deg)` : undefined,
        transformOrigin: "center center",
      }}
    >
      {cells.map(({ row: r, col }) => (
        <Cell
          key={`${r}-${col}`}
          product={product}
          left={col * (cellWPx + gapXPx)}
          top={r * (cellHPx + gapYPx)}
          width={cellWPx}
          height={cellHPx}
        />
      ))}

      <div className="editor-only absolute -top-2.5 -right-2.5 h-5 min-w-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold grid place-items-center shadow-sm tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
        ×{metrics.totalUnits}
      </div>

      {isPrimarySelected ? (
        <>
          {/* edges */}
          <EdgeHandle position="n" onPointerDown={(e) => startScale(e, "n")} />
          <EdgeHandle position="s" onPointerDown={(e) => startScale(e, "s")} />
          <EdgeHandle position="e" onPointerDown={(e) => startScale(e, "e")} />
          <EdgeHandle position="w" onPointerDown={(e) => startScale(e, "w")} />
          {/* corners */}
          <CornerHandle position="nw" onPointerDown={(e) => startScale(e, "nw")} />
          <CornerHandle position="ne" onPointerDown={(e) => startScale(e, "ne")} />
          <CornerHandle position="sw" onPointerDown={(e) => startScale(e, "sw")} />
          <CornerHandle position="se" onPointerDown={(e) => startScale(e, "se")} />
        </>
      ) : null}
    </div>
  );
}

function CornerHandle({
  position,
  onPointerDown,
}: {
  position: "nw" | "ne" | "sw" | "se";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cursor =
    position === "nw" || position === "se" ? "nwse-resize" : "nesw-resize";
  const offsets: Record<typeof position, React.CSSProperties> = {
    nw: { top: -5, left: -5 },
    ne: { top: -5, right: -5 },
    sw: { bottom: -5, left: -5 },
    se: { bottom: -5, right: -5 },
  };
  return (
    <div
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className="editor-only absolute h-2.5 w-2.5 rounded-sm bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50"
      style={{ ...offsets[position], cursor }}
    />
  );
}

function EdgeHandle({
  position,
  onPointerDown,
}: {
  position: "n" | "s" | "e" | "w";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const isHorizontal = position === "e" || position === "w";
  const cursor = isHorizontal ? "ew-resize" : "ns-resize";
  const base = "editor-only absolute rounded-sm bg-white border border-indigo-500 shadow-sm hover:bg-indigo-50";
  const sizing = isHorizontal ? "h-4 w-2" : "h-2 w-4";
  const offsets: Record<typeof position, React.CSSProperties> = {
    n: { top: -5, left: "50%", transform: "translateX(-50%)" },
    s: { bottom: -5, left: "50%", transform: "translateX(-50%)" },
    e: { right: -5, top: "50%", transform: "translateY(-50%)" },
    w: { left: -5, top: "50%", transform: "translateY(-50%)" },
  };
  return (
    <div
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={`${base} ${sizing}`}
      style={{ ...offsets[position], cursor }}
    />
  );
}

function Cell({
  product,
  left,
  top,
  width,
  height,
}: {
  product: Product;
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  return (
    <div className="absolute" style={{ left, top, width, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* object-fill (not object-contain) so the image fills the cell to the
          product's real-world width × height. Otherwise letterbox padding
          inside each cell looks like a vertical gap that doesn't respond to
          the arrangement gap setting. */}
      <img
        src={product.imageUrl}
        alt={product.name}
        className="product-image w-full h-full object-fill drop-shadow-sm"
        draggable={false}
      />
    </div>
  );
}
