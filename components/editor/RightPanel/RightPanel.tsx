"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sliders,
  Trash2,
  Image as ImageIcon,
  FileText,
  CloudUpload,
  Loader2,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { saveToCloud, exportPdf, exportPng } from "@/lib/export/savePipeline";
import { deletePlanogram } from "@/lib/planograms/actions";
import { toast } from "sonner";
import { ShelfProperties } from "./ShelfProperties";
import { PlacementProperties } from "./PlacementProperties";
import { CanvasProperties } from "./CanvasProperties";
import { ShelvesList } from "./ShelvesList";
import { MultiSelectionProperties } from "./MultiSelectionProperties";

export function RightPanel() {
  const router = useRouter();
  const selection = useEditorStore((s) => s.selection);
  const name = useEditorStore((s) => s.planogram.name);
  const setName = useEditorStore((s) => s.setName);
  const customerName = useEditorStore((s) => s.customerName);
  const setCustomerName = useEditorStore((s) => s.setCustomerName);
  const planogramId = useEditorStore((s) => s.planogramId);
  const tenantSlug = useEditorStore((s) => s.tenantSlug);
  const planogramSlug = useEditorStore((s) => s.planogramSlug);
  const dirtySinceSave = useEditorStore((s) => s.dirtySinceSave);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);

  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const isMulti = selection.kind === "placement" && selection.ids.length > 1;
  const sectionTitle =
    selection.kind === "shelf" || selection.kind === "row"
      ? "Shelf Properties"
      : isMulti
      ? `Selection (${selection.kind === "placement" ? selection.ids.length : 0})`
      : selection.kind === "placement"
      ? "Placement Properties"
      : "Planogram";

  // Image / PDF download is gated until the current state has been persisted,
  // so consumers always download a file that matches what's in the DB.
  const downloadsEnabled = !!planogramId && !dirtySinceSave && !!lastSavedAt;
  const downloadDisabledReason = !planogramId
    ? "Save the planogram first."
    : dirtySinceSave
    ? "You have unsaved changes — Save first."
    : !lastSavedAt
    ? "Save the planogram first."
    : "";

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveToCloud();
      if (res && tenantSlug && res.planogramSlug !== planogramSlug) {
        router.replace(`/editor/${res.tenantSlug}/${res.planogramSlug}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!planogramId) return;
    if (!confirm(`Delete "${name}"? This permanently removes the planogram from the database.`)) return;
    setDeleting(true);
    const res = await deletePlanogram(planogramId);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Planogram deleted");
    router.push("/editor/browse");
  }

  return (
    <aside className="h-full bg-white border-l border-slate-200 flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 space-y-2.5 bg-white">
        <div className="space-y-1">
          <Label htmlFor="planogram-name">Planogram</Label>
          <Input
            id="planogram-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Planogram name"
            className="h-8 text-sm font-medium"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="planogram-customer">Customer / Mart</Label>
          <Input
            id="planogram-customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. SuperMart North"
            className="h-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 flex-1"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            {saving ? "Saving…" : dirtySinceSave ? "Save" : "Save"}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                disabled={!planogramId || deleting}
                onClick={handleDelete}
                className="gap-1.5"
                aria-label="Delete planogram"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete planogram from database</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!downloadsEnabled}
                  onClick={exportPng}
                  className="gap-1.5 w-full"
                >
                  <ImageIcon className="h-4 w-4" /> Save as Image
                </Button>
              </span>
            </TooltipTrigger>
            {!downloadsEnabled ? (
              <TooltipContent>{downloadDisabledReason}</TooltipContent>
            ) : (
              <TooltipContent>Download the saved planogram as PNG</TooltipContent>
            )}
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!downloadsEnabled}
                  onClick={exportPdf}
                  className="gap-1.5 w-full"
                >
                  <FileText className="h-4 w-4" /> Save as PDF
                </Button>
              </span>
            </TooltipTrigger>
            {!downloadsEnabled ? (
              <TooltipContent>{downloadDisabledReason}</TooltipContent>
            ) : (
              <TooltipContent>Download the saved planogram as PDF</TooltipContent>
            )}
          </Tooltip>
        </div>

        <div className="text-[10px] text-slate-400 px-0.5">
          {dirtySinceSave ? (
            <span className="text-amber-600">Unsaved changes</span>
          ) : lastSavedAt ? (
            <span>Saved {new Date(lastSavedAt).toLocaleString()}</span>
          ) : null}
        </div>
      </div>

      <div className="px-4 h-11 shrink-0 flex items-center gap-2 border-b border-slate-100">
        <Sliders className="h-4 w-4 text-slate-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {sectionTitle}
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <ShelvesListSafe />

        {selection.kind === "shelf" ? (
          <ShelfProperties shelfId={selection.id} />
        ) : selection.kind === "placement" && selection.ids.length > 1 ? (
          <MultiSelectionProperties ids={selection.ids} />
        ) : selection.kind === "placement" && selection.ids.length === 1 ? (
          <PlacementProperties placementId={selection.ids[0]} />
        ) : selection.kind === "row" ? null : (
          <CanvasProperties />
        )}
      </div>
    </aside>
  );
}

function ShelvesListSafe() {
  const hasShelf = useEditorStore((s) => s.planogram.shelves.length > 0);
  if (!hasShelf) return null;
  return <ShelvesList />;
}
