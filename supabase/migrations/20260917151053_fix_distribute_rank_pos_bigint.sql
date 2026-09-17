/*
# Fix distribute_challenge_rewards: change rank_pos return type to bigint

## Problem
ROW_NUMBER() returns bigint. In PL/pgSQL RETURN QUERY, casting ::integer
is not sufficient — PostgreSQL type-checks the query structure against the
declared return type before applying the cast, causing:
"Returned type bigint does not match expected type integer in column 3"

## Fix
Change rank_pos from integer to bigint in the RETURNS TABLE declaration.
JSON serializes bigint as a regular number, so the frontend is unaffected.
*/

DROP FUNCTION IF EXISTS distribute_challenge_rewards(uuid, text, text, integer, integer);
DROP FUNCTION IF EXISTS distribute_challenge_rewards(uuid, text, text, integer, integer, text, text, numeric);

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
RETURNS TABLE (client_id uuid, full_name text, rank_pos bigint, reward_code text)
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

  IF selection_mode_arg = 'lottery' THEN
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

  UPDATE challenges SET status = 'completed', updated_at = now() WHERE id = challenge_uuid;

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
