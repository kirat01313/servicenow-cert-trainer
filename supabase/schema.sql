-- ServiceNow Cert Trainer · database schema
-- Run this once in Supabase → SQL Editor → New query.

-- Certifications the site can teach (CSA now, CAD and others later)
create table if not exists public.certifications (
  id text primary key,
  name text not null,
  active boolean not null default true,
  sort int not null default 0
);

insert into public.certifications (id, name, active, sort) values
  ('csa', 'Certified System Administrator', true, 1),
  ('cad', 'Certified Application Developer', false, 2)
on conflict (id) do nothing;

-- People who can upload content and manage access codes
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Access codes given to a class (or sold later)
create table if not exists public.access_codes (
  code text primary key,
  cert text not null references public.certifications (id),
  label text,
  active boolean not null default true,
  max_uses int,
  uses int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Which user can study which certification
create table if not exists public.entitlements (
  user_id uuid not null references auth.users on delete cascade,
  cert text not null references public.certifications (id),
  source text not null default 'code',
  code text references public.access_codes (code) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, cert)
);

-- Questions, notes, topics and labs of each certification (JSON split in parts)
create table if not exists public.cert_content (
  cert text not null references public.certifications (id),
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (cert, key)
);

-- Each user's progress (one row per document: progress, days, exams, labs, log-YYYY-MM)
create table if not exists public.user_docs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  doc text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc)
);

-- Row level security
alter table public.certifications enable row level security;
alter table public.admins enable row level security;
alter table public.access_codes enable row level security;
alter table public.entitlements enable row level security;
alter table public.cert_content enable row level security;
alter table public.user_docs enable row level security;

drop policy if exists "anyone signed in can see the certifications" on public.certifications;
create policy "anyone signed in can see the certifications" on public.certifications
  for select to authenticated using (true);

drop policy if exists "admins manage certifications" on public.certifications;
create policy "admins manage certifications" on public.certifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins see their own row" on public.admins;
create policy "admins see their own row" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins manage access codes" on public.access_codes;
create policy "admins manage access codes" on public.access_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users see their own access" on public.entitlements;
create policy "users see their own access" on public.entitlements
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage access" on public.entitlements;
create policy "admins manage access" on public.entitlements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users with access read the content" on public.cert_content;
create policy "users with access read the content" on public.cert_content
  for select to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.entitlements e
      where e.user_id = auth.uid() and e.cert = cert_content.cert
    )
  );

drop policy if exists "admins manage the content" on public.cert_content;
create policy "admins manage the content" on public.cert_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users manage their own progress" on public.user_docs;
create policy "users manage their own progress" on public.user_docs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Check a code before creating the account (returns the certification or null)
create or replace function public.check_access_code(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cert from public.access_codes
  where code = upper(trim(p_code))
    and active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses < max_uses);
$$;

-- Use a code: gives the signed-in user access to its certification
create or replace function public.redeem_access_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.access_codes%rowtype;
  added int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into c from public.access_codes
  where code = upper(trim(p_code))
  for update;

  if not found or not c.active
     or (c.expires_at is not null and c.expires_at <= now())
     or (c.max_uses is not null and c.uses >= c.max_uses) then
    return null;
  end if;

  insert into public.entitlements (user_id, cert, source, code)
  values (auth.uid(), c.cert, 'code', c.code)
  on conflict (user_id, cert) do nothing;
  get diagnostics added = row_count;

  if added > 0 then
    update public.access_codes set uses = uses + 1 where code = c.code;
  end if;

  return c.cert;
end;
$$;

revoke all on function public.check_access_code(text) from public;
revoke all on function public.redeem_access_code(text) from public;
grant execute on function public.check_access_code(text) to anon, authenticated;
grant execute on function public.redeem_access_code(text) to authenticated;

-- Table permissions (same as supabase/grants.sql)
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

-- Global ranking and account deletion (same as supabase/ranking-and-account.sql)
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
