"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import {
  createPlanogram,
  movePlanogramToFolder,
  replacePlanogram,
} from "@/lib/planograms/actions";
import type {
  CreatePlanogramResult,
  PlanogramNameConflict,
} from "@/lib/planograms/types";

export function NewPlanogramForm({ folderId }: { folderId?: string | null }) {
  const router = useRouter();
  const [planogramName, setPlanogramName] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [conflict, setConflict] = React.useState<PlanogramNameConflict | null>(null);
  const [resolving, setResolving] = React.useState(false);

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("planogramName", planogramName);
    fd.set("customerName", customerName);
    if (folderId) fd.set("folderId", folderId);
    return fd;
  }

  function openCreated(res: CreatePlanogramResult) {
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push(`/editor/${res.tenantSlug}/${res.planogramSlug}`);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setConflict(null);

    startTransition(async () => {
      const res = await createPlanogram(buildFormData());
      if (!res.ok) {
        // A name clash is recoverable — offer move / replace instead of erroring.
        if (res.conflict) {
          setConflict(res.conflict);
          return;
        }
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success("Planogram created");
      router.push(`/editor/${res.tenantSlug}/${res.planogramSlug}`);
    });
  }

  async function handleMove() {
    if (!conflict) return;
    setResolving(true);
    const res = await movePlanogramToFolder(conflict.planogramId, folderId ?? null);
    setResolving(false);
    if (res.ok) toast.success("Planogram moved here");
    setConflict(null);
    openCreated(res);
  }

  async function handleReplace() {
    if (!conflict) return;
    if (
      !confirm(
        `Delete "${conflict.planogramName}" (in ${conflict.folderPath}) and create a new empty one here?\n\nThe old shelves and placements are lost. This cannot be undone.`,
      )
    )
      return;
    setResolving(true);
    const res = await replacePlanogram(conflict.planogramId, buildFormData());
    setResolving(false);
    if (res.ok) toast.success("Planogram replaced");
    setConflict(null);
    openCreated(res);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="planogramName">Planogram Name</Label>
        <Input
          id="planogramName"
          value={planogramName}
          onChange={(e) => setPlanogramName(e.target.value)}
          placeholder="e.g. Summer Aisle 2026"
          maxLength={120}
          autoFocus
          required
        />
        {errors.planogramName ? (
          <p className="text-xs text-rose-600">{errors.planogramName}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerName">Customer / Mart</Label>
        <Input
          id="customerName"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="e.g. SuperMart North Branch"
          maxLength={120}
          required
        />
        {errors.customerName ? (
          <p className="text-xs text-rose-600">{errors.customerName}</p>
        ) : null}
      </div>

      {conflict ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="text-sm text-amber-900">
            <span className="font-medium">“{conflict.planogramName}”</span> already exists
            {conflict.sameFolder ? (
              <> in this folder.</>
            ) : (
              <> in <span className="font-medium">{conflict.folderPath}</span>.</>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {conflict.sameFolder ? null : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleMove}
                disabled={resolving}
              >
                Move it here
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReplace}
              disabled={resolving}
            >
              Create fresh here &amp; delete the old one
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConflict(null)}
              disabled={resolving}
            >
              Cancel
            </Button>
          </div>
          {conflict.sameFolder ? (
            <p className="text-xs text-amber-800">
              It is already here — either replace it, or pick a different name.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            router.push(folderId ? `/editor/browse?folder=${folderId}` : "/editor/browse")
          }
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create & Open Editor"}
        </Button>
      </div>
    </form>
  );
}
