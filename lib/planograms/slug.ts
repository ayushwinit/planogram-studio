/** URL-safe slug, capped at 60 chars, never empty.
 *  Lowercase ASCII alphanumerics + hyphens. Non-ASCII characters are dropped
 *  via the [^a-z0-9] filter, which is fine for our tenant + planogram naming.
 */
export function slugify(input: string, fallback = "item"): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return s || fallback;
}

/** Reserved tenant-slug values that would collide with our static editor routes. */
const RESERVED_TENANT_SLUGS = new Set(["browse", "new"]);

export function tenantSlug(tenantName: string): string {
  const s = slugify(tenantName, "tenant");
  return RESERVED_TENANT_SLUGS.has(s) ? `${s}-tenant` : s;
}

export function planogramSlug(name: string): string {
  return slugify(name, "planogram");
}
