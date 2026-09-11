"use client";
import * as React from "react";
import { AlertTriangle, Check, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { useEditorStore, MAX_INNER_SHELVES_LIMIT } from "@/lib/store/editorStore";
import { matchProductName, parseShelfLines } from "@/lib/catalog/matchProductName";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Seeded with the shelves already on the canvas so the user edits what's
 *  there rather than starting from a blank box. */
function seedText(rowLabels: string[]): string {
  const labels = rowLabels.length > 0 ? rowLabels : ["Shelf 1"];
  return labels.map((l) => `${l}: `).join("\n");
}

export function TypeShelvesDialog({ open, onClose }: Props) {
  const catalog = useCatalogStore((s) => s.products);
  const applyShelfPlan = useEditorStore((s) => s.applyShelfPlan);
  // Select the rows array (stable reference) and map outside the selector — a
  // selector that builds a new array every call makes useSyncExternalStore loop
  // and takes the whole editor page down.
  const rows = useEditorStore((s) => s.planogram.shelves[0]?.rows);
  const rowLabels = React.useMemo(
    () => (rows ?? []).map((r, i) => r.label ?? `Shelf ${i + 1}`),
    [rows],
  );

  const [text, setText] = React.useState("");

  // Re-seed each time it opens, so it reflects the current shelves.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setText(seedText(rowLabels));
  }

  // Live preview: every line resolved against the catalog as it's typed, so
  // typos surface before the shelf is built rather than after.
  const parsed = React.useMemo(() => {
    return parseShelfLines(text).map((line) => ({
      ...line,
      matches: line.names.map((n) => matchProductName(n, catalog)),
    }));
  }, [text, catalog]);

  const resolved = parsed.reduce((n, l) => n + l.matches.filter((m) => m.product).length, 0);
  const failed = parsed.flatMap((l) => l.matches.filter((m) => !m.product));
  const overflow = Math.max(0, parsed.length - MAX_INNER_SHELVES_LIMIT);

  function build() {
    const plan = parsed
      .slice(0, MAX_INNER_SHELVES_LIMIT)
      .map((l) => ({
        productIds: l.matches.flatMap((m) => (m.product ? [m.product.productId] : [])),
      }));
    if (plan.every((p) => p.productIds.length === 0)) {
      toast.error("Nothing to place", { description: "No product names matched the catalog." });
      return;
    }
    const built = applyShelfPlan(plan);
    if (failed.length > 0) {
      toast.warning(`Built ${built} shelf${built === 1 ? "" : "s"}, skipped ${failed.length}`, {
        description: failed.map((f) => f.input).join(", "),
      });
    } else {
      toast.success(`Built ${built} shelf${built === 1 ? "" : "s"} with ${resolved} products`);
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Type shelves</DialogTitle>
          <DialogDescription>
            One shelf per line, products left to right, separated by commas. Each name is one
            facing. Existing shelves are refilled; missing ones are created.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={8}
          placeholder={"Shelf 1: RAINBOW EVAP ORIGINAL 170g, RAINBOW EVAP PET 133ml\nShelf 2: RAINBOW MILK POWDER 400g, RAINBOW MILK POWDER 900g"}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-mono leading-6 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />

        <div className="max-h-64 overflow-y-auto space-y-2">
          {parsed.map((line, i) => (
            <div
              key={i}
              className={cn(
                "rounded-md border px-3 py-2",
                i >= MAX_INNER_SHELVES_LIMIT
                  ? "border-slate-200 bg-slate-50 opacity-60"
                  : "border-slate-200 bg-white",
              )}
            >
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                Shelf {i + 1}
                {i >= MAX_INNER_SHELVES_LIMIT ? " — over the limit, ignored" : ""}
              </div>
              {line.matches.length === 0 ? (
                <span className="text-xs text-slate-400">Empty</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {line.matches.map((m, j) => (
                    <span
                      key={j}
                      title={
                        m.product
                          ? m.product.itemDescription
                          : m.ambiguous
                          ? "Matches several products — type more of the name"
                          : "Not found in the catalog"
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border",
                        m.product
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-300 bg-amber-50 text-amber-700",
                      )}
                    >
                      {m.product ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {m.product ? m.product.itemDescription : m.input}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <span className="mr-auto self-center text-[11px] text-slate-500">
            {resolved} matched
            {failed.length > 0 ? ` · ${failed.length} will be skipped` : ""}
            {overflow > 0 ? ` · ${overflow} line(s) over the ${MAX_INNER_SHELVES_LIMIT}-shelf limit` : ""}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={build} disabled={resolved === 0} className="gap-1.5">
            <Wand2 className="h-4 w-4" />
            Build shelves
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
