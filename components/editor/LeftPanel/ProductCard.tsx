"use client";
import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Product } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `product:${product.id}`,
    data: { kind: "product", productId: product.id },
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          className={cn(
            "group relative rounded-lg border border-slate-200 bg-white p-2 hover:border-indigo-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing text-left",
            isDragging && "opacity-30"
          )}
        >
          <div className="aspect-square w-full bg-slate-50 rounded-md grid place-items-center mb-1.5 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-h-full max-w-full object-contain p-1.5 group-hover:scale-105 transition-transform"
              draggable={false}
            />
          </div>
          <div className="text-[11px] font-medium text-slate-700 leading-tight line-clamp-2">
            {product.name}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{product.sku}</div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <div className="text-xs">
          <div className="font-semibold">{product.name}</div>
          <div className="opacity-80 mt-0.5">{product.widthMm}×{product.heightMm}×{product.depthMm}mm</div>
          <div className="opacity-60 mt-0.5">Drag onto a shelf to place</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
