"use client";
import * as React from "react";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { cn } from "@/lib/cn";

export function BrandList() {
  const brands = useCatalogStore((s) => s.brands);
  const selectedBrandId = useCatalogStore((s) => s.selectedBrandId);
  const setSelectedBrand = useCatalogStore((s) => s.setSelectedBrand);

  return (
    <div className="px-3 py-3 border-b border-slate-100">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2 px-1">Brands</div>
      <div className="grid grid-cols-2 gap-1.5">
        {brands.map((b) => {
          const isActive = b.id === selectedBrandId;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBrand(b.id)}
              className={cn(
                "h-10 rounded-md text-xs font-semibold flex items-center justify-center transition-all border",
                isActive
                  ? "text-white shadow-sm scale-[1.02]"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
              style={
                isActive
                  ? { backgroundColor: b.color, borderColor: b.color }
                  : undefined
              }
            >
              {b.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
