"use client";
import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { useEditorStore } from "@/lib/store/editorStore";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { mmToPx } from "@/lib/units";
import { arrangementMetrics } from "@/lib/arrangement";
import type { PlacedProduct, Product } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  placement: PlacedProduct;
}

export function PlacedProductView({ placement }: Props) {
  const zoom = useEditorStore((s) => s.zoom);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const product = useCatalogStore((s) => s.getProduct(placement.productId));

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `placement:${placement.instanceId}`,
    data: { kind: "placement", placementId: placement.instanceId },
  });

  if (!product) return null;

  const metrics = arrangementMetrics(product, placement.arrangement);
  // x is left within the row; products sit on the row floor (bottom).
  // yMm is the offset above the floor (0 = sitting on the floor).
  const xMm = Math.max(0, placement.xMm);
  const yMm = Math.max(0, placement.yMm);
  const widthPx = mmToPx(metrics.totalWidthMm, zoom);
  const heightPx = mmToPx(metrics.totalHeightMm, zoom);

  const xPx = mmToPx(xMm, zoom);
  // Anchor to the row's bottom: bottom of placement = yMm above the floor.
  const bottomPx = mmToPx(yMm, zoom);

  const isSelected = selection.kind === "placement" && selection.id === placement.instanceId;

  const cellWPx = mmToPx(metrics.cellWidthMm, zoom);
  const cellHPx = mmToPx(metrics.cellHeightMm, zoom);
  const gapPx = mmToPx(placement.arrangement.gapMm ?? 0, zoom);

  const cells: { row: number; col: number }[] = [];
  for (let r = 0; r < metrics.rows; r++) {
    for (let c = 0; c < metrics.cols; c++) {
      cells.push({ row: r, col: c });
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "placement", id: placement.instanceId });
      }}
      className={cn(
        "absolute group cursor-grab active:cursor-grabbing transition-shadow",
        isSelected && "outline-2 outline outline-indigo-500 outline-offset-2 rounded-sm",
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
          left={col * (cellWPx + gapPx)}
          top={r * (cellHPx + gapPx)}
          width={cellWPx}
          height={cellHPx}
        />
      ))}

      <div className="editor-only absolute -top-2.5 -right-2.5 h-5 min-w-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold grid place-items-center shadow-sm tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
        ×{metrics.totalUnits}
      </div>
    </div>
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
      <img
        src={product.imageUrl}
        alt={product.name}
        className="product-image w-full h-full object-contain drop-shadow-sm"
        draggable={false}
      />
    </div>
  );
}
