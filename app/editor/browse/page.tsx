import { requireSession, getCurrentTenant } from "@/lib/auth/dal";
import {
  listPlanograms,
  listPlanogramBrands,
  listPlanogramCustomers,
  type PlanogramListFilters,
} from "@/lib/planograms/actions";
import {
  listFolderChildren,
  getFolderBreadcrumb,
  parseFolderId,
} from "@/lib/folders/actions";
import { Toolbar } from "@/components/editor/Toolbar";
import { BrowsePlanograms } from "@/components/editor/BrowsePlanograms";

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function BrowsePlanogramsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const folderId = await parseFolderId(first(sp.folder));

  const q = first(sp.q);
  const customer = first(sp.customer);
  const mainBrand = first(sp.mainBrand);
  const subBrand = first(sp.subBrand);
  const hasFilters = Boolean(q?.trim() || customer || mainBrand || subBrand);

  // Inside a folder we always scope to that folder. At the root we normally show
  // only root-level planograms, but as soon as a filter is active we widen the
  // search to every folder so nothing stays hidden in a subtree.
  const folderScope: string | null | undefined = folderId
    ? folderId
    : hasFilters
    ? undefined
    : null;

  const filters: PlanogramListFilters = {
    q,
    customer,
    mainBrand,
    subBrand,
    folderId: folderScope,
  };

  const [session, tenant, planograms, brands, customers, folders, breadcrumb] =
    await Promise.all([
      requireSession(),
      getCurrentTenant(),
      listPlanograms(filters),
      listPlanogramBrands(),
      listPlanogramCustomers(),
      listFolderChildren(folderId),
      getFolderBreadcrumb(folderId),
    ]);

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <Toolbar
        user={{ name: session.name, email: session.email }}
        tenant={{ name: tenant.tenantName, logo: tenant.tenantLogo }}
        folderId={folderId}
      />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <BrowsePlanograms
          planograms={planograms}
          folders={folders}
          breadcrumb={breadcrumb}
          currentFolderId={folderId}
          searchingAllFolders={!folderId && hasFilters}
          availableMainBrands={brands.mainBrands}
          availableSubBrands={brands.subBrands}
          availableCustomers={customers}
          initialFilters={{
            q: q ?? "",
            customer: customer ?? "",
            mainBrand: mainBrand ?? "",
            subBrand: subBrand ?? "",
          }}
        />
      </main>
    </div>
  );
}
