"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { createPlanogram } from "@/lib/planograms/actions";

export function NewPlanogramForm() {
  const router = useRouter();
  const [planogramName, setPlanogramName] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData();
    fd.set("planogramName", planogramName);
    fd.set("customerName", customerName);

    startTransition(async () => {
      const res = await createPlanogram(fd);
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success("Planogram created");
      router.push(`/editor/${res.tenantSlug}/${res.planogramSlug}`);
    });
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

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/editor/browse")}
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
