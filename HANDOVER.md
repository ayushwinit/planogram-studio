# Planogram Studio — handover

Everything a new maintainer needs to run, change and deploy this app.
Written 2026-09-11.

---

## 1. What this is

A web tool for drawing a client's **reference planogram**: which products sit on
which shelf, in what order, how many facings. The result is saved to Postgres as
structured JSON plus a rendered image. Downstream, an FMCG shelf-detection model
reads an in-store photo, emits product labels per shelf, and those are compared
against this reference to score compliance.

**The naming contract is the whole point.** `tenant_products.item_description`
must be *character-for-character* the label the detection model emits — the
model's class name, plus the pack variant when the class has one:

```
RAINBOW EVAP ORIGINAL 170g          <- class "RAINBOW EVAP ORIGINAL" + " 170g"
CHUPA_CHUPS_BUBBLY_LOLLIPOP_16_GMS  <- class name verbatim, underscores and all
MENTOS_AIR_ACTION_GUM_87.5GM 10p    <- class + one of the three Mentos variants
```

Typos in the source class names (`FRUIT-TELLA`, `BUBLEFRESH`, `STRAWBERY`,
`EXTRDED`, `FILIFOLY`) are **deliberately preserved**. Do not "fix" them — the
match is against the model's output, not against English.

---

## 2. Access you need

| Thing | Where | Notes |
| --- | --- | --- |
| Code | `github.com/ayushwinit/planogram-studio` | `master` is production |
| Upstream | `github.com/ronith-winit/planogram-studio` | the original team's repo — **never push here** |
| Hosting | Vercel, imported from the repo above | auto-deploys on push to `master` |
| Database | Railway Postgres | **shared with the original team** — see §4 |
| Object storage | Railway bucket `modular-tupperware-nvotqx` | product images + planogram previews |

All secrets live in **`.env.local`** (gitignored) and in the Vercel project's
Environment Variables. For the handover sheet, fill in
`DB-ACCESS.template.md`, save it as `DB-ACCESS.md` (gitignored) and send it
privately — credentials must never be committed.

`.env.local` and Vercel are kept in sync by hand: a variable added locally does
not exist in production until it is pasted into the Vercel dashboard.

