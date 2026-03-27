-- Add status tracking to quotes
ALTER TABLE quotes ADD COLUMN status TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'sent', 'approved', 'expired', 'declined'));

-- Track follow-up state
ALTER TABLE quotes ADD COLUMN last_followup_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN followup_count INT NOT NULL DEFAULT 0;

-- Link to the call/conversation that created the quote
ALTER TABLE quotes ADD COLUMN source TEXT DEFAULT 'agent';

CREATE INDEX idx_quotes_status ON quotes (business_id, status) WHERE status IN ('open', 'sent');