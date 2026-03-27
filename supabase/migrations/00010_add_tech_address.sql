ALTER TABLE technicians
  ADD COLUMN last_known_address TEXT;

COMMENT ON COLUMN technicians.last_known_address IS 'Last known location/address for drive time calculations. Updated when tech completes a job.';
