-- BASKET MONEY KING — v0.11 coins + shop (nets, sky themes, 2X boost, life refill)
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
-- Coins are earned only on the server (from checked scores), so they can't be faked.
-- Halal rules: fixed prices, no random rewards, coins can never be turned into real money.

-- ============ PLAYER COINS + EQUIPPED NET ============
alter table public.profiles add column if not exists coins int not null default 0;
alter table public.profiles add column if not exists equipped_net text not null default 'net_classic';
alter table public.profiles add column if not exists equipped_sky text not null default 'sky_day';
do $$ begin
  alter table public.profiles add constraint profiles_coins_not_negative check (coins >= 0);
exception when duplicate_object then null; end $$;

-- ============ SHOP ITEMS (prices editable later from the admin panel) ============
create table if not exists public.shop_items (
  id text primary key,
  kind text not null,
  name text not null,
  price int not null check (price >= 0),
  sort int not null default 0,
  active boolean not null default true
);
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind in ('net', 'sky', 'boost', 'life'));
insert into public.shop_items (id, kind, name, price, sort) values
  ('net_gold',    'net',   'Golden Net',  300, 1),
  ('net_royal',   'net',   'Royal Net',   600, 2),
  ('net_fire',    'net',   'Fire Net',   1000, 3),
  ('sky_sunset',  'sky',   'Sunset Sky',  400, 5),
  ('sky_night',   'sky',   'Night Sky',   700, 6),
  ('sky_douala',  'sky',   'Douala Evening', 1200, 7),
  ('boost_2x',    'boost', '2X Boost',     50, 10),
  ('life_refill', 'life',  'Life Refill', 100, 20)
on conflict (id) do nothing;

-- What each player owns (nets/skies: qty 1, boosts: how many left).
create table if not exists public.inventory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.shop_items (id),
  qty int not null default 0 check (qty >= 0),
  primary key (user_id, item_id)
);

-- Every purchase, for the admin panel and support.
create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null,
  price int not null,
  created_at timestamptz not null default now()
);
create index if not exists purchases_created_at on public.purchases (created_at);

-- ============ SECURITY ============
alter table public.shop_items enable row level security;
alter table public.inventory enable row level security;
alter table public.purchases enable row level security;
drop policy if exists "read active items" on public.shop_items;
create policy "read active items" on public.shop_items for select to authenticated using (active);
drop policy if exists "read own inventory" on public.inventory;
create policy "read own inventory" on public.inventory for select to authenticated using (auth.uid() = user_id);
-- No insert/update/delete policies: all changes go through the functions below.

-- ============ HELPERS ============
-- Coins for one level: money caught / 10 (100F = 1 point, so 10 000F = 10 coins) + 5 for a win.
create or replace function public.coins_for_run(p_points int, p_won boolean)
returns int language sql immutable set search_path = '' as $$
  select (greatest(p_points, 0) / 10) + case when p_won then 5 else 0 end;
$$;

-- Everything the shop screen needs, as JSON.
create or replace function public.shop_state()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'coins', p.coins,
    'equipped_net', p.equipped_net,
    'equipped_sky', p.equipped_sky,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'name', s.name, 'price', s.price) order by s.sort)
                       from public.shop_items s where s.active), '[]'::jsonb),
    'inventory', coalesce((select jsonb_object_agg(i.item_id, i.qty) from public.inventory i
                           where i.user_id = p.id and i.qty > 0), '{}'::jsonb)
  )
  from public.profiles p where p.id = auth.uid();
$$;

-- ============ submit_run (now also pays coins) ============
create or replace function public.submit_run(p_level int, p_points int, p_won boolean, p_mode text)
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
  pts := least(greatest(coalesce(p_points, 0), 0), target + 60);
  won := coalesce(p_won, false) and pts >= target;

  insert into public.runs (user_id, level, points, won, mode)
  values (auth.uid(), p_level, pts, won, case when p_mode = 'hand' then 'hand' else 'touch' end);

  update public.profiles
  set last_submit_at = now(),
      max_level = case when won then greatest(max_level, p_level + 1) else max_level end,
      coins = coins + public.coins_for_run(pts, won)
  where id = auth.uid()
  returning * into p;

  return p;
end $$;

-- ============ buy_item ============
drop function if exists public.buy_item(text);
create function public.buy_item(p_item text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  it public.shop_items;
  owned int;
begin
  perform public.ensure_profile();
  select * into it from public.shop_items where id = p_item and active;
  if not found then
    raise exception 'This item is not available';
  end if;

  if it.kind in ('net', 'sky') then
    select qty into owned from public.inventory where user_id = auth.uid() and item_id = it.id;
    if coalesce(owned, 0) > 0 then
      raise exception 'You already own this';
    end if;
  end if;

  -- Atomic: only succeeds if the player has enough coins.
  update public.profiles set coins = coins - it.price where id = auth.uid() and coins >= it.price;
  if not found then
    raise exception 'Not enough coins';
  end if;

  if it.kind in ('net', 'sky', 'boost') then
    insert into public.inventory (user_id, item_id, qty) values (auth.uid(), it.id, 1)
    on conflict (user_id, item_id) do update
      set qty = case when it.kind = 'boost' then public.inventory.qty + 1 else 1 end;
  end if;
  -- 'life' items are applied on the device (lives refill); only the coins are taken here.

  insert into public.purchases (user_id, item_id, price) values (auth.uid(), it.id, it.price);
  return public.shop_state();
end $$;

-- ============ use_item (boosts) ============
drop function if exists public.use_item(text);
create function public.use_item(p_item text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update public.inventory set qty = qty - 1
  where user_id = auth.uid() and item_id = p_item and qty > 0
    and exists (select 1 from public.shop_items s where s.id = p_item and s.kind = 'boost');
  if not found then
    raise exception 'You have none left';
  end if;
  return public.shop_state();
end $$;

-- ============ equip_net ============
drop function if exists public.equip_net(text);
create function public.equip_net(p_item text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_item <> 'net_classic' and not exists (
    select 1 from public.inventory i join public.shop_items s on s.id = i.item_id
    where i.user_id = auth.uid() and i.item_id = p_item and i.qty > 0 and s.kind = 'net'
  ) then
    raise exception 'You don''t own this net';
  end if;
  update public.profiles set equipped_net = p_item where id = auth.uid();
  return public.shop_state();
end $$;

-- ============ equip_sky ============
drop function if exists public.equip_sky(text);
create function public.equip_sky(p_item text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_item <> 'sky_day' and not exists (
    select 1 from public.inventory i join public.shop_items s on s.id = i.item_id
    where i.user_id = auth.uid() and i.item_id = p_item and i.qty > 0 and s.kind = 'sky'
  ) then
    raise exception 'You don''t own this sky';
  end if;
  update public.profiles set equipped_sky = p_item where id = auth.uid();
  return public.shop_state();
end $$;

-- ============ PERMISSIONS ============
revoke all on function public.shop_state() from public, anon;
revoke all on function public.buy_item(text) from public, anon;
revoke all on function public.use_item(text) from public, anon;
revoke all on function public.equip_net(text) from public, anon;
revoke all on function public.equip_sky(text) from public, anon;
revoke all on function public.coins_for_run(int, boolean) from public, anon;
grant execute on function public.shop_state() to authenticated;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.use_item(text) to authenticated;
grant execute on function public.equip_net(text) to authenticated;
grant execute on function public.equip_sky(text) to authenticated;
