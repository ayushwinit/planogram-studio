-- UOM is treated as optional in the catalog form, so the column must allow
-- NULL. Older rows are unaffected; new rows with a blank UOM now store NULL
-- instead of failing the NOT NULL constraint.
ALTER TABLE tenant_products ALTER COLUMN uom DROP NOT NULL;
