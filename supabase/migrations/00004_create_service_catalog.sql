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
