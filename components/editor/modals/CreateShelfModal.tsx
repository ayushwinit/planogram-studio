"use client";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Input";
import { useEditorStore, MAX_INNER_SHELVES_LIMIT } from "@/lib/store/editorStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const COUNT_OPTIONS = Array.from(
  { length: MAX_INNER_SHELVES_LIMIT },
  (_, i) => i + 1
);

export function CreateShelfModal({ open, onClose }: Props) {
  const createShelfUnit = useEditorStore((s) => s.createShelfUnit);
  const [count, setCount] = React.useState<number>(4);

  // Reset to default whenever the modal opens.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCount(4);
  }

  function handleConfirm() {
    createShelfUnit(count);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a shelf</DialogTitle>
          <DialogDescription>
            Choose how many horizontal shelves the unit should have. You can add more later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="inner-shelf-count">Number of shelves</Label>
          <select
            id="inner-shelf-count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "shelf" : "shelves"}
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
