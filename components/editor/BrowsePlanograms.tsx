"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { deletePlanogram } from "@/lib/planograms/actions";
import type { PlanogramSummary } from "@/lib/planograms/types";

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

export function BrowsePlanograms({ planograms }: { planograms: PlanogramSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return planograms;
    return planograms.filter(
      (p) =>
        p.planogramName.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q),
    );
  }, [planograms, query]);

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
            {planograms.length === 0
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

      <div className="relative mb-6 max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or customer…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="text-sm text-slate-500">
            {query ? "No planograms match that search." : "Nothing here yet."}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
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
