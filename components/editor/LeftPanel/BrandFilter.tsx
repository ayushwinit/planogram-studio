"use client";
import * as React from "react";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { SearchAndSelect } from "./CategoryFilter";

export function BrandFilter() {
  const products = useCatalogStore((s) => s.products);
  const categoryFilter = useCatalogStore((s) => s.categoryFilter);
  const search = useCatalogStore((s) => s.brandSearch);
  const setSearch = useCatalogStore((s) => s.setBrandSearch);
  const filter = useCatalogStore((s) => s.brandFilter);
  const setFilter = useCatalogStore((s) => s.setBrandFilter);

  // Brands depend on category selection — picking a category narrows the brand list.
  const brands = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (categoryFilter && p.category !== categoryFilter) continue;
      set.add(p.brand);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, categoryFilter]);

  // If the previously-selected brand no longer exists in the narrowed set, clear it.
  React.useEffect(() => {
    if (filter && !brands.includes(filter)) setFilter(null);
  }, [brands, filter, setFilter]);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.toLowerCase().includes(q));
  }, [brands, search]);

  return (
    <SearchAndSelect
      search={search}
      onSearchChange={setSearch}
      placeholder="Search brands…"
      value={filter}
      onChange={setFilter}
      options={visible}
      emptyText={brands.length === 0 ? "No brands yet" : "No matches"}
    />
  );
}

/** Headerless body — wrap with CollapsibleSection in the parent. */
BrandFilter.useCount = () => {
  const products = useCatalogStore((s) => s.products);
  const categoryFilter = useCatalogStore((s) => s.categoryFilter);
  return React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (categoryFilter && p.category !== categoryFilter) continue;
      set.add(p.brand);
    }
    return set.size;
  }, [products, categoryFilter]);
};
