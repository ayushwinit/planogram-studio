CREATE TABLE IF NOT EXISTS tenant_users (
  user_id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_name     text        NOT NULL,
  user_email    text        NOT NULL,
  user_password text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_user_email_key
  ON tenant_users (lower(user_email));

CREATE INDEX IF NOT EXISTS tenant_users_tenant_id_idx
  ON tenant_users (tenant_id);
