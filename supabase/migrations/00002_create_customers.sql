CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name           TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  lat            FLOAT,
  lng            FLOAT,
  notes          TEXT,
  lifetime_value NUMERIC(12,2) DEFAULT 0,
  job_count      INT DEFAULT 0,
  last_job_at    TIMESTAMPTZ,
  on_plan        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
);
