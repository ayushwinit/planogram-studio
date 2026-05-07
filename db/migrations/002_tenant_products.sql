CREATE TABLE IF NOT EXISTS tenant_products (
  product_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  category          text        NOT NULL,
  brand             text        NOT NULL,
  item_code         text,
  barcode           text,
  item_description  text        NOT NULL,
  uom               text        NOT NULL,
  item_image_url    text,
  item_dimensions   jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_products_tenant_id_idx
  ON tenant_products (tenant_id);

CREATE INDEX IF NOT EXISTS tenant_products_tenant_category_idx
  ON tenant_products (tenant_id, category);

CREATE INDEX IF NOT EXISTS tenant_products_tenant_brand_idx
  ON tenant_products (tenant_id, brand);
