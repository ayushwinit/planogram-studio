import { requireSession, getCurrentTenant } from "@/lib/auth/dal";
import {
  listPlanograms,
  listPlanogramBrands,
  listPlanogramCustomers,
  type PlanogramListFilters,
} from "@/lib/planograms/actions";
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
  const filters: PlanogramListFilters = {
    q: first(sp.q),
    customer: first(sp.customer),
    mainBrand: first(sp.mainBrand),
    subBrand: first(sp.subBrand),
  };

  const [session, tenant, planograms, brands, customers] = await Promise.all([
    requireSession(),
    getCurrentTenant(),
    listPlanograms(filters),
    listPlanogramBrands(),
    listPlanogramCustomers(),
  ]);

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <Toolbar
        user={{ name: session.name, email: session.email }}
        tenant={{ name: tenant.tenantName, logo: tenant.tenantLogo }}
      />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <BrowsePlanograms
          planograms={planograms}
          availableMainBrands={brands.mainBrands}
          availableSubBrands={brands.subBrands}
          availableCustomers={customers}
          initialFilters={{
            q: filters.q ?? "",
            customer: filters.customer ?? "",
            mainBrand: filters.mainBrand ?? "",
            subBrand: filters.subBrand ?? "",
          }}
        />
      </main>
    </div>
  );
}
