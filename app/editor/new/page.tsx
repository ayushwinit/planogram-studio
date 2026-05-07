import { requireSession, getCurrentTenant } from "@/lib/auth/dal";
import { Toolbar } from "@/components/editor/Toolbar";
import { NewPlanogramForm } from "@/components/editor/NewPlanogramForm";

export default async function NewPlanogramPage() {
  const [session, tenant] = await Promise.all([
    requireSession(),
    getCurrentTenant(),
  ]);

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <Toolbar
        user={{ name: session.name, email: session.email }}
        tenant={{ name: tenant.tenantName, logo: tenant.tenantLogo }}
      />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-10">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">
              Create a new planogram
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              You&apos;ll choose shelves and place products on the next screen.
            </p>
          </header>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <NewPlanogramForm />
          </div>
        </div>
      </main>
    </div>
  );
}
