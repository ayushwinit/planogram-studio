"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Same accordion pattern as the inner-shelves dropdown on the right panel:
 * click the header to toggle, single chevron on the right rotates 180° when
 * open. Each section owns its own open state so toggles are independent.
 */
export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div
      className="border-b border-slate-100 flex flex-col min-h-0"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-3 h-9 flex items-center gap-2 hover:bg-slate-50 transition-colors"
      >
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
          {title}
        </span>
        {count !== undefined ? (
          <span className="text-[11px] text-slate-400 tabular-nums">{count}</span>
        ) : null}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-slate-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>
      ) : null}
    </div>
  );
}
