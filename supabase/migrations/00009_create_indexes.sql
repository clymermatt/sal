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
