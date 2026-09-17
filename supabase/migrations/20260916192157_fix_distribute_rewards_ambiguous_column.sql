/*
# Fix distribute_challenge_rewards ambiguous column reference

The function `distribute_challenge_rewards` had a bug where the alias `w` was used
both as the FOR loop record variable AND as the table alias in the RETURN QUERY,
causing "column reference w.client_id is ambiguous". Also the RETURN type expected
`rank_pos` but the query selected `w.rank` which was the loop variable's field name
instead of the function output column name.

This migration recreates the function with distinct aliases and proper column mapping.
*/

CREATE OR REPLACE FUNCTION distribute_challenge_rewards(
  challenge_uuid uuid,
  reward_title text,
  reward_desc text DEFAULT NULL,
  num_winners integer DEFAULT 3,
  expires_days integer DEFAULT NULL
)
RETURNS TABLE (client_id uuid, full_name text, rank_pos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
  ch RECORD;
  entry RECORD;
  expiry timestamptz;
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

  FOR entry IN
    SELECT * FROM get_challenge_leaderboard(challenge_uuid)
    LIMIT num_winners
  LOOP
    INSERT INTO client_rewards (client_id, challenge_id, reward_title, reward_description, status, expires_at)
    VALUES (entry.client_id, challenge_uuid, reward_title, reward_desc, 'available', expiry)
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE challenges SET status = 'completed', updated_at = now() WHERE id = challenge_uuid;

  RETURN QUERY
    SELECT lb.client_id, lb.full_name, lb.rank
    FROM get_challenge_leaderboard(challenge_uuid) lb
    LIMIT num_winners;
END;
$$;

REVOKE ALL ON FUNCTION distribute_challenge_rewards(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION distribute_challenge_rewards(uuid, text, text, integer, integer) TO authenticated;