"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, FolderOpen, Plus, Download } from "lucide-react";
import UserMenu from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/Button";
import { ImportPlanogramDialog } from "./modals/ImportPlanogramDialog";

export type ToolbarUser = { name: string; email: string };
export type ToolbarTenant = { name: string; logo: string | null };

export function Toolbar({ user, tenant }: { user: ToolbarUser; tenant: ToolbarTenant }) {
  const pathname = usePathname();
  const onBrowse = pathname === "/editor/browse";
  const onNew = pathname === "/editor/new";
  // The Import button only makes sense when the user is editing a specific
  // planogram (it replaces *its* shelves) — i.e. anywhere under /editor/
  // that isn't the browse page or the new-planogram form.
  const onEditor = pathname?.startsWith("/editor/") && !onBrowse && !onNew;

  const [importOpen, setImportOpen] = React.useState(false);

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-slate-200 bg-white shadow-sm z-10">
      <Link href="/editor/browse" className="flex items-center gap-2 group">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white shadow-sm group-hover:shadow-md transition-shadow">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        <div className="font-semibold text-slate-900 leading-none">
          Planogram <span className="text-indigo-600">Studio</span>
        </div>
      </Link>

      <div className="h-6 w-px bg-slate-200 mx-1" />

      <TenantBadge name={tenant.name} logo={tenant.logo} />

      <div className="ml-auto flex items-center gap-2">
        {!onBrowse ? (
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href="/editor/browse">
              <FolderOpen className="h-4 w-4" /> Browse Planograms
            </Link>
          </Button>
        ) : null}
        {!onNew ? (
          <Button asChild size="sm" variant="primary" className="gap-1.5">
            <Link href="/editor/new">
              <Plus className="h-4 w-4" /> New Planogram
            </Link>
          </Button>
        ) : null}
        {onEditor ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setImportOpen(true)}
          >
            <Download className="h-4 w-4" /> Import
          </Button>
        ) : null}
        <div className="h-6 w-px bg-slate-200 mx-1" />
        <UserMenu name={user.name} email={user.email} />
      </div>

      {onEditor ? (
        <ImportPlanogramDialog open={importOpen} onClose={() => setImportOpen(false)} />
      ) : null}
    </header>
  );
}

function TenantBadge({ name, logo }: { name: string; logo: string | null }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImg = !!logo && !imgFailed;
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 pl-1.5 pr-2.5 py-1">
      <div className="h-7 w-7 rounded-md bg-white border border-slate-200 grid place-items-center overflow-hidden">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo!}
            alt={name}
            className="h-full w-full object-contain"
            onError={() => setImgFailed(true)}
            draggable={false}
          />
        ) : (
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
        )}
      </div>
      <span className="text-sm font-semibold uppercase tracking-wide text-slate-800 truncate max-w-[200px]">
        {name}
      </span>
    </div>
  );
}
