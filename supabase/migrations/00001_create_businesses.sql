CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE businesses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  phone             TEXT,
  pipeai_number     TEXT UNIQUE,
  owner_cell        TEXT NOT NULL,
  owner_cell_backup TEXT,
  service_area_zips TEXT[] DEFAULT '{}',
  timezone          TEXT DEFAULT 'America/Chicago',
  business_hours    JSONB DEFAULT '{}',
  qbo_realm_id      TEXT,
  qbo_access_token  TEXT,  -- encrypted AES-256 at application level
  stripe_account_id TEXT,
  plan              TEXT NOT NULL DEFAULT 'solo' CHECK (plan IN ('solo', 'pro', 'growth')),
  created_at        TIMESTAMPTZ DEFAULT now()
);
