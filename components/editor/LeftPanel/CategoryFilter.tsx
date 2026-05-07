"use client";
import * as React from "react";
import { Search, X } from "lucide-react";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export function CategoryFilter() {
  const products = useCatalogStore((s) => s.products);
  const search = useCatalogStore((s) => s.categorySearch);
  const setSearch = useCatalogStore((s) => s.setCategorySearch);
  const filter = useCatalogStore((s) => s.categoryFilter);
  const setFilter = useCatalogStore((s) => s.setCategoryFilter);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(p.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <SearchAndSelect
      search={search}
      onSearchChange={setSearch}
      placeholder="Search categories…"
      value={filter}
      onChange={setFilter}
      options={visible}
      emptyText={categories.length === 0 ? "No categories yet" : "No matches"}
    />
  );
}

/** Headerless body — wrap with CollapsibleSection in the parent. */
CategoryFilter.useCount = () => {
  const products = useCatalogStore((s) => s.products);
  return React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(p.category);
    return set.size;
  }, [products]);
};

interface SelectProps {
  search: string;
  onSearchChange: (v: string) => void;
  placeholder: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  emptyText: string;
}

export function SearchAndSelect({
  search,
  onSearchChange,
  placeholder,
  value,
  onChange,
  options,
  emptyText,
}: SelectProps) {
  return (
    <>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-7 pr-7 text-xs"
        />
        {search ? (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-slate-400" />
          </button>
        ) : null}
      </div>

      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <option value="">All ({options.length})</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      {options.length === 0 ? (
        <div className="text-xs text-slate-400 italic px-1">{emptyText}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.slice(0, 8).map((opt) => {
            const active = opt === value;
            return (
              <button
                key={opt}
                onClick={() => onChange(active ? null : opt)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                )}
              >
                {opt}
              </button>
            );
          })}
          {options.length > 8 ? (
            <span className="text-xs text-slate-400 px-1">+{options.length - 8} more</span>
          ) : null}
        </div>
      )}
    </>
  );
}
