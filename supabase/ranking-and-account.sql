-- Global ranking and account deletion.
-- Run this in Supabase → SQL Editor → New query (after schema.sql).

-- Public stats of the students who chose to join the ranking of a certification
create table if not exists public.leaderboard (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cert text not null references public.certifications (id),
  display_name text not null check (char_length(display_name) between 2 and 24),
  score numeric(4, 1) not null default 0,
  readiness int not null default 0,
  coverage int not null default 0,
  accuracy7 int,
  exams_avg int,
  streak int not null default 0,
  answers int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, cert)
);

alter table public.leaderboard enable row level security;

drop policy if exists "students with access see the ranking" on public.leaderboard;
create policy "students with access see the ranking" on public.leaderboard
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.entitlements e
      where e.user_id = auth.uid() and e.cert = leaderboard.cert
    )
  );

drop policy if exists "students manage their own ranking row" on public.leaderboard;
create policy "students manage their own ranking row" on public.leaderboard
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.leaderboard to authenticated;

-- Delete my own account (progress, access and ranking go with it)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
