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
