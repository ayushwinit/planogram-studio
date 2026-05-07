import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { makePool } from "./db";

async function main() {
  const pool = makePool();
  const migrationsDir = join(process.cwd(), "db", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
    await pool.end();
    return;
  }

  console.log(`Applying ${files.length} migration(s)...`);
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    process.stdout.write(`  - ${file} ... `);
    try {
      await pool.query(sql);
      console.log("ok");
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      await pool.end();
      process.exit(1);
    }
  }
  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
