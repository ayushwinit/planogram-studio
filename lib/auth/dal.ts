import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSessionCookie } from "./session";
import type { SessionPayload } from "./schemas";

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  return await readSessionCookie();
});

export const requireSession = cache(async (): Promise<SessionPayload> => {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
});

export type TenantInfo = {
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
};

export const getCurrentTenant = cache(async (): Promise<TenantInfo> => {
  const session = await requireSession();
  const result = await db.query<{ tenant_id: string; tenant_name: string; tenant_logo: string | null }>(
    `SELECT tenant_id, tenant_name, tenant_logo FROM tenants WHERE tenant_id = $1 LIMIT 1`,
    [session.tenantId],
  );
  const row = result.rows[0];
  if (!row) {
    // Tenant was deleted out from under the session; force re-login.
    redirect("/");
  }
  return { tenantId: row.tenant_id, tenantName: row.tenant_name, tenantLogo: row.tenant_logo };
});
