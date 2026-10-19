create extension if not exists pgcrypto;

create table if not exists public.personspace_profiles (
  user_id text primary key,
  username text not null default '',
  slug text not null unique,
  display_name text not null default '留白',
  headline text not null default '生活里真正留下来的，通常不是答案，而是认真想过的痕迹。',
  bio text not null default '工作、阅读、成长与一些正在发生的事情。',
  current_focus text not null default '认真生活，持续记录。',
  is_owner boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists personspace_single_owner
  on public.personspace_profiles (is_owner)
  where is_owner = true;

create table if not exists public.personspace_states (
  user_id text primary key references public.personspace_profiles(user_id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personspace_public_entries (
  id text primary key,
  user_id text not null references public.personspace_profiles(user_id) on delete cascade,
  profile_slug text not null,
  category_name text not null default '随笔',
  title text not null,
  summary text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personspace_public_entries_owner_date
  on public.personspace_public_entries (user_id, published_at desc);

create or replace function public.personspace_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personspace_profiles_touch on public.personspace_profiles;
create trigger personspace_profiles_touch
before update on public.personspace_profiles
for each row execute function public.personspace_touch_updated_at();

drop trigger if exists personspace_states_touch on public.personspace_states;
create trigger personspace_states_touch
before update on public.personspace_states
for each row execute function public.personspace_touch_updated_at();

drop trigger if exists personspace_public_entries_touch on public.personspace_public_entries;
create trigger personspace_public_entries_touch
before update on public.personspace_public_entries
for each row execute function public.personspace_touch_updated_at();

alter table public.personspace_profiles enable row level security;
alter table public.personspace_states enable row level security;
alter table public.personspace_public_entries enable row level security;

drop policy if exists profiles_public_or_owner_read on public.personspace_profiles;
create policy profiles_public_or_owner_read
on public.personspace_profiles for select
using ((is_owner and is_published) or auth.uid() = user_id);

drop policy if exists profiles_owner_insert on public.personspace_profiles;
create policy profiles_owner_insert
on public.personspace_profiles for insert
with check (auth.uid() = user_id);

drop policy if exists profiles_owner_update on public.personspace_profiles;
create policy profiles_owner_update
on public.personspace_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists profiles_owner_delete on public.personspace_profiles;
create policy profiles_owner_delete
on public.personspace_profiles for delete
using (auth.uid() = user_id);

drop policy if exists states_owner_read on public.personspace_states;
create policy states_owner_read
on public.personspace_states for select
using (auth.uid() = user_id);

drop policy if exists states_owner_insert on public.personspace_states;
create policy states_owner_insert
on public.personspace_states for insert
with check (auth.uid() = user_id);

drop policy if exists states_owner_update on public.personspace_states;
create policy states_owner_update
on public.personspace_states for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists states_owner_delete on public.personspace_states;
create policy states_owner_delete
on public.personspace_states for delete
using (auth.uid() = user_id);

drop policy if exists public_entries_read on public.personspace_public_entries;
create policy public_entries_read
on public.personspace_public_entries for select
using (
  exists (
    select 1
    from public.personspace_profiles profile
    where profile.user_id = personspace_public_entries.user_id
      and profile.is_owner = true
      and profile.is_published = true
  )
);

drop policy if exists public_entries_owner_insert on public.personspace_public_entries;
create policy public_entries_owner_insert
on public.personspace_public_entries for insert
with check (auth.uid() = user_id);

drop policy if exists public_entries_owner_update on public.personspace_public_entries;
create policy public_entries_owner_update
on public.personspace_public_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists public_entries_owner_delete on public.personspace_public_entries;
create policy public_entries_owner_delete
on public.personspace_public_entries for delete
using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.personspace_profiles to anon, authenticated;
grant insert, update, delete on public.personspace_profiles to authenticated;
grant select, insert, update, delete on public.personspace_states to authenticated;
grant select on public.personspace_public_entries to anon, authenticated;
grant insert, update, delete on public.personspace_public_entries to authenticated;
