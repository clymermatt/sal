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
