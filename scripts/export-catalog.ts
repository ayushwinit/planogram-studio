/**
 * Dump one tenant's catalog to JSON — the handover artefact for whoever picks
 * this up next. Image bytes stay in S3; `itemImageUrl` is the object key under
 * `product-images/`.
 *
 * Usage: npx tsx scripts/export-catalog.ts --tenant <uuid> [--out catalog.json]
 */
import fs from "node:fs";
import { Pool } from "pg";

function loadEnv(): void {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i === -1 ? undefined : process.argv[i + 1];
  if (v) return v;
  if (fallback !== undefined) return fallback;
  console.error(`Missing --${name}`);
  process.exit(1);
}

async function main() {
  loadEnv();
  const tenantId = arg("tenant");
  const out = arg("out", "catalog-export.json");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const tenant = await pool.query(`SELECT tenant_name FROM tenants WHERE tenant_id = $1`, [tenantId]);
  if (!tenant.rows[0]) {
    console.error(`No tenant with id ${tenantId}`);
    await pool.end();
    process.exit(1);
  }

  const products = await pool.query(
    `SELECT product_id, category, main_brand, brand AS sub_brand, item_code, barcode,
            item_description, uom, item_image_url, item_dimensions, created_at
       FROM tenant_products
      WHERE tenant_id = $1
      ORDER BY main_brand, item_description`,
    [tenantId],
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    tenantId,
    tenantName: tenant.rows[0].tenant_name,
    bucket: process.env.S3_BUCKET,
    imageKeyPrefix: "product-images/",
    productCount: products.rowCount,
    products: products.rows,
  };

  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`${products.rowCount} products -> ${out}`);
  const byBrand: Record<string, number> = {};
  for (const r of products.rows) byBrand[r.main_brand ?? "—"] = (byBrand[r.main_brand ?? "—"] ?? 0) + 1;
  console.log(byBrand);
  await pool.end();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
