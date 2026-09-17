/*
# Add reward codes, lottery selection mode, and discount fields

## Summary
Enhances the challenges/rewards system so that:
1. When the admin distributes rewards, a unique reward code is generated for each winner.
2. The client sees the code when they claim their reward and can enter it at checkout to
   apply a discount (percentage or fixed amount, or a free order).
3. The admin can choose between two winner selection modes when creating a challenge:
   - "leaderboard": top N participants by progress (existing behavior)
   - "lottery": random draw among all participants who reached the target

## Changes

### challenges table — new columns
- `selection_mode` (text, default 'leaderboard') — 'leaderboard' or 'lottery'
- `discount_type` (text, nullable) — 'percentage', 'fixed', or 'free_order'
- `discount_value` (numeric, nullable) — percentage (0-100), fixed amount in euros, or null for free_order

### client_rewards table — new columns
- `reward_code` (text, nullable) — unique code generated at distribution time
- `discount_type` (text, nullable) — copied from the challenge at distribution time
- `discount_value` (numeric, nullable) — copied from the challenge
- `used_at` (timestamptz, nullable) — set when the code is consumed at checkout

### New function: validate_reward_code
- SECURITY DEFINER function callable by authenticated users
- Takes a reward code + order total, returns discount info and marks the reward as used
- Validates that the code belongs to the caller, is not expired, and is not already used

### Updated function: distribute_challenge_rewards
- Now accepts selection_mode, discount_type, discount_value parameters
- Generates a unique 8-char reward code for each winner
- For lottery mode: randomly selects among participants who completed the challenge
- Inserts reward_code, discount_type, discount_value into client_rewards

### Security
- RLS on new columns is covered by existing policies (column-level not needed)
- validate_reward_code is SECURITY DEFINER, checks ownership internally
- distribute_challenge_rewards updated with same admin check

## Important Notes
1. Reward codes are 8-character alphanumeric strings (uppercase, no ambiguous chars)
2. A reward code can only be used once — used_at is set on validation
3. The discount is applied at checkout: percentage reduces the total, fixed subtracts an amount, free_order zeroes it
4. Lottery mode picks randomly among participants who reached the target (completed = true)
5. If fewer participants completed than num_winners, all completers win
*/

-- ============================================================
-- 1. ADD COLUMNS TO challenges
-- ============================================================
DO $$ BEGIN
  ALTER TABLE challenges ADD COLUMN selection_mode text NOT NULL DEFAULT 'leaderboard';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE challenges ADD COLUMN discount_type text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE challenges ADD COLUMN discount_value numeric(10,2);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- 2. ADD COLUMNS TO client_rewards
