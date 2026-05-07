import { requireSession, getCurrentTenant } from "@/lib/auth/dal";
import { listPlanograms } from "@/lib/planograms/actions";
import { Toolbar } from "@/components/editor/Toolbar";
import { BrowsePlanograms } from "@/components/editor/BrowsePlanograms";

export default async function BrowsePlanogramsPage() {
  const [session, tenant, planograms] = await Promise.all([
    requireSession(),
    getCurrentTenant(),
    listPlanograms(),
  ]);

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <Toolbar
        user={{ name: session.name, email: session.email }}
        tenant={{ name: tenant.tenantName, logo: tenant.tenantLogo }}
      />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <BrowsePlanograms planograms={planograms} />
      </main>
    </div>
  );
}
