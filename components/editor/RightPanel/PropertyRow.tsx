"use client";
import * as React from "react";
import { Label } from "@/components/ui/Input";

export function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function PropertySection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 space-y-3 border-b border-slate-100">
      {title ? (
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{title}</div>
      ) : null}
      {children}
    </div>
  );
}