-- ============================================================
DO $$ BEGIN
  ALTER TABLE client_rewards ADD COLUMN reward_code text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE client_rewards ADD COLUMN discount_type text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE client_rewards ADD COLUMN discount_value numeric(10,2);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE client_rewards ADD COLUMN used_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Unique index on reward_code (partial — only non-null codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_rewards_reward_code
  ON client_rewards (reward_code)
  WHERE reward_code IS NOT NULL;

-- ============================================================
-- 3. FUNCTION: generate_reward_code (helper)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_reward_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  attempts integer := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    END LOOP;
    attempts := attempts + 1;
    IF NOT EXISTS (SELECT 1 FROM client_rewards WHERE reward_code = code) THEN
      RETURN code;
    END IF;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Unable to generate unique reward code after 50 attempts';
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 4. UPDATED FUNCTION: distribute_challenge_rewards
-- ============================================================
CREATE OR REPLACE FUNCTION distribute_challenge_rewards(
  challenge_uuid uuid,
  reward_title text,
  reward_desc text DEFAULT NULL,
  num_winners integer DEFAULT 3,
  expires_days integer DEFAULT NULL,
  selection_mode_arg text DEFAULT 'leaderboard',
  discount_type_arg text DEFAULT NULL,
  discount_value_arg numeric DEFAULT NULL
)
RETURNS TABLE (client_id uuid, full_name text, rank_pos integer, reward_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
  ch RECORD;
  entry RECORD;
  expiry timestamptz;
  code text;
  winner_count integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) INTO caller_is_admin;

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Seul l''administrateur peut distribuer des récompenses.';
  END IF;

  SELECT * INTO ch FROM challenges WHERE id = challenge_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge introuvable.';
  END IF;

  IF expires_days IS NOT NULL THEN
    expiry := now() + (expires_days || ' days')::interval;
  ELSE
    expiry := NULL;
  END IF;

  -- Insert rewards for winners
  IF selection_mode_arg = 'lottery' THEN
    -- Random draw among participants who completed the challenge
    FOR entry IN
      SELECT cp.client_id, p.full_name
      FROM challenge_progress cp
      JOIN profiles p ON p.id = cp.client_id
      WHERE cp.challenge_id = challenge_uuid
        AND cp.completed = true
      ORDER BY random()
      LIMIT num_winners
    LOOP
      code := generate_reward_code();
      INSERT INTO client_rewards (client_id, challenge_id, reward_title, reward_description, status, expires_at, reward_code, discount_type, discount_value)
      VALUES (entry.client_id, challenge_uuid, reward_title, reward_desc, 'available', expiry, code, discount_type_arg, discount_value_arg)
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        winner_count := winner_count + 1;
      END IF;
    END LOOP;

    -- If no completers, fall back to top of leaderboard
    IF winner_count = 0 THEN
      FOR entry IN
        SELECT lb.client_id, lb.full_name, lb.rank
        FROM get_challenge_leaderboard(challenge_uuid) lb
        LIMIT num_winners
      LOOP
        code := generate_reward_code();
        INSERT INTO client_rewards (client_id, challenge_id, reward_title, reward_description, status, expires_at, reward_code, discount_type, discount_value)
        VALUES (entry.client_id, challenge_uuid, reward_title, reward_desc, 'available', expiry, code, discount_type_arg, discount_value_arg)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  ELSE
    -- Leaderboard mode: top N by progress
    FOR entry IN
      SELECT lb.client_id, lb.full_name, lb.rank
      FROM get_challenge_leaderboard(challenge_uuid) lb
      LIMIT num_winners
    LOOP
      code := generate_reward_code();
      INSERT INTO client_rewards (client_id, challenge_id, reward_title, reward_description, status, expires_at, reward_code, discount_type, discount_value)
      VALUES (entry.client_id, challenge_uuid, reward_title, reward_desc, 'available', expiry, code, discount_type_arg, discount_value_arg)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Mark challenge as completed
  UPDATE challenges SET status = 'completed', updated_at = now() WHERE id = challenge_uuid;

  -- Return winners with their codes
  RETURN QUERY
    SELECT cr.client_id, p.full_name, ROW_NUMBER() OVER (ORDER BY cr.awarded_at) AS rank_pos, cr.reward_code
    FROM client_rewards cr
    JOIN profiles p ON p.id = cr.client_id
    WHERE cr.challenge_id = challenge_uuid
      AND cr.reward_code IS NOT NULL
    ORDER BY cr.awarded_at;
END;
$$;

REVOKE ALL ON FUNCTION distribute_challenge_rewards(uuid, text, text, integer, integer, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION distribute_challenge_rewards(uuid, text, text, integer, integer, text, text, numeric) TO authenticated;

-- ============================================================
-- 5. FUNCTION: validate_reward_code
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

  -- Mark as used
  UPDATE client_rewards
  SET used_at = now()
  WHERE id = r.id;

  RETURN QUERY SELECT true, r.id, r.discount_type, r.discount_value, computed_discount, r.reward_title;
END;
$$;

REVOKE ALL ON FUNCTION validate_reward_code(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION validate_reward_code(text, numeric) TO authenticated;