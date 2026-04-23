-- Backfill profile rows for any existing auth users that predate
-- the signup trigger or were created while it was unavailable.
INSERT INTO public.profiles (id)
SELECT au.id
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
