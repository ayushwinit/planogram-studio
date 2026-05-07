/**
 * Interactive CLI to create the FIRST user for a tenant (or any user, really).
 * Use this for bootstrap; afterwards use the in-app /signup page while signed in.
 *
 * Usage:
 *   npm run seed:user
 *   npm run seed:user -- --tenant "Acme Co" --email a@b.com --name "Admin" --password "Secret123"
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { makePool } from "./db";

type Args = { tenant?: string; tenantId?: string; email?: string; name?: string; password?: string };

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--tenant" && next) { out.tenant = next; i++; }
    else if (a === "--tenant-id" && next) { out.tenantId = next; i++; }
    else if (a === "--email" && next) { out.email = next; i++; }
    else if (a === "--name" && next) { out.name = next; i++; }
    else if (a === "--password" && next) { out.password = next; i++; }
  }
  return out;
}

async function prompt(rl: ReturnType<typeof createInterface>, q: string, fallback?: string): Promise<string> {
  const ans = (await rl.question(fallback ? `${q} [${fallback}]: ` : `${q}: `)).trim();
  return ans || fallback || "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = makePool();
  const rl = createInterface({ input, output });

  try {
    // 1. Resolve tenant
    let tenantId = args.tenantId;
    let tenantName = args.tenant;

    if (!tenantId) {
      if (!tenantName) {
        const { rows } = await pool.query<{ tenant_id: string; tenant_name: string }>(
          `SELECT tenant_id, tenant_name FROM tenants ORDER BY tenant_name ASC`,
        );
        if (rows.length === 0) {
          console.error("No tenants found. Create a tenant via the admin project first.");
          process.exit(1);
        }
        console.log("\nAvailable tenants:");
        rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.tenant_name}  (${r.tenant_id})`));
        const choice = await prompt(rl, "Pick tenant by number");
        const idx = Number(choice) - 1;
        if (Number.isNaN(idx) || idx < 0 || idx >= rows.length) {
          console.error("Invalid choice.");
          process.exit(1);
        }
        tenantId = rows[idx].tenant_id;
        tenantName = rows[idx].tenant_name;
      } else {
        const { rows } = await pool.query<{ tenant_id: string }>(
          `SELECT tenant_id FROM tenants WHERE lower(tenant_name) = lower($1) LIMIT 1`,
          [tenantName],
        );
        if (rows.length === 0) {
          console.error(`Tenant "${tenantName}" not found.`);
          process.exit(1);
        }
        tenantId = rows[0].tenant_id;
      }
    }

    // 2. Collect user fields
    const name = args.name || (await prompt(rl, "Full name"));
    if (name.length < 2) { console.error("Name must be at least 2 characters."); process.exit(1); }

    const email = (args.email || (await prompt(rl, "Email"))).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error("Invalid email."); process.exit(1); }

    const password = args.password || (await prompt(rl, "Password (min 8 chars)"));
    if (password.length < 8) { console.error("Password must be at least 8 characters."); process.exit(1); }

    // 3. Check duplicate
    const dup = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM tenant_users WHERE lower(user_email) = $1 LIMIT 1`,
      [email],
    );
    if (dup.rows.length > 0) {
      console.error(`A user with email ${email} already exists.`);
      process.exit(1);
    }

    // 4. Insert
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await pool.query<{ user_id: string }>(
      `INSERT INTO tenant_users (tenant_id, user_name, user_email, user_password)
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
      [tenantId, name, email, passwordHash],
    );

    console.log(`\nCreated user ${email} (id ${inserted.rows[0].user_id})`);
    if (tenantName) console.log(`Tenant: ${tenantName} (${tenantId})`);
    else console.log(`Tenant: ${tenantId}`);
  } finally {
    rl.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
