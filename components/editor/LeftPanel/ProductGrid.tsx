"use client";
import * as React from "react";
import { Search, X } from "lucide-react";
import { useCatalogStore } from "@/lib/store/catalogStore";
import type { TenantProduct } from "@/lib/catalog/types";
import { Input } from "@/components/ui/Input";
import { ProductCard } from "./ProductCard";

interface Props {
  onEdit: (p: TenantProduct) => void;
}

function useFilteredProducts(): TenantProduct[] {
  const products = useCatalogStore((s) => s.products);
  const categoryFilter = useCatalogStore((s) => s.categoryFilter);
  const brandFilter = useCatalogStore((s) => s.brandFilter);
  const search = useCatalogStore((s) => s.productSearch);

  return React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (brandFilter && p.brand !== brandFilter) return false;
      if (!q) return true;
      return (
        p.itemDescription.toLowerCase().includes(q) ||
        (p.itemCode?.toLowerCase().includes(q) ?? false) ||
        (p.barcode?.toLowerCase().includes(q) ?? false) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, categoryFilter, brandFilter, search]);
}

export function ProductGrid({ onEdit }: Props) {
  const search = useCatalogStore((s) => s.productSearch);
  const setSearch = useCatalogStore((s) => s.setProductSearch);
  const filtered = useFilteredProducts();

  return (
    <>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-9 pl-7 pr-7 text-sm"
        />
        {search ? (
          <button
            onClick={() => setSearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-slate-400" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3">
        {filtered.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-8">No matching products.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((p) => (
              <ProductCard key={p.productId} product={p} onEdit={() => onEdit(p)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Filtered count + total — for the section badge in the parent. */
ProductGrid.useCount = (): { filtered: number; total: number } => {
  const total = useCatalogStore((s) => s.products.length);
  const filtered = useFilteredProducts().length;
  return { filtered, total };
};
