-- BASKET MONEY KING — v0.10 level rules
-- The level target stops growing after Level 40 (same as src/config/levels.js).
-- Run once in Supabase: SQL Editor → New query → paste → Run.
create or replace function public.level_target_points(p_level int)
returns int language sql immutable set search_path = '' as $$
  select (ceil((least(20 + 2 * greatest(p_level, 1), 100) * 68.0 / 15.0) / 5.0) * 5)::int;
$$;
