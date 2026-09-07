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
  Folder,
  FolderPlus,
  Home,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { deletePlanogram } from "@/lib/planograms/actions";
import type { PlanogramSummary } from "@/lib/planograms/types";
import {
  createFolder,
  deleteFolder,
  renameFolder,
  countFolderContents,
} from "@/lib/folders/actions";
import type { FolderCrumb, FolderSummary } from "@/lib/folders/types";
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

function buildQueryString(values: FilterValues, folderId: string | null): string {
  const params = new URLSearchParams();
  if (folderId) params.set("folder", folderId);
  if (values.q.trim()) params.set("q", values.q.trim());
  if (values.customer) params.set("customer", values.customer);
  if (values.mainBrand) params.set("mainBrand", values.mainBrand);
  if (values.subBrand) params.set("subBrand", values.subBrand);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Link to a folder view, dropping any active filters so the folder opens clean. */
function folderHref(folderId: string | null): string {
  return folderId ? `/editor/browse?folder=${folderId}` : "/editor/browse";
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
  folders,
  breadcrumb,
  currentFolderId,
  searchingAllFolders,
  availableMainBrands,
  availableSubBrands,
  availableCustomers,
  initialFilters,
}: {
  planograms: PlanogramSummary[];
  folders: FolderSummary[];
  breadcrumb: FolderCrumb[];
  currentFolderId: string | null;
  searchingAllFolders: boolean;
  availableMainBrands: string[];
  availableSubBrands: string[];
  availableCustomers: string[];
  initialFilters: FilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const [pendingFolder, setPendingFolder] = React.useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = React.useState(false);

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
      const qs = buildQueryString(next, currentFolderId);
      startTransition(() => {
        router.replace(`${pathname}${qs}`, { scroll: false });
      });
    },
    [pathname, router, currentFolderId],
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

  async function handleCreateFolder() {
    const name = prompt("New folder name");
    if (!name?.trim()) return;
    setCreatingFolder(true);
    const fd = new FormData();
    fd.set("folderName", name.trim());
    if (currentFolderId) fd.set("parentFolderId", currentFolderId);
    const res = await createFolder(fd);
    setCreatingFolder(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Folder created");
    router.refresh();
  }

  async function handleRenameFolder(f: FolderSummary) {
    const name = prompt("Rename folder", f.folderName);
    if (!name?.trim() || name.trim() === f.folderName) return;
    setPendingFolder(f.folderId);
    const res = await renameFolder(f.folderId, name.trim());
    setPendingFolder(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Folder renamed");
    router.refresh();
  }

  async function handleDeleteFolder(f: FolderSummary) {
    setPendingFolder(f.folderId);
    // Count the whole subtree, not just direct children, so the warning is honest.
    const { folders: subFolders, planograms: subPlanograms } = await countFolderContents(
      f.folderId,
    );
    const parts: string[] = [];
    if (subFolders > 0) parts.push(`${subFolders} subfolder${subFolders === 1 ? "" : "s"}`);
    if (subPlanograms > 0)
      parts.push(`${subPlanograms} planogram${subPlanograms === 1 ? "" : "s"}`);
    const detail = parts.length ? `\n\nThis also deletes ${parts.join(" and ")}.` : "";
    if (!confirm(`Delete folder "${f.folderName}"?${detail}\n\nThis cannot be undone.`)) {
      setPendingFolder(null);
      return;
    }
    const res = await deleteFolder(f.folderId);
    setPendingFolder(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Folder deleted");
    router.refresh();
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Breadcrumb trail={breadcrumb} />

      <header className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {breadcrumb.length > 0
              ? breadcrumb[breadcrumb.length - 1].folderName
              : "Planograms"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount > 0
              ? `${planograms.length} match${planograms.length === 1 ? "" : "es"} · ${activeCount} filter${activeCount === 1 ? "" : "s"} active${searchingAllFolders ? " · searching all folders" : ""}`
              : planograms.length === 0 && folders.length === 0
              ? "Nothing here yet — create a folder or a planogram."
              : `${folders.length} folder${folders.length === 1 ? "" : "s"} · ${planograms.length} planogram${planograms.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleCreateFolder}
            disabled={creatingFolder}
          >
            <FolderPlus className="h-4 w-4" /> New Folder
          </Button>
          <Button asChild variant="primary" className="gap-1.5">
            <Link
              href={
                currentFolderId ? `/editor/new?folder=${currentFolderId}` : "/editor/new"
              }
            >
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
        {folders.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Folders
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {folders.map((f) => (
                <FolderCard
                  key={f.folderId}
                  folder={f}
                  busy={pendingFolder === f.folderId}
                  onRename={() => handleRenameFolder(f)}
                  onDelete={() => handleDeleteFolder(f)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {planograms.length === 0 ? (
          folders.length === 0 || activeCount > 0 ? (
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
          ) : null
        ) : (
          <div>
            {folders.length > 0 ? (
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Planograms
              </h2>
            ) : null}
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
          </div>
        )}
      </div>
    </div>
  );
}

function Breadcrumb({ trail }: { trail: FolderCrumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-slate-500 mb-3 flex-wrap">
      <Link
        href={folderHref(null)}
        className="inline-flex items-center gap-1 hover:text-indigo-600 transition"
      >
        <Home className="h-3.5 w-3.5" /> All planograms
      </Link>
      {trail.map((c, i) => (
        <React.Fragment key={c.folderId}>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          {i === trail.length - 1 ? (
            <span className="text-slate-900 font-medium">{c.folderName}</span>
          ) : (
            <Link href={folderHref(c.folderId)} className="hover:text-indigo-600 transition">
              {c.folderName}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

function FolderCard({
  folder: f,
  busy,
  onRename,
  onDelete,
}: {
  folder: FolderSummary;
  busy: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  const bits: string[] = [];
  if (f.subfolderCount > 0)
    bits.push(`${f.subfolderCount} folder${f.subfolderCount === 1 ? "" : "s"}`);
  bits.push(`${f.planogramCount} planogram${f.planogramCount === 1 ? "" : "s"}`);

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white shadow-sm px-3 py-3 hover:shadow-md hover:border-indigo-200 transition">
      <Link href={folderHref(f.folderId)} className="flex items-center gap-3 min-w-0 flex-1">
        <span className="grid place-items-center h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
          <Folder className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-slate-900 truncate">{f.folderName}</span>
          <span className="block text-xs text-slate-500 truncate">{bits.join(" · ")}</span>
        </span>
      </Link>
      <div className="flex items-center gap-0.5 shrink-0">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        <Button size="sm" variant="ghost" onClick={onRename} disabled={busy} aria-label="Rename folder">
          <Pencil className="h-4 w-4 text-slate-500" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy} aria-label="Delete folder">
          <Trash2 className="h-4 w-4 text-rose-600" />
        </Button>
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
