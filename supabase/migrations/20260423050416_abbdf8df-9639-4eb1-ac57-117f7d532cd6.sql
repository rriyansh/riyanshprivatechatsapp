ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS private_account boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS read_receipts boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS typing_indicators boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS screenshot_protection boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS online_status_visibility text NOT NULL DEFAULT 'everyone';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_online_status_visibility_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_online_status_visibility_check
    CHECK (online_status_visibility IN ('everyone', 'followers', 'nobody'));
  END IF;
END $$;