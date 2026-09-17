/*
# Update order status flow

1. Changes
- Add 'recupere' to the order status CHECK constraint. This new status marks the end of the cycle for on-site (sur_place) orders, when the cashier marks the order as picked up by the customer.
- Remove 'paye' from the order status CHECK constraint. Payment is now tracked solely via the `payment_status` column ('en_attente' / 'paye'). The order lifecycle no longer uses 'paye' as an order status.
- The new flow is: en_attente → en_preparation (on payment) → pret → en_livraison (delivery only, via assignment) → livre (delivery) OR recupere (on-site pickup).
- Both 'livre' and 'recupere' are terminal states.

2. Security
- No policy changes. Existing RLS policies on orders remain valid.
*/

-- Drop the old constraint and add the new one with 'recupere' added and 'paye' removed
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('en_attente', 'en_preparation', 'pret', 'en_livraison', 'livre', 'recupere', 'annule'));

-- Update any existing orders with status 'paye' to 'en_preparation' (they were paid, so they're in preparation)
UPDATE public.orders SET status = 'en_preparation' WHERE status = 'paye';