Variables required: `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`,
`PGDATABASE`, `SESSION_SECRET`, `SESSION_TTL_SECONDS`, `S3_ENDPOINT`,
`S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

---

## 3. Running it

```bash
npm install
npm run dev          # http://localhost:3000  — NOT the 192.168.x.x address
```

Browsing the LAN IP instead of `localhost` makes Next.js block its own HMR
endpoint as a cross-origin request; the page renders but never hydrates, and the
catalog hangs on "Loading catalog…". This has cost us an afternoon before.

```bash
npm run build && npm run start   # production mode locally
npm run db:migrate               # apply db/migrations/*.sql in filename order
```

Migrations have **no tracking table** — every statement must be idempotent
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), because they all
re-run on every invocation.

`AGENTS.md` warns that this is a newer Next.js than most references assume. Read
`node_modules/next/dist/docs/` before changing routing, middleware or config.
Note this project uses **`proxy.ts`, not `middleware.ts`**, to guard `/editor`
and `/signup`.

---

## 4. Tenancy — read this before touching the database

The app is multi-tenant. Every domain table (`tenant_products`, `planograms`,
`planogram_folders`) is scoped by `tenant_id`, and the session cookie carries the
tenant. Two tenants share this database:

| Tenant | `tenant_id` | Owner |
| --- | --- | --- |
| `choithrams` | *(the original team's)* | **Their live client demo.** Do not touch. |
| `Choithrams (winit)` | `5f6ea837-10f9-479c-9839-f8ef3c256ab8` | Ours |

Our login: `planogram@gmail.com` (Ayushya Shrivastav).

**The risk to understand:** the S3 bucket is ours alone, but the *pointers* to
images (`tenant_products.item_image_url`) live in this shared database. A
careless `DELETE FROM tenant_products` without a `tenant_id` filter, or a
migration that rewrites image codes, takes down the other team's live demo.
Always filter by `tenant_id`.

Splitting to our own Railway database is the outstanding piece of work: create
the database, point `DATABASE_URL` at it, `npm run db:migrate`, recreate the
tenant and user, re-run the importer.


---

## 5. Database schema

Postgres on Railway, 6 tables. Live row counts as of 2026-09-11.

### `tenants` (2 rows)
`tenant_id` uuid PK · `tenant_name` text · `tenant_logo` text · `created_at` · `updated_at`

| `tenant_id` | `tenant_name` | products | planograms |
| --- | --- | --- | --- |
| `e3aa274e-7e54-40c2-bade-511393db7360` | `choithrams` | 44 | 12 |
| `5f6ea837-10f9-479c-9839-f8ef3c256ab8` | `Choithrams (winit)` | 167 | 29 |

### `tenant_users` (3 rows)
`user_id` uuid PK · `tenant_id` uuid · `user_name` · `user_email` (globally
unique) · `user_password` (bcrypt) · `created_at` · `updated_at`

### `tenant_products` (211 rows across both tenants)
| Column | Type | Notes |
| --- | --- | --- |
| `product_id` | uuid | PK |
| `tenant_id` | uuid | **always filter on this** |
| `category` | text NOT NULL | e.g. `CANDY`, `Evaporated Milk` |
| `main_brand` | text | `Perfetti`, `Rainbow` — added after migration 002 |
| `brand` | text | the **sub**-brand (`MENTOS`, `Evap`) despite the name |
| `item_code` | text | null on all Rainbow rows |
| `barcode` | text | null everywhere |
| `item_description` | text NOT NULL | **the detection-model label — see §1** |
| `uom` | text | pack size, reference only; does not drive matching |
| `item_image_url` | text | 10-char S3 code, not a URL |
| `item_dimensions` | jsonb | `{widthMm, heightMm, depthMm?}`, null for ~60 rows |

### `planograms` (41 rows)
`planogram_id` uuid PK · `tenant_id` · denormalised `tenant_name` / `tenant_slug`
· `planogram_name` / `planogram_slug` · `customer_name` · `folder_id` ·
`created_by` · counts (`shelves_count`, `rows_count`, `products_count`,
`placements_count`, `units_count`) · `canvas_width_mm` / `canvas_height_mm` ·
`preview_image_url` (10-char S3 code) · and the two jsonb blobs described in §6.

### `planogram_folders` (6 rows)
`folder_id` uuid PK · `tenant_id` · `parent_folder_id` (self-referencing, so
folders nest) · `folder_name` · `created_by`

### `admin_users` (1 row)
Separate from `tenant_users`; belongs to the admin project that creates tenants.

Migrations live in `db/migrations/*.sql` and are applied in filename order by
`npm run db:migrate`. There is **no tracking table** — every statement re-runs on
every invocation, so all of them must be idempotent.

---

## 6. Where the data lives

**Postgres** stores structure and text. Two JSON blobs per planogram:

- `planograms.planogram_data` — the editor's own state (shelves, rows,
  placements, scales, arrangements). This is what reloads when you open it.
- `planograms.shelf_details` — the flattened, detection-friendly export: each
  shelf lists its products with full name, brand, uom, dimensions, unit counts
  and absolute mm positions. **This is the one the detection system consumes.**

**S3 stores bytes.** Postgres only ever holds a 10-character `nanoid`:

| Column | Bucket key |
| --- | --- |
| `tenant_products.item_image_url` | `product-images/<code>` |
| `planograms.preview_image_url` | `planogram-previews/<code>` |

This split is why the app broke when we inherited it: the database rows survived,
but nobody had the old bucket's credentials, so every pointer dangled. If you
ever rotate buckets, you must re-upload **and** rewrite the codes.

Preview images are PNG and run ~2.6 MB each. Converting the capture to JPEG/WebP
at ~0.8 quality would cut that by roughly 10-20x with no visible loss. Not done
yet; worth doing before the planogram count grows.

---

## 7. The catalog

167 products under our tenant:

| Brand | Count |
| --- | --- |
| Perfetti | 138 |
| Rainbow | 28 |
| *(junk)* | 1 |

Full dump: **`catalog-choithrams-winit.json`** (gitignored — it is client
material). Regenerate any time:

```bash
npx tsx scripts/export-catalog.ts \
  --tenant 5f6ea837-10f9-479c-9839-f8ef3c256ab8 \
  --out catalog-choithrams-winit.json
```

### Known data gaps

- **Two junk rows** named `Unknown`, created 2026-09-09 and 2026-09-11 from the
  Add-product dialog with an empty form. Harmless but should be deleted.
- **~60 products have no dimensions** (51 Perfetti + 9 Rainbow). They render as
  100×100 mm placeholders, so shelf-fit maths for those is not trustworthy.
- **Every barcode is null.** 108 of 138 Perfetti rows have an `item_code`; no
  Rainbow row does. Needs client master data.
- **Suspect dimensions:** `RAINBOW MILK POWDER 1.8Kg` is recorded as 240 mm tall
  but the larger `2.5Kg` as 215 mm — almost certainly swapped upstream.
- **Perfetti widths** were read from the source DB's `length` column on the
  assumption that length = facing width. On bottle SKUs depth equals length, so
  a swap would be invisible. Unverified.

### Adding products in bulk

```bash
npx tsx scripts/import-products.ts \
  --json <file.json> --images <dir> --tenant <uuid>     # dry run
npx tsx scripts/import-products.ts ... --apply          # writes
```

The JSON is an array of `{ imageFile, category, mainBrand, subBrand, itemCode,
barcode, itemDescription, uom, widthMm, heightMm, depthMm }`. It validates every
row and image up front and aborts before writing anything if one is wrong. Each
product row gets its **own** S3 object even when two variants share a source
photo — deleting one product must not blank out its sibling.

---

## 8. Editor features we added

Beyond what the original team built:

- **Auto-fit** (per shelf, on the shelf's label bar) — scales each product to
  clear the row height, shrinks the row if it still overflows, re-flows
  left-to-right with even gaps. Never changes unit counts. Understands stacks.
- **Stacking different products** — drop one product onto another and it rests
  on top; the drop always snaps to the floor or to a product's top, so nothing
  floats.
- **Click to place** — clicking a catalog product drops it on the selected shelf.
  There is no longer a "place product" dialog; quantity and arrangement are set
  in the right panel afterwards. Everything defaults to one facing.
- **Type shelves** — a dialog that builds whole shelves from typed lines
  (`Shelf 1: NAME, NAME, …`). Name matching is case- and punctuation-insensitive,
  so `rainbow evap original 170g` finds `RAINBOW EVAP ORIGINAL 170g`. Unmatched
  names are skipped with a warning; ambiguous ones are never guessed.
- **Undo/redo** — Ctrl+Z / Ctrl+Shift+Z, 50 steps, plus toolbar buttons. Built as
  a store subscription, so any new action is automatically undoable.
- **Shelf management** — insert at any position (numbering renumbers itself),
  swap two shelves' contents by dragging the grip, clear a shelf's products,
  delete a shelf.
- **Import** — pull selected shelves out of another planogram, previewed
  visually, and either **append** them to the current canvas or replace it.

Hard limit: **10 inner shelves** per unit (`MAX_INNER_SHELVES`).

---

## 9. Deploying

```bash
git add -A
git commit -m "…"
git push origin master     # Vercel rebuilds, ~2 min
```

Check `npm run build` passes locally first — a broken build just fails on Vercel
and the previous deployment stays live.

Changes to **data only** (importing products, editing the catalog) need no
deployment at all: production reads the same database and bucket, so they are
live immediately.

---

## 10. Things deliberately left undone

- Own database, split from the original team's (§4).
- Preview-image compression (§6).
- Dimensions, barcodes and the suspect measurements (§7).
- Deleting the two junk catalog rows (§7).
- "Share of shelf %" from the client's PDF has no field in the app.
- Folder hierarchy is undecided: mart-first (Choithrams, Carrefour) or
  brand-first (Rainbow, Perfetti).
