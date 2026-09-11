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

/** Widest the catalog grid ever gets. Beyond five the cards stop being a quick
 *  visual scan and the panel is stealing space from the canvas. */
const MAX_COLUMNS = 5;

function useFilteredProducts(): TenantProduct[] {
  const products = useCatalogStore((s) => s.products);
  const categoryFilter = useCatalogStore((s) => s.categoryFilter);
  const brandFilter = useCatalogStore((s) => s.brandFilter);
  const subBrandFilter = useCatalogStore((s) => s.subBrandFilter);
  const search = useCatalogStore((s) => s.productSearch);

  return React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (brandFilter && p.mainBrand !== brandFilter) return false;
      if (subBrandFilter && p.subBrand !== subBrandFilter) return false;
      if (!q) return true;
      return (
        p.itemDescription.toLowerCase().includes(q) ||
        (p.itemCode?.toLowerCase().includes(q) ?? false) ||
        (p.barcode?.toLowerCase().includes(q) ?? false) ||
        (p.mainBrand?.toLowerCase().includes(q) ?? false) ||
        (p.subBrand?.toLowerCase().includes(q) ?? false) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, categoryFilter, brandFilter, subBrandFilter, search]);
}

export function ProductGrid({ onEdit }: Props) {
  const search = useCatalogStore((s) => s.productSearch);
  const setSearch = useCatalogStore((s) => s.setProductSearch);
  const filtered = useFilteredProducts();

  return (
    <>
      <div className="relative sticky top-0 z-10 bg-white py-1 -my-1">
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

      <div>
        {filtered.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-8">No matching products.</div>
        ) : (
          <div
            className="grid gap-2"
            /* auto-fill rather than a fixed column count: widening the panel
               fits 3, 4, then 5 cards per row instead of just stretching two.
               Five is the ceiling — past that the cards would start growing
               again, so the columns simply get wider. */
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(max(104px, ${100 / MAX_COLUMNS}%), 1fr))`,
            }}
          >
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
