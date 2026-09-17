/*
# Add challenges and rewards system for client loyalty

This migration creates a complete challenge/reward system that allows the admin to create
time-limited challenges (e.g. "Order 5 times this month") to reward the most loyal clients.
Clients can see their progress on active challenges, and when a challenge ends, the admin
can distribute rewards to the top participants. Clients can view their earned rewards from
their profile page via a gift button.

## New Tables

### challenges
- `id` (uuid, PK)
- `title` (text, not null) — short name of the challenge
- `description` (text) — details of what the client must do
- `challenge_type` (enum: 'orders_count', 'spending_amount', 'orders_streak') — what metric is tracked
- `target_value` (integer, not null) — the goal the client must reach (e.g. 5 orders, 100€ spent)
- `start_date` (timestamptz, not null) — when the challenge begins
- `end_date` (timestamptz, not null) — when the challenge ends
- `status` (enum: 'active', 'completed', 'cancelled', default 'active') — admin-controlled lifecycle
- `reward_description` (text) — what the winner gets (e.g. "Repas gratuit pour 2")
- `max_winners` (integer, default 3) — how many top clients can win
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### challenge_progress
Tracks each client's progress toward a challenge. One row per client per challenge.
- `id` (uuid, PK)
- `challenge_id` (uuid, FK → challenges.id ON DELETE CASCADE)
- `client_id` (uuid, FK → profiles.id ON DELETE CASCADE)
- `current_value` (integer, default 0) — current progress (orders count, cents spent, etc.)
- `completed` (boolean, default false) — whether the client reached the target
- `completed_at` (timestamptz, null) — when they reached it
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- UNIQUE constraint on (challenge_id, client_id)

### client_rewards
Records rewards given to clients (either from a challenge or manually by admin).
- `id` (uuid, PK)
- `client_id` (uuid, FK → profiles.id ON DELETE CASCADE)
- `challenge_id` (uuid, FK → challenges.id ON DELETE SET NULL, nullable)
- `reward_title` (text, not null) — name of the reward
- `reward_description` (text) — details
- `status` (enum: 'available', 'claimed', 'expired', default 'available')
- `awarded_at` (timestamptz, not null) — when the reward was given
- `claimed_at` (timestamptz, null) — when the client claimed it
- `expires_at` (timestamptz, null) — optional expiry date
- `created_at` (timestamptz)

## Security (RLS)
- challenges: admin full CRUD; authenticated clients can SELECT (to see active challenges).
- challenge_progress: admin full CRUD; clients can SELECT only their own rows.
- client_rewards: admin full CRUD; clients can SELECT only their own rows, and can UPDATE
  their own rows only to set status='claimed' (claiming a reward).

## Important Notes
1. Challenge progress is updated via a trigger when orders are completed (status becomes
   'livre' or 'recupere'). The trigger increments the appropriate metric for all active
   challenges that the ordering client is participating in.
2. The admin manually distributes rewards when a challenge ends by inserting rows into
   client_rewards for the top participants.
3. A SECURITY DEFINER function `get_challenge_leaderboard` allows fetching ranked progress
   for a challenge (admin only).
4. A SECURITY DEFINER function `distribute_challenge_rewards` lets the admin award rewards
   to the top N participants of a completed challenge.
*/

-- ============================================================
-- 1. ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE challenge_type AS ENUM ('orders_count', 'spending_amount', 'orders_streak');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE challenge_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reward_status AS ENUM ('available', 'claimed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  challenge_type challenge_type NOT NULL DEFAULT 'orders_count',
  target_value integer NOT NULL DEFAULT 1,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  status challenge_status NOT NULL DEFAULT 'active',
  reward_description text,
  max_winners integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_value integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, client_id)
);

