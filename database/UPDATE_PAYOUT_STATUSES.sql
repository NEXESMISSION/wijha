-- Update payout_requests table to add 'canceled' and 'done' statuses
-- This script updates the CHECK constraint to include the new statuses

-- First, drop the existing constraint
ALTER TABLE payout_requests 
DROP CONSTRAINT IF EXISTS payout_requests_status_check;

-- Add the new constraint with all statuses: pending, approved, rejected, canceled, done
ALTER TABLE payout_requests
ADD CONSTRAINT payout_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'canceled', 'done'));

-- Update any existing records if needed (optional - uncomment if you want to migrate existing data)
-- UPDATE payout_requests 
-- SET status = 'done' 
-- WHERE status = 'approved' AND approved_at IS NOT NULL;

-- Verify the constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.payout_requests'::regclass
AND conname = 'payout_requests_status_check';

-- Show current status distribution
SELECT 
    status,
    COUNT(*) as count
FROM payout_requests
GROUP BY status
ORDER BY count DESC;

