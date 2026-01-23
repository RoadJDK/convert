-- Create profiles table to store user registration data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Stats
  images_converted INTEGER NOT NULL DEFAULT 0,
  videos_converted INTEGER NOT NULL DEFAULT 0,
  ai_renames_used INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for anonymous registration)
CREATE POLICY "Anyone can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (true);

-- Allow reading own profile by email (since we use anonymous auth)
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
USING (true);

-- Allow updating own profile
CREATE POLICY "Anyone can update profiles"
ON public.profiles
FOR UPDATE
USING (true);

-- Create index for email lookup
CREATE INDEX idx_profiles_email ON public.profiles(email);