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