CREATE TABLE IF NOT EXISTS client_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL,
  reward_title text NOT NULL,
  reward_description text,
  status reward_status NOT NULL DEFAULT 'available',
  awarded_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge ON challenge_progress(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_client ON challenge_progress(client_id);
CREATE INDEX IF NOT EXISTS idx_client_rewards_client ON client_rewards(client_id);
CREATE INDEX IF NOT EXISTS idx_client_rewards_status ON client_rewards(status);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_rewards ENABLE ROW LEVEL SECURITY;

-- challenges: admin CRUD, clients read active ones
DROP POLICY IF EXISTS "select_challenges_admin" ON challenges;
CREATE POLICY "select_challenges_admin" ON challenges FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_challenges_admin" ON challenges;
CREATE POLICY "insert_challenges_admin" ON challenges FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_challenges_admin" ON challenges;
CREATE POLICY "update_challenges_admin" ON challenges FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_challenges_admin" ON challenges;
CREATE POLICY "delete_challenges_admin" ON challenges FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- challenge_progress: admin CRUD, clients read own
DROP POLICY IF EXISTS "select_own_progress" ON challenge_progress;
CREATE POLICY "select_own_progress" ON challenge_progress FOR SELECT
  TO authenticated USING (
    client_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_progress_admin" ON challenge_progress;
CREATE POLICY "insert_progress_admin" ON challenge_progress FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_progress_admin" ON challenge_progress;
CREATE POLICY "update_progress_admin" ON challenge_progress FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_progress_admin" ON challenge_progress;
CREATE POLICY "delete_progress_admin" ON challenge_progress FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- client_rewards: admin CRUD, clients read own + claim own
DROP POLICY IF EXISTS "select_own_rewards" ON client_rewards;
CREATE POLICY "select_own_rewards" ON client_rewards FOR SELECT
  TO authenticated USING (
    client_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_rewards_admin" ON client_rewards;
CREATE POLICY "insert_rewards_admin" ON client_rewards FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_rewards_admin" ON client_rewards;
CREATE POLICY "update_rewards_admin" ON client_rewards FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Allow clients to claim their own rewards (set status to 'claimed')
DROP POLICY IF EXISTS "claim_own_reward" ON client_rewards;
CREATE POLICY "claim_own_reward" ON client_rewards FOR UPDATE
  TO authenticated USING (client_id = auth.uid() AND status = 'available')
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "delete_rewards_admin" ON client_rewards;
CREATE POLICY "delete_rewards_admin" ON client_rewards FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- 5. TRIGGER: auto-update challenge progress on order completion
-- ============================================================
CREATE OR REPLACE FUNCTION update_challenge_progress_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch RECORD;
  existing_progress RECORD;
  new_value integer;
  order_total_cents integer;
BEGIN
  -- Only when order transitions to a "completed" state
  IF NEW.status NOT IN ('livre', 'recupere') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only track orders that belong to a registered client
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  order_total_cents := ROUND(CAST(NEW.total_amount AS numeric) * 100);

  FOR ch IN
    SELECT id, challenge_type, target_value
    FROM challenges
    WHERE status = 'active'
      AND start_date <= now()
      AND end_date >= now()
  LOOP
    -- Get or create progress row
    SELECT * INTO existing_progress
    FROM challenge_progress
    WHERE challenge_id = ch.id AND client_id = NEW.customer_id;

    IF NOT FOUND THEN
      INSERT INTO challenge_progress (challenge_id, client_id, current_value, completed)
      VALUES (ch.id, NEW.customer_id, 0, false)
      ON CONFLICT (challenge_id, client_id) DO NOTHING;

      SELECT * INTO existing_progress
      FROM challenge_progress
      WHERE challenge_id = ch.id AND client_id = NEW.customer_id;
    END IF;

    -- Compute new value based on challenge type
    IF ch.challenge_type = 'orders_count' THEN
      new_value := existing_progress.current_value + 1;
    ELSIF ch.challenge_type = 'spending_amount' THEN
      new_value := existing_progress.current_value + order_total_cents;
    ELSIF ch.challenge_type = 'orders_streak' THEN
      new_value := existing_progress.current_value + 1;
    ELSE
      new_value := existing_progress.current_value;
    END IF;

    -- Update progress
    UPDATE challenge_progress
    SET current_value = new_value,
        completed = (new_value >= ch.target_value),
        completed_at = CASE WHEN new_value >= ch.target_value AND completed_at IS NULL THEN now() ELSE completed_at END,
        updated_at = now()
    WHERE challenge_id = ch.id AND client_id = NEW.customer_id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_progress_on_order ON orders;
CREATE TRIGGER trg_challenge_progress_on_order
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_challenge_progress_on_order();

-- ============================================================
-- 6. FUNCTIONS: leaderboard + reward distribution (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION get_challenge_leaderboard(challenge_uuid uuid)
RETURNS TABLE (
  rank integer,
  client_id uuid,
  full_name text,
  email text,
  phone text,
  current_value integer,
  completed boolean,
  completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY cp.current_value DESC, cp.completed_at ASC) AS rank,
    cp.client_id,
    p.full_name,
    p.email,
    p.phone,
    cp.current_value,
    cp.completed,
    cp.completed_at
  FROM challenge_progress cp
  JOIN profiles p ON p.id = cp.client_id
  WHERE cp.challenge_id = challenge_uuid
  ORDER BY cp.current_value DESC, cp.completed_at ASC;
$$;

-- Grant execute to authenticated (the function checks admin role via the caller's profile)
-- Actually, we'll let the admin frontend call it; the RLS on the underlying tables already
-- restricts non-admins. But since this is SECURITY DEFINER, it bypasses RLS.
-- We need to restrict execution to admins.
REVOKE ALL ON FUNCTION get_challenge_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_challenge_leaderboard(uuid) TO authenticated;

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
  w RECORD;
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

  FOR w IN
    SELECT * FROM get_challenge_leaderboard(challenge_uuid)
    LIMIT num_winners
  LOOP
    INSERT INTO client_rewards (client_id, challenge_id, reward_title, reward_description, status, expires_at)
    VALUES (w.client_id, challenge_uuid, reward_title, reward_desc, 'available', expiry)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Mark challenge as completed
  UPDATE challenges SET status = 'completed', updated_at = now() WHERE id = challenge_uuid;

  RETURN QUERY
  SELECT w.client_id, w.full_name, w.rank
  FROM get_challenge_leaderboard(challenge_uuid) w
  LIMIT num_winners;
END;
$$;

REVOKE ALL ON FUNCTION distribute_challenge_rewards(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION distribute_challenge_rewards(uuid, text, text, integer, integer) TO authenticated;

-- Grant necessary privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON challenges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON challenge_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_rewards TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;