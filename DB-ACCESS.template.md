# Credentials — Planogram Studio

**Fill this in from `.env.local`, save it as `DB-ACCESS.md` (gitignored), and
send it over a private channel.** Never commit either file.

If it leaks, rotate everything: Railway can regenerate both the database
password and the bucket keys, and `SESSION_SECRET` can be any new random string
(changing it just logs everyone out).

These same values must also exist in the **Vercel project's Environment
Variables**. Local and production are synced by hand — adding a variable here
does not add it there.

---

## Postgres (Railway) — SHARED with the original team

| | From `.env.local` |
| --- | --- |
| Host | `PGHOST` |
| Port | `PGPORT` |
| Database | `PGDATABASE` |
| User | `PGUSER` |
| Password | `PGPASSWORD` |
| Full URL | `DATABASE_URL` |

SSL is required. The `pg` Pool in this repo enables it automatically for
`.rlwy.net` hosts; connecting with `psql` needs `?sslmode=require`:

```bash
psql "$DATABASE_URL?sslmode=require"
```

**This database is shared with the original team's live client demo.** Always
filter by `tenant_id`. Read §4 of `HANDOVER.md` before running any write.

---

## Object storage (Railway S3-compatible bucket) — ours alone

| | From `.env.local` |
| --- | --- |
| Endpoint | `S3_ENDPOINT` |
| Region | `S3_REGION` |
| Bucket | `S3_BUCKET` |
| Access key ID | `S3_ACCESS_KEY_ID` |
| Secret access key | `S3_SECRET_ACCESS_KEY` |

Path-style addressing (`forcePathStyle: true`), not virtual-host style.

Keys are `product-images/<code>` and `planogram-previews/<code>`, where `<code>`
is the 10-character `nanoid` stored in Postgres.

> The previous bucket's keys were lost, which is why every catalog image had to
> be re-uploaded from scratch. **Keep the filled-in sheet somewhere durable.**

---

## Session signing

`SESSION_SECRET`, `SESSION_TTL_SECONDS` — sign the JWT session cookie (`jose`).
Changing the secret invalidates every existing session.

---

## Application login

| | |
| --- | --- |
| Tenant | `Choithrams (winit)` — `5f6ea837-10f9-479c-9839-f8ef3c256ab8` |
| Name | Ayushya Shrivastav |
| Email | `planogram@gmail.com` |
| Password | *(fill in)* |

Passwords are bcrypt-hashed in `tenant_users.user_password`, and emails are
globally unique across all tenants. To reset one, UPDATE that column with a new
bcrypt hash. `scripts/seed-user.ts` can attach a user to an existing tenant but
cannot create a tenant — that needs a direct INSERT into `tenants`.
