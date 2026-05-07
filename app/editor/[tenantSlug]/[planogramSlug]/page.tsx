import { notFound } from "next/navigation";
import EditorShell from "@/components/editor/EditorShell";
import { requireSession, getCurrentTenant } from "@/lib/auth/dal";
import { listTenantProducts } from "@/lib/catalog/actions";
import { getPlanogramBySlug } from "@/lib/planograms/actions";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; planogramSlug: string }>;
}) {
  const { tenantSlug, planogramSlug } = await params;

  const [session, tenant, products, planogram] = await Promise.all([
    requireSession(),
    getCurrentTenant(),
    listTenantProducts(),
    getPlanogramBySlug(tenantSlug, planogramSlug),
  ]);

  if (!planogram) notFound();

  return (
    <EditorShell
      user={{ name: session.name, email: session.email }}
      tenant={{ name: tenant.tenantName, logo: tenant.tenantLogo }}
      initialProducts={products}
      initialBinding={{
        planogramId: planogram.planogramId,
        tenantSlug: planogram.tenantSlug,
        planogramSlug: planogram.planogramSlug,
        planogram: planogram.planogramData,
        customerName: planogram.customerName,
        lastSavedAt: planogram.updatedAt,
      }}
    />
  );
}
