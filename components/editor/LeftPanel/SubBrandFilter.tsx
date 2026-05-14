"use client";
import * as React from "react";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { SearchAndSelect } from "./CategoryFilter";

export function SubBrandFilter() {
  const products = useCatalogStore((s) => s.products);
  const categoryFilter = useCatalogStore((s) => s.categoryFilter);
  const brandFilter = useCatalogStore((s) => s.brandFilter);
  const search = useCatalogStore((s) => s.subBrandSearch);
  const setSearch = useCatalogStore((s) => s.setSubBrandSearch);
  const filter = useCatalogStore((s) => s.subBrandFilter);
  const setFilter = useCatalogStore((s) => s.setSubBrandFilter);

  // Sub-brands depend on category + brand selection — picking either narrows
  // the list, so the user only sees sub-brands that actually exist within the
  // currently-scoped products.
  const subBrands = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (categoryFilter && p.category !== categoryFilter) continue;
      if (brandFilter && p.mainBrand !== brandFilter) continue;
      if (p.subBrand) set.add(p.subBrand);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, categoryFilter, brandFilter]);

  React.useEffect(() => {
    if (filter && !subBrands.includes(filter)) setFilter(null);
  }, [subBrands, filter, setFilter]);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subBrands;
    return subBrands.filter((b) => b.toLowerCase().includes(q));
  }, [subBrands, search]);

  return (
    <SearchAndSelect
      search={search}
      onSearchChange={setSearch}
      placeholder="Search sub brands…"
      value={filter}
      onChange={setFilter}
      options={visible}
      emptyText={subBrands.length === 0 ? "No sub brands yet" : "No matches"}
    />
  );
}

SubBrandFilter.useCount = () => {
  const products = useCatalogStore((s) => s.products);
  const categoryFilter = useCatalogStore((s) => s.categoryFilter);
  const brandFilter = useCatalogStore((s) => s.brandFilter);
  return React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (categoryFilter && p.category !== categoryFilter) continue;
      if (brandFilter && p.mainBrand !== brandFilter) continue;
      if (p.subBrand) set.add(p.subBrand);
    }
    return set.size;
  }, [products, categoryFilter, brandFilter]);
};
