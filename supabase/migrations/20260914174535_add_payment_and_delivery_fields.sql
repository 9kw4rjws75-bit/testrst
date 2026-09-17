/*
# Add payment method and delivery fee to orders

1. Modified Tables
- `orders` — add `payment_method` column (text: 'wave', 'orange_money', 'carte', 'especes', null) to track how the customer chose to pay
- `orders` — add `delivery_fee` column (numeric, default 0) to store the computed delivery fee
- `orders` — add `delivery_lat` column (double precision, nullable) for delivery latitude
- `orders` — add `delivery_lng` column (double precision, nullable) for delivery longitude
2. Security
- No policy changes needed — existing order policies already cover the new columns (INSERT has WITH CHECK true, SELECT has USING true, UPDATE for staff)
*/

-- Add payment_method column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_method text CHECK (payment_method IN ('wave', 'orange_money', 'carte', 'especes'));
  END IF;
END $$;

-- Add delivery_fee column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_fee'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN delivery_fee numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add delivery coordinates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_lat'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN delivery_lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_lng'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN delivery_lng double precision;
  END IF;
END $$;
