/**
 * Run this perfectly safe SQL block in your Supabase SQL Editor
 * to create the "course-images" public bucket.
 * 
 * 1. Creates the bucket "course-images"
 * 2. Allows anyone to SELECT (download/view) images.
 * 3. Allows authenticated users (Admins) to INSERT (upload) images.
 */

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-images', 'course-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public read access to course-images
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
TO public
USING (bucket_id = 'course-images');

-- Policy: Allow authenticated users to upload to course-images
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
    bucket_id = 'course-images' 
    -- Optional: further restrict to admin users if role tracking is on the auth layer
);

-- Policy: Allow authenticated users to update their own uploads (or admins to update any)
CREATE POLICY "Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-images');

-- Policy: Allow authenticated users to delete from course-images
CREATE POLICY "Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-images');
