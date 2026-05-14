"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Layers,
  Package,
  Box,
  Trash2,
  ImageIcon,
  Calendar,
  X,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { deletePlanogram } from "@/lib/planograms/actions";
import type { PlanogramSummary } from "@/lib/planograms/types";
import { cn } from "@/lib/cn";

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

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function buildQueryString(values: FilterValues): string {
  const params = new URLSearchParams();
  if (values.q.trim()) params.set("q", values.q.trim());
  if (values.customer) params.set("customer", values.customer);
  if (values.mainBrand) params.set("mainBrand", values.mainBrand);
  if (values.subBrand) params.set("subBrand", values.subBrand);
  const s = params.toString();
  return s ? `?${s}` : "";
}

function activeFilterCount(values: FilterValues): number {
  let n = 0;
  if (values.q.trim()) n++;
  if (values.customer) n++;
  if (values.mainBrand) n++;
  if (values.subBrand) n++;
  return n;
}

export function BrowsePlanograms({
  planograms,
  availableMainBrands,
  availableSubBrands,
  availableCustomers,
  initialFilters,
}: {
  planograms: PlanogramSummary[];
  availableMainBrands: string[];
  availableSubBrands: string[];
  availableCustomers: string[];
  initialFilters: FilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  // Local mirror of the URL state so the inputs can be controlled. We keep
  // this in sync with `initialFilters` (driven by the URL) so back/forward
  // navigation feels right.
  const [filters, setFilters] = React.useState<FilterValues>(initialFilters);
  const initialSig = React.useRef(JSON.stringify(initialFilters));
  React.useEffect(() => {
    const sig = JSON.stringify(initialFilters);
    if (sig !== initialSig.current) {
      initialSig.current = sig;
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const pushFilters = React.useCallback(
    (next: FilterValues) => {
      const qs = buildQueryString(next);
      startTransition(() => {
        router.replace(`${pathname}${qs}`, { scroll: false });
      });
    },
    [pathname, router],
  );

  // The text search is debounced so we don't refetch on every keystroke.
  // Selects + dates apply instantly via `commitFilters`. `filtersRef` keeps
  // the latest non-q filter state visible inside the debounced setTimeout
  // closure (which otherwise captures whatever state was current when the
  // timer was scheduled).
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = React.useRef(filters);
  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  React.useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function commitFilters(next: FilterValues) {
    setFilters(next);
    pushFilters(next);
  }
  function setQDebounced(q: string) {
    setFilters((cur) => ({ ...cur, q }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushFilters({ ...filtersRef.current, q });
    }, 300);
  }

  function resetAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commitFilters(EMPTY_FILTERS);
  }

  const activeCount = activeFilterCount(filters);

  async function handleDelete(p: PlanogramSummary) {
    if (!confirm(`Delete "${p.planogramName}"? This cannot be undone.`)) return;
    setPendingDelete(p.planogramId);
    const res = await deletePlanogram(p.planogramId);
    setPendingDelete(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Planogram deleted");
    router.refresh();
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <header className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Planograms</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount > 0
              ? `${planograms.length} match${planograms.length === 1 ? "" : "es"} · ${activeCount} filter${activeCount === 1 ? "" : "s"} active`
              : planograms.length === 0
              ? "No planograms yet — create your first one."
              : `${planograms.length} saved planogram${planograms.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="ml-auto">
          <Button asChild variant="primary" className="gap-1.5">
            <Link href="/editor/new">
              <Plus className="h-4 w-4" /> New Planogram
            </Link>
          </Button>
        </div>
      </header>

      <FilterBar
        values={filters}
        availableMainBrands={availableMainBrands}
        availableSubBrands={availableSubBrands}
        availableCustomers={availableCustomers}
        activeCount={activeCount}
        onSearchChange={setQDebounced}
        onCommit={commitFilters}
        onReset={resetAll}
        isPending={isPending}
      />

      <ActiveChips values={filters} onCommit={commitFilters} />

      <div
        className={cn(
          "transition-opacity",
          isPending && "opacity-60 pointer-events-none",
        )}
      >
        {planograms.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
            <div className="text-sm text-slate-500">
              {activeCount > 0
                ? "No planograms match the current filters."
                : "Nothing here yet."}
            </div>
            {activeCount > 0 ? (
              <Button variant="ghost" size="sm" className="mt-3" onClick={resetAll}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {planograms.map((p) => (
              <PlanogramCard
                key={p.planogramId}
                summary={p}
                onDelete={() => handleDelete(p)}
                deleting={pendingDelete === p.planogramId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBar({
  values,
  availableMainBrands,
  availableSubBrands,
  availableCustomers,
  activeCount,
  onSearchChange,
  onCommit,
  onReset,
  isPending,
}: {
  values: FilterValues;
  availableMainBrands: string[];
  availableSubBrands: string[];
  availableCustomers: string[];
  activeCount: number;
  onSearchChange: (q: string) => void;
  onCommit: (next: FilterValues) => void;
  onReset: () => void;
  isPending: boolean;
}) {
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm p-3">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Filters
        </span>
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        ) : null}
        <div className="ml-auto">
          {activeCount > 0 ? (
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

        <BrandSelect
          label="Customer"
          value={values.customer}
          options={availableCustomers}
          onChange={(v) => onCommit({ ...values, customer: v })}
          emptyHint="No customers yet"
        />

        <BrandSelect
          label="Main brand"
          value={values.mainBrand}
          options={availableMainBrands}
          onChange={(v) => onCommit({ ...values, mainBrand: v })}
          emptyHint="No main brands yet"
        />

        <BrandSelect
          label="Sub brand"
          value={values.subBrand}
          options={availableSubBrands}
          onChange={(v) => onCommit({ ...values, subBrand: v })}
          emptyHint="No sub brands yet"
        />
      </div>
    </div>
  );
}

function BrandSelect({
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
  const chips: Array<{ key: keyof FilterValues; label: string; clear: () => void }> = [];
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
    <div className="flex flex-wrap gap-1.5 mb-4">
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

function PlanogramCard({
  summary: p,
  onDelete,
  deleting,
}: {
  summary: PlanogramSummary;
  onDelete: () => void;
  deleting: boolean;
}) {
  const href = `/editor/${p.tenantSlug}/${p.planogramSlug}`;
  return (
    <div className="group rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-indigo-200 transition">
      <Link href={href} className="block aspect-[4/3] bg-slate-50 border-b border-slate-100 relative">
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
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
      </Link>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <Link href={href} className="block">
          <h3 className="font-medium text-slate-900 truncate">{p.planogramName}</h3>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            {p.customerName}
          </div>
        </Link>

        <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> {p.shelvesCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Package className="h-3.5 w-3.5" /> {p.productsCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Box className="h-3.5 w-3.5" /> {p.unitsCount}
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> {formatRelative(p.updatedAt)}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-2 mt-auto border-t border-slate-100">
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link href={href}>Open</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Delete planogram"
          >
            <Trash2 className="h-4 w-4 text-rose-600" />
          </Button>
        </div>
      </div>
    </div>
  );
}
