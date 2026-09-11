"use client";
import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { Pencil, Image as ImageIcon } from "lucide-react";
import type { TenantProduct } from "@/lib/catalog/types";
import { brandAccentColor } from "@/lib/store/catalogStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

interface Props {
  product: TenantProduct;
  onEdit: () => void;
}

export function ProductCard({ product, onEdit }: Props) {
  const placeProduct = useEditorStore((s) => s.placeProductOnSelectedRow);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `product:${product.productId}`,
    data: { kind: "product", productId: product.productId },
  });

  const imageUrl = product.itemImageUrl ? `/api/catalog/image/${product.itemImageUrl}` : null;
  const dims = product.itemDimensions;
  const brandColor = brandAccentColor(product.mainBrand ?? "");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={() => {
            // Click drops it on the selected shelf; drag is still there for
            // aiming at a specific shelf and spot.
            if (!placeProduct(product.productId)) {
              toast.error("Add a shelf first");
            }
          }}
          title="Click to place on the selected shelf, or drag onto one"
          className={cn(
            "group relative rounded-lg border border-slate-200 bg-white p-2 hover:border-indigo-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing text-left",
            isDragging && "opacity-30"
          )}
        >
          <div className="aspect-square w-full bg-slate-50 rounded-md grid place-items-center mb-1.5 overflow-hidden">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={product.itemDescription}
                className="max-h-full max-w-full object-contain p-1.5 group-hover:scale-105 transition-transform"
                draggable={false}
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-slate-300" />
            )}
          </div>
          <div className="text-[10px] text-slate-400 truncate">{product.category}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: brandColor }}
            />
            <span className="text-[10px] text-slate-500 truncate">{product.subBrand ?? "—"}</span>
          </div>
          <div className="text-[11px] font-medium text-slate-700 leading-tight line-clamp-2 mt-0.5">
            {product.itemDescription}
          </div>
          {product.uom ? (
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">{product.uom}</div>
          ) : null}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-1 right-1 p-1 rounded bg-white/90 border border-slate-200 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-slate-50 hover:text-slate-900 transition-opacity shadow-sm"
            title="Edit product"
            aria-label="Edit product"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <div className="text-xs">
          <div className="font-semibold">{product.itemDescription}</div>
          <div className="opacity-80 mt-0.5">
            {product.mainBrand ?? "—"} · {product.category}
            {product.uom ? ` · ${product.uom}` : ""}
          </div>
          {dims ? (
            <div className="opacity-80 mt-0.5">
              {dims.widthMm / 10}×{dims.heightMm / 10}
              {dims.depthMm !== undefined ? `×${dims.depthMm / 10}` : ""}cm
            </div>
          ) : (
            <div className="opacity-60 mt-0.5">No dimensions set</div>
          )}
          <div className="opacity-60 mt-0.5">Drag onto a shelf to place</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
