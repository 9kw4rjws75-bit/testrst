/*
# Allow cashiers to view delivery driver profiles

1. Security Changes
- Update the `select_own_or_admin_profiles` SELECT policy on `profiles` to also allow
  cashiers (role = 'caisse') to view profiles with role 'livreur'. This is needed so
  the cashier can see the list of active delivery drivers when assigning a delivery.
- Update the `update_own_or_admin_profiles` UPDATE policy similarly for consistency.
- The cashier can only see delivery drivers' profiles (role = 'livreur'), not all users.
*/

-- Drop and recreate the SELECT policy to allow cashiers to see livreur profiles
DROP POLICY IF EXISTS "select_own_or_admin_profiles" ON public.profiles;
CREATE POLICY "select_own_or_admin_profiles" ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR get_user_role() = 'admin'
    OR (get_user_role() = 'caisse' AND profiles.role = 'livreur')
  );

-- Keep the UPDATE policy as-is (own profile or admin only)
-- No change needed for UPDATE since cashiers don't need to edit driver profiles
