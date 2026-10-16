-- BASKET MONEY KING — accounts + daily/weekly leaderboard
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run (drops and recreates its own functions only).

-- ============ TABLES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  max_level int not null default 1,          -- highest level unlocked
  last_submit_at timestamptz,
  banned boolean not null default false,     -- admin can hide cheaters from the leaderboard
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_name_lower on public.profiles (lower(display_name));

create table if not exists public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  level int not null,
  points int not null,                       -- money caught, in units of the smallest coin (100F = 1)
  won boolean not null,
  mode text not null,
  created_at timestamptz not null default now()
);
create index if not exists runs_created_at on public.runs (created_at);
create index if not exists runs_user_created on public.runs (user_id, created_at);

-- ============ SECURITY ============
-- Row Level Security ON. Players can read only their own profile; everything else goes
-- through the functions below, which check the rules on the server.
alter table public.profiles enable row level security;
alter table public.runs enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

-- ============ HELPERS ============
-- Level target in points. Same formula as the game (src/config/levels.js); all currencies
-- share the same ratio, so 1 point = the smallest coin (100F, ₦10, $1).
create or replace function public.level_target_points(p_level int)
returns int language sql immutable set search_path = '' as $$
  select (ceil(((20 + 2 * greatest(p_level, 1)) * 68.0 / 15.0) / 5.0) * 5)::int;
$$;

-- ============ ensure_profile ============
-- Creates the player's profile on first use (random name like Player04821).
-- p_claim_level: the level already reached on this device before accounts existed (max 30),
-- only used when the profile is first created.
drop function if exists public.ensure_profile(int);
create function public.ensure_profile(p_claim_level int default 1)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  n text;
  tries int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into p from public.profiles where id = auth.uid();
  if found then
    return p;
  end if;

  loop
    n := 'Player' || lpad((floor(random() * 100000))::int::text, 5, '0');
    begin
      insert into public.profiles (id, display_name, max_level)
      values (auth.uid(), n, least(greatest(coalesce(p_claim_level, 1), 1), 30))
      returning * into p;
      return p;
    exception when unique_violation then
      select * into p from public.profiles where id = auth.uid();
      if found then
        return p;
      end if;
      tries := tries + 1;
      if tries > 10 then
        raise;
      end if;
    end;
  end loop;
end $$;

-- ============ set_display_name ============
drop function if exists public.set_display_name(text);
create function public.set_display_name(p_name text)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  clean text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  p public.profiles;
begin
  perform public.ensure_profile();
  if char_length(clean) < 3 or char_length(clean) > 15 then
    raise exception 'Name must be 3 to 15 characters';
  end if;
  if clean !~ '^[A-Za-z0-9 _.-]+$' then
    raise exception 'Use only letters, numbers, spaces, _ . -';
  end if;
  begin
    update public.profiles set display_name = clean where id = auth.uid() returning * into p;
  exception when unique_violation then
    raise exception 'That name is already taken';
  end;
  return p;
end $$;

-- ============ submit_run ============
-- Called at the end of every level. The server caps the points to what is possible
-- for that level, blocks locked levels and too-fast submissions, and unlocks the next level.
drop function if exists public.submit_run(int, int, boolean, text);
create function public.submit_run(p_level int, p_points int, p_won boolean, p_mode text)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  target int;
  pts int;
  won boolean;
begin
  p := public.ensure_profile();

  if p_level is null or p_level < 1 or p_level > p.max_level then
    raise exception 'Level locked';
  end if;
  if p.last_submit_at is not null and now() - p.last_submit_at < interval '10 seconds' then
    raise exception 'Too fast';
  end if;

  target := public.level_target_points(p_level);
  pts := least(greatest(coalesce(p_points, 0), 0), target + 60); -- 60 = biggest note (20) x 3X boost
  won := coalesce(p_won, false) and pts >= target;

  insert into public.runs (user_id, level, points, won, mode)
  values (auth.uid(), p_level, pts, won, case when p_mode = 'hand' then 'hand' else 'touch' end);

  update public.profiles
  set last_submit_at = now(),
      max_level = case when won then greatest(max_level, p_level + 1) else max_level end
  where id = auth.uid()
  returning * into p;

  return p;
end $$;

-- ============ get_leaderboard ============
-- p_period: 'day' (resets at midnight Cameroon time) or 'week' (resets Monday midnight).
-- Returns the top p_limit players plus the caller's own row.
drop function if exists public.get_leaderboard(text, int);
create function public.get_leaderboard(p_period text default 'day', p_limit int default 50)
returns table (rank bigint, display_name text, points bigint, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with since as (
    select (date_trunc(case when p_period = 'week' then 'week' else 'day' end,
                       now() at time zone 'Africa/Douala')) at time zone 'Africa/Douala' as t
  ),
  totals as (
    select r.user_id, sum(r.points)::bigint as pts, min(r.created_at) as first_at
    from public.runs r, since s
    where r.created_at >= s.t
    group by r.user_id
  ),
  ranked as (
    select row_number() over (order by t.pts desc, t.first_at asc) as rk,
           p.display_name, t.pts, (t.user_id = auth.uid()) as me
    from totals t
    join public.profiles p on p.id = t.user_id
    where not p.banned
  )
  select rk, display_name, pts, me
  from ranked
  where rk <= least(greatest(p_limit, 1), 100) or me
  order by rk;
$$;

-- ============ PERMISSIONS ============
revoke all on function public.ensure_profile(int) from public, anon;
revoke all on function public.set_display_name(text) from public, anon;
revoke all on function public.submit_run(int, int, boolean, text) from public, anon;
revoke all on function public.get_leaderboard(text, int) from public, anon;
grant execute on function public.ensure_profile(int) to authenticated;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.submit_run(int, int, boolean, text) to authenticated;
grant execute on function public.get_leaderboard(text, int) to authenticated;
