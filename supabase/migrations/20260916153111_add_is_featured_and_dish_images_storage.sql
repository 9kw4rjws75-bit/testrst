/*
# Add is_featured column to daily_menus + dish-images storage bucket

## 1. Schema Change: daily_menus.is_featured
- New column `is_featured` (boolean, default false) on `daily_menus`
- Purpose: distinguishes "plat du jour" (is_featured = true) from "autre plat disponible" (is_featured = false)
- The cashier sets this flag when composing the daily menu
- Both types are in daily_menus and have quantity_available/quantity_sold tracking
- Clients see two sections: "Menu du jour" (featured) and "Autres plats disponibles" (non-featured)
- Clients never see quantities; once quantity_available - quantity_sold = 0, the dish disappears from the client view

## 2. Storage Bucket: dish-images
- Public bucket for dish photos uploaded by admin
- RLS policies: anyone can read, only authenticated users can upload/update/delete
- File size limit: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp

## 3. Notes
- The admin uploads images directly from the dish form (file input → Supabase Storage)
- The image URL is stored in dishes.image_url as the public URL from storage
- No changes to existing RLS policies on daily_menus (already has proper policies)
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_menus' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE daily_menus ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create storage bucket for dish images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dish-images',
  'dish-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated write
DROP POLICY IF EXISTS "Public read dish images" ON storage.objects;
CREATE POLICY "Public read dish images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "Authenticated upload dish images" ON storage.objects;
CREATE POLICY "Authenticated upload dish images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "Authenticated update dish images" ON storage.objects;
CREATE POLICY "Authenticated update dish images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'dish-images')
WITH CHECK (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "Authenticated delete dish images" ON storage.objects;
CREATE POLICY "Authenticated delete dish images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dish-images');
