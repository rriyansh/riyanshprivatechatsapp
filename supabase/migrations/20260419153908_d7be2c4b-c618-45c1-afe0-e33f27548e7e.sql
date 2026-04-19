ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- Mark existing users as onboarded so they don't get pushed into the wizard
UPDATE public.profiles SET onboarded = true WHERE onboarded = false;