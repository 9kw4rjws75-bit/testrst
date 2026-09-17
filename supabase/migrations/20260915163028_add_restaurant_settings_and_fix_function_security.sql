/*
# Add restaurant_settings table and fix SECURITY DEFINER function permissions

## 1. New Table: restaurant_settings
- `restaurant_settings` — stores the restaurant's configuration (name, address, GPS coordinates, delivery fees, delivery radius)
- `id` (int, primary key, fixed to 1 for singleton row)
- `restaurant_name` (text, not null)
- `address` (text, not null)
- `latitude` (numeric, not null)
- `longitude` (numeric, not null)
- `delivery_fee_base` (integer, not null, default 500)
- `delivery_fee_per_km` (integer, not null, default 300)
- `delivery_radius_km` (numeric, not null, default 10)
- `updated_at` (timestamptz, default now())
- Seeded with default values for "Le Gourmet" restaurant

## 2. Security — restaurant_settings
- RLS enabled
- SELECT: public (anon + authenticated) — clients need to read delivery fees and restaurant info
- UPDATE: admin only — only admin can change restaurant configuration

## 3. Security — Function permission fixes
- `handle_new_user()` trigger function: REVOKE EXECUTE from anon and authenticated.
  This is a trigger function called on user creation, not meant to be called via RPC.
- `get_user_role()`, `get_user_status()`: These are needed by RLS policies and the frontend
  during session validation. They remain callable by anon + authenticated (intentional).
- `validate_role_code()`, `consume_role_code()`: Needed during staff sign-up (before auth).
  They remain callable by anon (intentional).
- `generate_order_number()`: Needed for order creation by anon clients. Remains callable (intentional).

## 4. Notes
- The `restaurant_settings` table is a singleton (id=1). The frontend reads it with `.eq('id', 1).maybeSingle()`.
- Default coordinates are set to Dakar, Senegal (14.6928, -17.4467).
- Delivery fees: 500 base + 300 per km, matching the frontend defaults.
*/

-- ============ restaurant_settings table ============
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id integer PRIMARY KEY DEFAULT 1,
  restaurant_name text NOT NULL DEFAULT 'Le Gourmet',
  address text NOT NULL DEFAULT 'Dakar, Sénégal',
  latitude numeric NOT NULL DEFAULT 14.6928,
  longitude numeric NOT NULL DEFAULT -17.4467,
  delivery_fee_base integer NOT NULL DEFAULT 500,
  delivery_fee_per_km integer NOT NULL DEFAULT 300,
  delivery_radius_km numeric NOT NULL DEFAULT 10,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT singleton_check CHECK (id = 1)
);

ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Seed the singleton row
INSERT INTO restaurant_settings (id, restaurant_name, address, latitude, longitude, delivery_fee_base, delivery_fee_per_km, delivery_radius_km)
VALUES (1, 'Le Gourmet', 'Dakar, Sénégal', 14.6928, -17.4467, 500, 300, 10)
ON CONFLICT (id) DO NOTHING;

-- Policies for restaurant_settings
DROP POLICY IF EXISTS "select_restaurant_settings_public" ON restaurant_settings;
CREATE POLICY "select_restaurant_settings_public"
ON restaurant_settings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "update_restaurant_settings_admin" ON restaurant_settings;
CREATE POLICY "update_restaurant_settings_admin"
ON restaurant_settings FOR UPDATE
TO authenticated
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

-- ============ Fix SECURITY DEFINER function permissions ============
-- handle_new_user is a trigger function, not meant to be called via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- get_user_role: restrict to authenticated only (used in RLS + frontend auth context)
-- anon calling this returns NULL which is the expected behavior for unauthenticated users
-- but we keep it callable because RLS policies on public tables reference it
-- (e.g., orders SELECT uses get_user_role() for staff checks, and anon needs to SELECT orders)
-- So we keep EXECUTE on anon for get_user_role and get_user_status

-- generate_order_number: keep callable by anon (clients create orders without login)
-- validate_role_code: keep callable by anon (staff registration before auth)
-- consume_role_code: keep callable by anon (staff registration before auth)