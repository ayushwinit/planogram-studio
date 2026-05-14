-- Migration 005 copied the old `brand` column into the new `main_brand` and
-- cleared `brand`. The intended semantics — confirmed after-the-fact — are the
-- opposite: existing brand-column data is sub-brand, and `main_brand` should
-- start empty for legacy rows so the user can fill it in fresh via the catalog
-- dialog.
--
-- This migration:
--   1. Moves every populated `main_brand` value back into `brand` (clobbering
--      any `brand` that was set since 005 ran — the user confirmed no new
--      products have been added since, so this is safe).
--   2. Drops the NOT NULL constraint on `main_brand` so legacy rows can stay
--      empty until the user assigns one. The Zod schema on the server still
--      enforces that new inserts/updates carry a main brand.
--
-- Gated on `main_brand IS NOT NULL` existing so re-running the migration after
-- it has applied once is a no-op (the column will be all NULL afterwards).

ALTER TABLE tenant_products ALTER COLUMN main_brand DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tenant_products WHERE main_brand IS NOT NULL LIMIT 1) THEN
    UPDATE tenant_products
       SET brand      = main_brand,
           main_brand = NULL;
  END IF;
END
$$;
