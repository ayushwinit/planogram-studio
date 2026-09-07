-- Folder tree for organising planograms (e.g. Choithrams > Rainbow / Perfetti).
-- Additive only: existing planograms keep folder_id = NULL, i.e. they live at the root.

CREATE TABLE IF NOT EXISTS planogram_folders (
  folder_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  -- NULL parent = top level. Self-cascade so deleting a folder drops its subtree.
  parent_folder_id uuid        REFERENCES planogram_folders(folder_id) ON DELETE CASCADE,
  folder_name      text        NOT NULL,
  created_by       uuid        NOT NULL REFERENCES tenant_users(user_id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- One folder name per parent, case-insensitive. Two partial indexes because
-- NULL parent_folder_id never compares equal in a plain unique index.
CREATE UNIQUE INDEX IF NOT EXISTS planogram_folders_root_name_key
  ON planogram_folders (tenant_id, lower(folder_name))
  WHERE parent_folder_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS planogram_folders_child_name_key
  ON planogram_folders (tenant_id, parent_folder_id, lower(folder_name))
  WHERE parent_folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS planogram_folders_parent_idx
  ON planogram_folders (tenant_id, parent_folder_id);

-- Planograms point at the folder they live in. NULL = root.
ALTER TABLE planograms
  ADD COLUMN IF NOT EXISTS folder_id uuid
  REFERENCES planogram_folders(folder_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS planograms_folder_idx
  ON planograms (tenant_id, folder_id);
