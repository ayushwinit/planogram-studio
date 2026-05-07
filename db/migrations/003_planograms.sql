CREATE TABLE IF NOT EXISTS planograms (
  planogram_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  tenant_name         text        NOT NULL,
  tenant_slug         text        NOT NULL,
  planogram_name      text        NOT NULL,
  planogram_slug      text        NOT NULL,
  customer_name       text        NOT NULL,
  -- denormalised stats so the browse list doesn't have to crack the JSON
  shelves_count       int         NOT NULL DEFAULT 0,
  rows_count          int         NOT NULL DEFAULT 0,
  products_count      int         NOT NULL DEFAULT 0,
  placements_count    int         NOT NULL DEFAULT 0,
  units_count         int         NOT NULL DEFAULT 0,
  canvas_width_mm     numeric     NOT NULL DEFAULT 0,
  canvas_height_mm    numeric     NOT NULL DEFAULT 0,
  -- round-trippable editor state (matches lib/types.ts Planogram)
  planogram_data      jsonb       NOT NULL,
  -- enriched, recognition-ready snapshot (per-shelf, per-row, per-placement
  -- with absolute positions, bounding boxes, full product attributes)
  shelf_details       jsonb       NOT NULL,
  -- short S3 code for the rendered PNG (planogram-previews/<code>); null until first save
  preview_image_url   text,
  created_by          uuid        NOT NULL REFERENCES tenant_users(user_id) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- One planogram name per tenant (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS planograms_tenant_name_key
  ON planograms (tenant_id, lower(planogram_name));

-- Slug is what shows up in URLs; also unique per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS planograms_tenant_slug_key
  ON planograms (tenant_id, planogram_slug);

CREATE INDEX IF NOT EXISTS planograms_tenant_id_idx
  ON planograms (tenant_id);

CREATE INDEX IF NOT EXISTS planograms_tenant_customer_idx
  ON planograms (tenant_id, lower(customer_name));
