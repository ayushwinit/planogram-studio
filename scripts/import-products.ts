/**
 * Bulk-load catalog products from a JSON array + a folder of images.
 *
 * Each JSON object maps to one `tenant_products` row. `imageFile` names a file
 * inside --images; the file is uploaded to S3 under its own fresh code, so two
 * variants sharing a source photo still get independent objects (deleting one
 * product must not blank out its sibling).
 *
 * Usage:
 *   npx tsx scripts/import-products.ts --json <file> --images <dir> --tenant <uuid> [--apply]
 *
 * Without --apply it is a dry run: nothing is uploaded, nothing is written.
 */
import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import { Pool } from "pg";

interface SkuInput {
  imageFile: string;
  category: string;
  mainBrand: string | null;
  subBrand: string | null;
  itemCode: string | null;
  barcode: string | null;
  itemDescription: string;
  uom: string | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  flags?: string[];
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function loadEnv(): void {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i === -1 ? undefined : process.argv[i + 1];
  if (!v) {
    if (fallback !== undefined) return fallback;
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  loadEnv();

  const jsonPath = arg("json");
  const imagesDir = arg("images");
  const tenantId = arg("tenant");
  const apply = process.argv.includes("--apply");

  const skus: SkuInput[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  // Validate everything up front — a half-finished import is worse than none.
  const problems: string[] = [];
  for (const s of skus) {
    const file = path.join(imagesDir, s.imageFile);
    if (!fs.existsSync(file)) problems.push(`missing image: ${s.imageFile}`);
    else if (!CONTENT_TYPES[path.extname(file).toLowerCase()])
      problems.push(`unsupported image type: ${s.imageFile}`);
    if (!s.category) problems.push(`missing category: ${s.itemDescription}`);
    if (!s.itemDescription) problems.push(`missing itemDescription for ${s.imageFile}`);
  }
  if (problems.length) {
    console.error("Aborting:\n  " + problems.join("\n  "));
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const tenant = await pool.query<{ tenant_name: string }>(
    `SELECT tenant_name FROM tenants WHERE tenant_id = $1`,
    [tenantId],
  );
  if (!tenant.rows[0]) {
    console.error(`No tenant with id ${tenantId}`);
    await pool.end();
    process.exit(1);
  }

  const existing = await pool.query<{ item_description: string; uom: string | null }>(
    `SELECT item_description, uom FROM tenant_products WHERE tenant_id = $1`,
    [tenantId],
  );
  const seen = new Set(
    existing.rows.map((r) => `${r.item_description.toLowerCase()}|${(r.uom ?? "").toLowerCase()}`),
  );

  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.S3_BUCKET!;

  console.log(`tenant : ${tenant.rows[0].tenant_name} (${tenantId})`);
  console.log(`rows   : ${skus.length}   already in catalog: ${existing.rows.length}`);
  console.log(`mode   : ${apply ? "APPLY" : "DRY RUN (pass --apply to write)"}\n`);

  let inserted = 0;
  let skippedDup = 0;
  const noDims: string[] = [];

  for (const [i, s] of skus.entries()) {
    const label = `[${String(i + 1).padStart(2)}/${skus.length}] ${s.itemDescription}`;
    const key = `${s.itemDescription.toLowerCase()}|${(s.uom ?? "").toLowerCase()}`;

    if (seen.has(key)) {
      console.log(`${label}  — skip, already in catalog`);
      skippedDup++;
      continue;
    }
    seen.add(key);

    const dims =
      s.widthMm != null && s.heightMm != null
        ? { widthMm: s.widthMm, heightMm: s.heightMm, ...(s.depthMm != null ? { depthMm: s.depthMm } : {}) }
        : null;
    if (!dims) noDims.push(s.itemDescription);

    if (!apply) {
      console.log(`${label}  ${dims ? `${s.widthMm}x${s.heightMm}mm` : "NO DIMENSIONS"}`);
      continue;
    }

    const file = path.join(imagesDir, s.imageFile);
    const code = nanoid(10);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `product-images/${code}`,
        Body: fs.readFileSync(file),
        ContentType: CONTENT_TYPES[path.extname(file).toLowerCase()],
      }),
    );

    await pool.query(
      `INSERT INTO tenant_products
         (tenant_id, category, main_brand, brand, item_code, barcode,
          item_description, uom, item_image_url, item_dimensions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        tenantId,
        s.category,
        s.mainBrand,
        s.subBrand,
        s.itemCode,
        s.barcode,
        s.itemDescription,
        s.uom,
        code,
        dims ? JSON.stringify(dims) : null,
      ],
    );
    inserted++;
    console.log(`${label}  ok  ${dims ? `${s.widthMm}x${s.heightMm}mm` : "NO DIMENSIONS"}  image=${code}`);
  }

  console.log(`\ninserted=${inserted} skipped=${skippedDup}`);
  if (noDims.length) {
    console.log(`\n${noDims.length} products have NO dimensions — the editor will fall back to`);
    console.log(`100x100mm placeholders, so fix these before trusting a shelf layout:`);
    for (const n of noDims) console.log(`  - ${n}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
