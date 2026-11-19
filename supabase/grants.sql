-- Table permissions for signed-in users.
-- New Supabase projects don't grant them automatically; row level security
-- (schema.sql) still decides which rows each user can see or change.
-- Run this in Supabase → SQL Editor → New query.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.certifications to authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.access_codes to authenticated;
grant select, insert, update, delete on public.entitlements to authenticated;
grant select, insert, update, delete on public.cert_content to authenticated;
grant select, insert, update, delete on public.user_docs to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.check_access_code(text) to anon, authenticated;
grant execute on function public.redeem_access_code(text) to authenticated;
