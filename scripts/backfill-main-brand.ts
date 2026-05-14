// One-off backfill for tenant_products.main_brand after migration 006 cleared
// it: every existing row's main_brand becomes "Perfetti", except rows whose
// sub-brand (the `brand` column) is "Rainbow" — those become "Rainbow".
//
// Only touches rows where main_brand IS NULL so re-running is safe.

import { makePool } from "./db";

async function main() {
  const pool = makePool();
  try {
    const result = await pool.query<{ product_id: string; main_brand: string }>(
      `UPDATE tenant_products
          SET main_brand = CASE WHEN brand = 'Rainbow' THEN 'Rainbow' ELSE 'Perfetti' END
        WHERE main_brand IS NULL
        RETURNING product_id, main_brand`,
    );

    const rainbow = result.rows.filter((r) => r.main_brand === "Rainbow").length;
    const perfetti = result.rows.filter((r) => r.main_brand === "Perfetti").length;
    console.log(
      `Updated ${result.rowCount} product(s): ${perfetti} → Perfetti, ${rainbow} → Rainbow.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
