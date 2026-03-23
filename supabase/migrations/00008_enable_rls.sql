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
