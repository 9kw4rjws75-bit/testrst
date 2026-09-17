/*
# Add weekly_menus table

## 1. New Table: weekly_menus
- `weekly_menus` — plats planifiés pour chaque jour de la semaine (lundi–dimanche)
- `id` (uuid, primary key)
- `dish_id` (uuid, FK vers dishes)
- `day_of_week` (integer 0=dimanche..6=samedi, correspond à JS Date.getDay())
- `is_active` (boolean, default true) — le caissier peut activer/désactiver un plat du menu hebdo
- `created_at` (timestamptz)
- Unique constraint sur (dish_id, day_of_week) pour éviter les doublons

## 2. Security
- RLS enabled
- SELECT: public (anon + authenticated) — les clients consultent le menu hebdo
- INSERT/UPDATE/DELETE: staff only (admin, caisse)

## 3. Notes
- Le menu hebdo est consultable par les clients depuis la page menu
- Le caissier gère quels plats apparaissent quel jour de la semaine
- Contrairement au menu du jour, pas de gestion de quantité — c'est une carte planifiée
*/

CREATE TABLE IF NOT EXISTS weekly_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (dish_id, day_of_week)
);

ALTER TABLE weekly_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_weekly_menus_public" ON weekly_menus;
CREATE POLICY "select_weekly_menus_public"
ON weekly_menus FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_weekly_menus_staff" ON weekly_menus;
CREATE POLICY "insert_weekly_menus_staff"
ON weekly_menus FOR INSERT
TO authenticated
WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'caisse'::text]));

DROP POLICY IF EXISTS "update_weekly_menus_staff" ON weekly_menus;
CREATE POLICY "update_weekly_menus_staff"
ON weekly_menus FOR UPDATE
TO authenticated
USING (get_user_role() = ANY (ARRAY['admin'::text, 'caisse'::text]))
WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'caisse'::text]));

DROP POLICY IF EXISTS "delete_weekly_menus_staff" ON weekly_menus;
CREATE POLICY "delete_weekly_menus_staff"
ON weekly_menus FOR DELETE
TO authenticated
USING (get_user_role() = ANY (ARRAY['admin'::text, 'caisse'::text]));

CREATE INDEX IF NOT EXISTS idx_weekly_menus_day_of_week ON weekly_menus(day_of_week);
