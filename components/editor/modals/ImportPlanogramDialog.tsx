"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  Search,
  X,
  SlidersHorizontal,
  Loader2,
  ImageIcon,
  Layers,
  Package,
  Box,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { useEditorStore } from "@/lib/store/editorStore";
import {
  listPlanograms,
  listPlanogramBrands,
  listPlanogramCustomers,
  getPlanogramBySlug,
  type PlanogramListFilters,
} from "@/lib/planograms/actions";
import type { PlanogramSummary } from "@/lib/planograms/types";

interface FilterValues {
  q: string;
  customer: string;
  mainBrand: string;
  subBrand: string;
}

const EMPTY_FILTERS: FilterValues = {
  q: "",
  customer: "",
  mainBrand: "",
  subBrand: "",
};

function activeFilterCount(v: FilterValues): number {
  return (
    (v.q.trim() ? 1 : 0) + (v.customer ? 1 : 0) + (v.mainBrand ? 1 : 0) + (v.subBrand ? 1 : 0)
  );
}

export function ImportPlanogramDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const importFromPlanogram = useEditorStore((s) => s.importFromPlanogram);
  const currentPlanogramId = useEditorStore((s) => s.planogramId);

  const [filters, setFilters] = React.useState<FilterValues>(EMPTY_FILTERS);
  const [committedFilters, setCommittedFilters] = React.useState<PlanogramListFilters>({});
  const [planograms, setPlanograms] = React.useState<PlanogramSummary[]>([]);
  const [mainBrands, setMainBrands] = React.useState<string[]>([]);
  const [subBrands, setSubBrands] = React.useState<string[]>([]);
  const [customers, setCustomers] = React.useState<string[]>([]);
  const [isLoading, startLoadingTransition] = React.useTransition();
  const [importing, setImporting] = React.useState<string | null>(null);

  // Reset to fresh state every time the dialog opens (false → true) so
  // re-opening doesn't show stale data from the previous session.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFilters(EMPTY_FILTERS);
      setCommittedFilters({});
    }
  }

  // Load facet lists once per open (they don't depend on filters).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([listPlanogramBrands(), listPlanogramCustomers()]).then(([b, c]) => {
      if (cancelled) return;
      setMainBrands(b.mainBrands);
      setSubBrands(b.subBrands);
      setCustomers(c);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Re-fetch the planogram list whenever committed filters change.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    startLoadingTransition(async () => {
      const rows = await listPlanograms(committedFilters);
      if (cancelled) return;
      // Drop the currently-edited planogram from the picker — importing your
      // own data would just regenerate IDs without changing anything visible.
      setPlanograms(
        currentPlanogramId ? rows.filter((p) => p.planogramId !== currentPlanogramId) : rows,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, committedFilters, currentPlanogramId]);

  // Debounced text search → committed filters. Selects commit instantly.
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function commit(next: FilterValues) {
    setFilters(next);
    setCommittedFilters({
      q: next.q.trim() || undefined,
      customer: next.customer || undefined,
      mainBrand: next.mainBrand || undefined,
      subBrand: next.subBrand || undefined,
    });
  }
  function setSearch(q: string) {
    setFilters((cur) => ({ ...cur, q }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCommittedFilters((cur) => ({ ...cur, q: q.trim() || undefined }));
    }, 300);
  }

  async function handleImport(p: PlanogramSummary) {
    setImporting(p.planogramId);
    try {
      const record = await getPlanogramBySlug(p.tenantSlug, p.planogramSlug);
      if (!record) {
        toast.error("Source planogram could not be loaded.");
        return;
      }
      importFromPlanogram(record.planogramData);
      toast.success(`Imported from "${p.planogramName}"`, {
        description: `${record.planogramData.shelves.length} shelf unit(s), ${record.planogramData.placements.length} placement(s).`,
      });
      onClose();
    } catch (err) {
      toast.error("Import failed", { description: (err as Error).message });
    } finally {
      setImporting(null);
    }
  }

  const active = activeFilterCount(filters);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !importing && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>Import from existing planogram</DialogTitle>
          <DialogDescription>
            Pick a saved planogram. Its shelves and product placements will replace what&apos;s
            currently on the canvas — the planogram&apos;s name and customer stay the same.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3">
          <FilterBar
            values={filters}
            mainBrands={mainBrands}
            subBrands={subBrands}
            customers={customers}
            active={active}
            loading={isLoading}
            onSearchChange={setSearch}
            onCommit={commit}
            onReset={() => commit(EMPTY_FILTERS)}
          />
          <ActiveChips values={filters} onCommit={commit} />
        </div>

        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto px-6 pb-6 transition-opacity",
            isLoading && "opacity-60 pointer-events-none",
          )}
        >
          {planograms.length === 0 ? (
            <EmptyState
              filtered={active > 0}
              onReset={() => commit(EMPTY_FILTERS)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {planograms.map((p) => (
                <ImportCard
                  key={p.planogramId}
                  summary={p}
                  onImport={() => handleImport(p)}
                  importing={importing === p.planogramId}
                  anyImporting={importing !== null}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterBar({
  values,
  mainBrands,
  subBrands,
  customers,
  active,
  loading,
  onSearchChange,
  onCommit,
  onReset,
}: {
  values: FilterValues;
  mainBrands: string[];
  subBrands: string[];
  customers: string[];
  active: number;
  loading: boolean;
  onSearchChange: (q: string) => void;
  onCommit: (next: FilterValues) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Filters
        </span>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
        <div className="ml-auto">
          {active > 0 ? (
            <Button variant="ghost" size="sm" onClick={onReset} className="gap-1 text-slate-500">
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Search</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              value={values.q}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Name or customer…"
              className="pl-9 pr-8"
            />
            {values.q ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            ) : null}
          </div>
        </div>

        <FacetSelect
          label="Customer"
          value={values.customer}
          options={customers}
          onChange={(v) => onCommit({ ...values, customer: v })}
          emptyHint="No customers yet"
        />
        <FacetSelect
          label="Main brand"
          value={values.mainBrand}
          options={mainBrands}
          onChange={(v) => onCommit({ ...values, mainBrand: v })}
          emptyHint="No main brands yet"
        />
        <FacetSelect
          label="Sub brand"
          value={values.subBrand}
          options={subBrands}
          onChange={(v) => onCommit({ ...values, subBrand: v })}
          emptyHint="No sub brands yet"
        />
      </div>
    </div>
  );
}

function FacetSelect({
  label,
  value,
  options,
  onChange,
  emptyHint,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  emptyHint: string;
}) {
  const disabled = options.length === 0;
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">{disabled ? emptyHint : `All (${options.length})`}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ActiveChips({
  values,
  onCommit,
}: {
  values: FilterValues;
  onCommit: (next: FilterValues) => void;
}) {
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (values.q.trim()) {
    chips.push({
      key: "q",
      label: `Search: “${values.q.trim()}”`,
      clear: () => onCommit({ ...values, q: "" }),
    });
  }
  if (values.customer) {
    chips.push({
      key: "customer",
      label: `Customer: ${values.customer}`,
      clear: () => onCommit({ ...values, customer: "" }),
    });
  }
  if (values.mainBrand) {
    chips.push({
      key: "mainBrand",
      label: `Main brand: ${values.mainBrand}`,
      clear: () => onCommit({ ...values, mainBrand: "" }),
    });
  }
  if (values.subBrand) {
    chips.push({
      key: "subBrand",
      label: `Sub brand: ${values.subBrand}`,
      clear: () => onCommit({ ...values, subBrand: "" }),
    });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.clear}
          className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 hover:bg-indigo-100 transition"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
      <div className="text-sm text-slate-500">
        {filtered ? "No planograms match the current filters." : "No other planograms to import from yet."}
      </div>
      {filtered ? (
        <Button variant="ghost" size="sm" className="mt-3" onClick={onReset}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function ImportCard({
  summary: p,
  onImport,
  importing,
  anyImporting,
}: {
  summary: PlanogramSummary;
  onImport: () => void;
  importing: boolean;
  anyImporting: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col hover:border-indigo-300 hover:shadow-sm transition">
      <div className="aspect-[4/3] bg-slate-50 border-b border-slate-100 relative">
        {p.previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/planograms/preview/${p.previewImageUrl}`}
            alt={p.planogramName}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-slate-300">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <h3 className="text-sm font-medium text-slate-900 truncate">{p.planogramName}</h3>
          <div className="text-xs text-slate-500 truncate mt-0.5">{p.customerName}</div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3 w-3" /> {p.shelvesCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3" /> {p.productsCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Box className="h-3 w-3" /> {p.unitsCount}
          </span>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onImport}
          disabled={anyImporting}
          className="mt-1 gap-1.5"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {importing ? "Importing…" : "Import"}
        </Button>
      </div>
    </div>
  );
}
