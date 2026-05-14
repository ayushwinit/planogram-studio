-- Split the brand field. The existing `brand` column is repurposed to hold an
-- optional sub-brand, and a new `main_brand` column stores the parent brand the
-- product is sold under. Existing brand values are copied into main_brand so
-- historical rows keep their identifying brand, and the now-repurposed brand
-- column is cleared so it can be populated with the sub-brand going forward.
--
-- The destructive UPDATEs are gated on `main_brand` not existing yet, since
-- migrations are replayed in full on every `npm run migrate`.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name = 'tenant_products' AND column_name = 'main_brand'
  ) THEN
    ALTER TABLE tenant_products ADD COLUMN main_brand text;
    UPDATE tenant_products SET main_brand = brand;
    ALTER TABLE tenant_products ALTER COLUMN main_brand SET NOT NULL;

    ALTER TABLE tenant_products ALTER COLUMN brand DROP NOT NULL;
    UPDATE tenant_products SET brand = NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS tenant_products_tenant_main_brand_idx
  ON tenant_products (tenant_id, main_brand);
