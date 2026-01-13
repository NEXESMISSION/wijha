-- ============================================
-- UPDATE PAYOUT REQUESTS FOR NEW PAYMENT METHODS
-- ============================================
-- This SQL file adds a CHECK constraint to ensure payment_method
-- values are valid (d17, bank, flouci)
-- 
-- Note: The existing 'note' field already stores payment details
-- (phone numbers, RIB, bank account name) so no new columns needed.

-- Drop existing constraint if it exists (if any)
ALTER TABLE payout_requests 
  DROP CONSTRAINT IF EXISTS payout_requests_payment_method_check;

-- Add CHECK constraint for valid payment methods
ALTER TABLE payout_requests 
  ADD CONSTRAINT payout_requests_payment_method_check 
  CHECK (payment_method IN ('d17', 'bank', 'flouci', 'mobile', 'cash'));

-- Note: We keep 'mobile' and 'cash' for backward compatibility
-- but new payouts should use 'd17', 'bank', or 'flouci'

-- Optional: Add a comment to document the payment methods
COMMENT ON COLUMN payout_requests.payment_method IS 
  'Payment method: d17 (requires phone), bank (requires RIB and account name), flouci (requires phone)';

COMMENT ON COLUMN payout_requests.note IS 
  'Payment details: For d17/flouci: phone number. For bank: RIB and account holder name. Additional notes optional.';

-- Verify the constraint was added
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'payout_requests'::regclass
  AND conname = 'payout_requests_payment_method_check';

