"use client";
import * as React from "react";
import { BrandList } from "./BrandList";
import { ProductGrid } from "./ProductGrid";
import { Package } from "lucide-react";

export function LeftPanel() {
  return (
    <aside className="h-full bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 h-11 shrink-0 flex items-center gap-2 border-b border-slate-100">
        <Package className="h-4 w-4 text-slate-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catalog</h2>
      </div>
      <BrandList />
      <ProductGrid />
    </aside>
  );
}
