-- Replace simple return_visit with proper hold system
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('booked', 'en_route', 'in_progress', 'on_hold', 'return_scheduled', 'complete', 'cancelled'));

-- Hold reason: why the job is paused
ALTER TABLE jobs ADD COLUMN hold_reason TEXT;
ALTER TABLE jobs ADD CONSTRAINT jobs_hold_reason_check
  CHECK (hold_reason IS NULL OR hold_reason IN (
    'scheduling_overflow',     -- tech ran out of time, needs to come back
    'parts_needed',            -- waiting on parts from supplier
    'equipment_needed',        -- need specialty equipment not on truck
    'customer_material',       -- customer needs to get correct materials
    'scope_change',            -- bigger problem found, revised quote needed
    'customer_approval',       -- waiting for customer to approve quote
    'financing_needed',        -- customer arranging financing
    'access_issue',            -- can't access work area, customer must clear
    'permit_required',         -- need to pull permit before work can proceed
    'inspection_needed',       -- mid-job inspection must pass before continuing
    'utility_locate',          -- 811 call-before-you-dig required
    'second_tech_needed',      -- job requires two people
    'senior_review',           -- owner/lead tech needs to assess
    'safety_hazard',           -- unsafe conditions, specialist must clear first
    'property_coordination',   -- need to coordinate with property manager
    'code_issue'               -- existing work not to code, revised scope needed
  ));

-- Who is blocking progress
ALTER TABLE jobs ADD COLUMN hold_blocker TEXT;
ALTER TABLE jobs ADD CONSTRAINT jobs_hold_blocker_check
  CHECK (hold_blocker IS NULL OR hold_blocker IN ('internal', 'customer', 'external'));

-- Optional: expected resolution date (e.g., parts ETA, permit expected date)
ALTER TABLE jobs ADD COLUMN hold_expected_clear DATE;

-- Optional: notes about the hold (e.g., "Ferguson order #12345, ETA Wed")
ALTER TABLE jobs ADD COLUMN hold_notes TEXT;

-- Index for finding held jobs efficiently
CREATE INDEX idx_jobs_on_hold ON jobs (business_id, status) WHERE status IN ('on_hold', 'return_scheduled');

COMMENT ON COLUMN jobs.hold_reason IS 'Why the job is on hold — determines what action Sal takes';
COMMENT ON COLUMN jobs.hold_blocker IS 'Who needs to act: internal (us), customer, or external (govt/supplier/specialist)';
COMMENT ON COLUMN jobs.hold_expected_clear IS 'When we expect the blocker to clear — for proactive follow-up';
