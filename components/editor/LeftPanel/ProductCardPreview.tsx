"use client";
import * as React from "react";
import type { Product } from "@/lib/types";

export function ProductCardPreview({ product }: { product: Product }) {
  return (
    <div className="rounded-lg border border-indigo-300 bg-white shadow-lg p-2 w-32 select-none">
      <div className="aspect-square w-full bg-slate-50 rounded-md grid place-items-center mb-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.imageUrl} alt={product.name} className="max-h-full max-w-full object-contain p-2" draggable={false} />
      </div>
      <div className="text-[11px] font-medium text-slate-700 leading-tight line-clamp-2">{product.name}</div>
    </div>
  );
}
