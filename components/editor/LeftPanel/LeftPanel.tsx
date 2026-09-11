"use client";
import * as React from "react";
import { Plus, Package } from "lucide-react";
import { useCatalogStore } from "@/lib/store/catalogStore";
import type { TenantProduct } from "@/lib/catalog/types";
import { Button } from "@/components/ui/Button";
import { CatalogItemDialog } from "../catalog/CatalogItemDialog";
import { CategoryFilter } from "./CategoryFilter";
import { BrandFilter } from "./BrandFilter";
import { SubBrandFilter } from "./SubBrandFilter";
import { ProductGrid } from "./ProductGrid";
import { CollapsibleSection } from "./CollapsibleSection";

export function LeftPanel() {
  const loaded = useCatalogStore((s) => s.loaded);
  const total = useCatalogStore((s) => s.products.length);

  // Hooks must run unconditionally on every render — call them at the top
  // even when no records exist, so the hook count stays stable when the
  // catalog transitions from loading → empty → populated.
  const categoryCount = CategoryFilter.useCount();
  const brandCount = BrandFilter.useCount();
  const subBrandCount = SubBrandFilter.useCount();
  const productsCount = ProductGrid.useCount();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantProduct | null>(null);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: TenantProduct) {
    setEditing(p);
    setDialogOpen(true);
  }

  return (
    <aside className="h-full bg-white border-r border-slate-200 flex flex-col">
      <div className="px-3 h-11 shrink-0 flex items-center gap-2 border-b border-slate-100">
        <Package className="h-4 w-4 text-slate-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catalog</h2>
        <span className="text-[10px] text-slate-400 tabular-nums">{loaded ? total : ""}</span>
        <div className="ml-auto">
          <Button
            size="icon-sm"
            variant="primary"
            onClick={openAdd}
            title="Add product"
            aria-label="Add product"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!loaded ? (
        <div className="flex-1 grid place-items-center text-xs text-slate-400">Loading catalog…</div>
      ) : total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-slate-100 grid place-items-center">
            <Package className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-700">No records</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Click <span className="font-semibold text-indigo-600">+</span> above to add your first product.
            </div>
          </div>
          <Button size="sm" variant="primary" onClick={openAdd} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add product
          </Button>
        </div>
      ) : (
        <>
          {/* One header instead of three — the filters are used occasionally,
              the product grid is used constantly, so it gets the space. */}
          <CollapsibleSection title="Filters" defaultOpen={false}>
            {/* Capped so opening filters on a long catalog can never push the
                product grid off the bottom of the panel. */}
            <div className="max-h-[40vh] overflow-y-auto space-y-3 -mx-1 px-1">
              <FilterGroup label={`Main brands (${brandCount})`}>
                <BrandFilter />
              </FilterGroup>
              <FilterGroup label={`Sub brands (${subBrandCount})`}>
                <SubBrandFilter />
              </FilterGroup>
              <FilterGroup label={`Categories (${categoryCount})`}>
                <CategoryFilter />
              </FilterGroup>
            </div>
          </CollapsibleSection>
          <CollapsibleSection
            title="Products"
            count={productsCount.filtered === productsCount.total ? productsCount.filtered : undefined}
            defaultOpen
            fillRemaining
          >
            <ProductGrid onEdit={openEdit} />
          </CollapsibleSection>
        </>
      )}

      <CatalogItemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />
    </aside>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
        {label}
      </div>
      {children}
    </div>
  );
}
