"use client";
import * as React from "react";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { ProductCard } from "./ProductCard";

export function ProductGrid() {
  const selectedBrandId = useCatalogStore((s) => s.selectedBrandId);
  const allProducts = useCatalogStore((s) => s.products);
  const brands = useCatalogStore((s) => s.brands);

  const products = React.useMemo(() => {
    if (!selectedBrandId) return allProducts;
    return allProducts.filter((p) => p.brandId === selectedBrandId);
  }, [allProducts, selectedBrandId]);

  const brand = React.useMemo(
    () => (selectedBrandId ? brands.find((b) => b.id === selectedBrandId) : undefined),
    [brands, selectedBrandId]
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
          {brand ? `${brand.name} Products` : "Products"}
        </div>
        <div className="text-[10px] text-slate-400 tabular-nums">{products.length}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {products.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-8">No products in this brand.</div>
        ) : null}
      </div>
    </div>
  );
}
