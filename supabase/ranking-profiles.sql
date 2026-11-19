-- Automatic ranking and student profiles.
-- Run this in Supabase → SQL Editor → New query (after ranking-and-account.sql).

-- Everyone who has answered questions is in the ranking; "hidden" lets a student step out.
alter table public.leaderboard add column if not exists hidden boolean not null default false;

-- Detailed stats shown in "View profile" (per domain, index components, recent exams, activity)
alter table public.leaderboard add column if not exists profile jsonb;

alter table public.leaderboard drop constraint if exists leaderboard_profile_size;
alter table public.leaderboard add constraint leaderboard_profile_size
  check (profile is null or pg_column_size(profile) < 8000);

-- Hidden students are only visible to themselves and to the admins
drop policy if exists "students with access see the ranking" on public.leaderboard;
create policy "students with access see the ranking" on public.leaderboard
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      not hidden
      and exists (
        select 1 from public.entitlements e
        where e.user_id = auth.uid() and e.cert = leaderboard.cert
      )
    )
  );
