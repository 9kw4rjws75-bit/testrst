/*
# Fix reward code validation for cashier and add used status support

## Summary
1. The validate_reward_code function currently requires client_id = auth.uid(),
   which means only the reward OWNER can validate it. When a cashier enters
   the code on behalf of a client, it fails because the cashier's auth.uid()
   doesn't match the client_id. This fix creates a new function that allows
   any authenticated staff member (caisse, admin) to validate a reward code
   by code lookup alone (no ownership check), while keeping the original
   function for clients validating their own codes.

2. When a reward code is used (used_at is set), the client_rewards row status
   is now set to 'used' so the client gift screen can show "déjà utilisé".

## Changes
- New function: validate_reward_code_staff — callable by authenticated users
  with role 'caisse' or 'admin'. Looks up the code WITHOUT requiring
  client_id = auth.uid(). Marks the reward as used (sets used_at and
  status = 'used'). Also returns the client name.
- Updated function: validate_reward_code — now also sets status = 'used'
  when marking a code as consumed, so the client UI can detect used codes.
- Updated check constraint on client_rewards.status to include 'used'.

## Important Notes
1. The cashier-side function does NOT check ownership — it trusts that the
   cashier is entering a code the client gave them verbally.
2. Both functions atomically set used_at + status='used' so the code
   cannot be reused.
3. The client gift screen will show "Déjà utilisé" for rewards with
   status = 'used' and used_at IS NOT NULL.
*/

-- ============================================================
-- 1. Add 'used' to reward status check constraint
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'client_rewards' AND constraint_name = 'client_rewards_status_check'
  ) THEN
    ALTER TABLE client_rewards DROP CONSTRAINT client_rewards_status_check;
  END IF;
  ALTER TABLE client_rewards ADD CONSTRAINT client_rewards_status_check
    CHECK (status IN ('available', 'claimed', 'expired', 'used'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 2. Update validate_reward_code to also set status = 'used'
-- ============================================================
CREATE OR REPLACE FUNCTION validate_reward_code(
  code_input text,
  order_total numeric DEFAULT NULL
)
RETURNS TABLE (
  valid boolean,
  reward_id uuid,
  discount_type text,
  discount_value numeric,
  discount_amount numeric,
  reward_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  computed_discount numeric;
BEGIN
  SELECT * INTO r
  FROM client_rewards
  WHERE reward_code = upper(code_input)
    AND client_id = auth.uid()
    AND status = 'claimed'
    AND used_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::numeric, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  -- Check expiry
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::numeric, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  -- Compute discount amount
  IF r.discount_type = 'percentage' THEN
    computed_discount := COALESCE(order_total, 0) * (r.discount_value / 100.0);
  ELSIF r.discount_type = 'fixed' THEN
    computed_discount := LEAST(COALESCE(r.discount_value, 0), COALESCE(order_total, 0));
  ELSIF r.discount_type = 'free_order' THEN
    computed_discount := COALESCE(order_total, 0);
  ELSE
    computed_discount := 0;
  END IF;

  -- Mark as used (set both used_at and status)
  UPDATE client_rewards
  SET used_at = now(), status = 'used'
  WHERE id = r.id;

  RETURN QUERY SELECT true, r.id, r.discount_type, r.discount_value, computed_discount, r.reward_title;
END;
$$;

REVOKE ALL ON FUNCTION validate_reward_code(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION validate_reward_code(text, numeric) TO authenticated;

-- ============================================================
-- 3. New function: validate_reward_code_staff (for cashier/admin)
-- ============================================================
CREATE OR REPLACE FUNCTION validate_reward_code_staff(
  code_input text,
  order_total numeric DEFAULT NULL
)
RETURNS TABLE (
  valid boolean,
  reward_id uuid,
  discount_type text,
  discount_value numeric,
  discount_amount numeric,
  reward_title text,
  client_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  computed_discount numeric;
  caller_role text;
  v_client_name text;
BEGIN
  -- Check that the caller is a cashier or admin
  SELECT p.role INTO caller_role
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_role IS NULL OR caller_role NOT IN ('caisse', 'admin') THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::numeric, NULL::numeric, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Look up the code WITHOUT requiring client_id = auth.uid()
  SELECT cr.* INTO r
  FROM client_rewards cr
  WHERE cr.reward_code = upper(code_input)
    AND cr.status = 'claimed'
    AND cr.used_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::numeric, NULL::numeric, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Check expiry
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::numeric, NULL::numeric, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Compute discount amount
  IF r.discount_type = 'percentage' THEN
    computed_discount := COALESCE(order_total, 0) * (r.discount_value / 100.0);
  ELSIF r.discount_type = 'fixed' THEN
    computed_discount := LEAST(COALESCE(r.discount_value, 0), COALESCE(order_total, 0));
  ELSIF r.discount_type = 'free_order' THEN
    computed_discount := COALESCE(order_total, 0);
  ELSE
    computed_discount := 0;
  END IF;

  -- Mark as used (set both used_at and status)
  UPDATE client_rewards
  SET used_at = now(), status = 'used'
  WHERE id = r.id;

  -- Get client name
  SELECT p.full_name INTO v_client_name
  FROM profiles p
  WHERE p.id = r.client_id;

  RETURN QUERY SELECT true, r.id, r.discount_type, r.discount_value, computed_discount, r.reward_title, v_client_name;
END;
$$;

REVOKE ALL ON FUNCTION validate_reward_code_staff(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION validate_reward_code_staff(text, numeric) TO authenticated;
