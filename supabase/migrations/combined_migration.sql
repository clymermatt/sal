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
CREATE TABLE technicians (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  skills       TEXT[] DEFAULT '{}',
  base_lat     FLOAT,
  base_lng     FLOAT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE service_catalog (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_type      TEXT NOT NULL,
  description   TEXT,
  flat_rate     NUMERIC(10,2),
  duration_mins INT,
  materials_est NUMERIC(10,2),
  labor_burden  NUMERIC(5,4),
  category      TEXT CHECK (category IN ('emergency', 'repair', 'installation', 'maintenance')),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  tech_id         UUID REFERENCES technicians(id),
  status          TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'en_route', 'in_progress', 'complete', 'cancelled')),
  job_type        TEXT,
  required_skills TEXT[] DEFAULT '{}',
  address         TEXT,
  lat             FLOAT,
  lng             FLOAT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end   TIMESTAMPTZ,
  estimated_mins  INT,
  is_emergency    BOOLEAN DEFAULT false,
  notes           TEXT,
  flat_rate       NUMERIC(10,2),
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id         UUID NOT NULL REFERENCES jobs(id),
  customer_id    UUID NOT NULL REFERENCES customers(id),
  line_items     JSONB DEFAULT '[]',
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'sent', 'paid', 'overdue', 'void')),
  payment_link   TEXT,
  invoiced_at    TIMESTAMPTZ DEFAULT now(),
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quotes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id         UUID REFERENCES jobs(id),
  customer_id    UUID NOT NULL REFERENCES customers(id),
  line_items     JSONB DEFAULT '[]',
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ,
  approved_at    TIMESTAMPTZ,
  payment_link   TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE action_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  agent_name     TEXT,
  action_type    TEXT,
  description    TEXT,
  input_data     JSONB DEFAULT '{}',
  output_data    JSONB DEFAULT '{}',
  was_overridden BOOLEAN DEFAULT false,
  override_by    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE owner_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  alert_type   TEXT NOT NULL,
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
-- Enable RLS on all tenant-scoped tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies: all tenant data is scoped to business_id
-- The service_role key bypasses RLS, but these policies protect
-- against any authenticated user accessing another tenant's data.

CREATE POLICY "Tenant isolation" ON customers
  FOR ALL USING (business_id = current_setting('app.business_id')::uuid);

CREATE POLICY "Tenant isolation" ON technicians
  FOR ALL USING (business_id = current_setting('app.business_id')::uuid);

CREATE POLICY "Tenant isolation" ON service_catalog
  FOR ALL USING (business_id = current_setting('app.business_id')::uuid);

CREATE POLICY "Tenant isolation" ON jobs
  FOR ALL USING (business_id = current_setting('app.business_id')::uuid);

CREATE POLICY "Tenant isolation" ON invoices
  FOR ALL USING (business_id = current_setting('app.business_id')::uuid);

CREATE POLICY "Tenant isolation" ON quotes
  FOR ALL USING (business_id = current_setting('app.business_id')::uuid);

CREATE POLICY "Tenant isolation" ON action_log
  FOR ALL USING (business_id = current_setting('app.business_id')::uuid);

CREATE POLICY "Tenant isolation" ON owner_alerts
  FOR ALL USING (business_id = current_setting('app.business_id')::uuid);
-- Business lookups
CREATE INDEX idx_businesses_pipeai_number ON businesses(pipeai_number);

-- Customer lookups
CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_customers_phone ON customers(phone);

-- Technician lookups
CREATE INDEX idx_technicians_business_id ON technicians(business_id);

-- Job queries
CREATE INDEX idx_jobs_business_id ON jobs(business_id);
CREATE INDEX idx_jobs_tech_id ON jobs(tech_id);
CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled_start ON jobs(scheduled_start);
CREATE INDEX idx_jobs_business_status ON jobs(business_id, status);

-- Invoice queries
CREATE INDEX idx_invoices_business_id ON invoices(business_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);

-- Service catalog
CREATE INDEX idx_service_catalog_business_id ON service_catalog(business_id);

-- Action log (for morning briefings and transparency)
CREATE INDEX idx_action_log_business_id ON action_log(business_id);
CREATE INDEX idx_action_log_created_at ON action_log(created_at);

-- Owner alerts
CREATE INDEX idx_owner_alerts_business_id ON owner_alerts(business_id);
