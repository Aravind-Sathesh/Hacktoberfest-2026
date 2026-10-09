-- Trailkit Community: the only data that leaves the phone, and only when someone posts a trek.
-- Route, totals and species names. Never photos, never the profile's emergency details.
-- Paste into Supabase → SQL Editor → Run. Safe to run again.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The trek's id on the phone, so posting the same trek twice updates instead of duplicating
  local_id text not null,
  author text not null check (char_length(author) between 1 and 30),
  title text not null check (char_length(title) between 1 and 60),
  started_at timestamptz not null,
  ended_at timestamptz not null check (ended_at >= started_at),
  distance_m real not null check (distance_m >= 0),
  elevation_gain_m real not null check (elevation_gain_m >= 0),
  -- [[lat, lng], ...], already thinned to at most 300 points by the app
  route jsonb not null check (jsonb_typeof(route) = 'array' and jsonb_array_length(route) between 2 and 300),
  -- [{kind, label, danger, lat, lng, taken_at}], no photo paths
  sightings jsonb not null default '[]' check (jsonb_typeof(sightings) = 'array' and jsonb_array_length(sightings) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create index if not exists posts_created_at on public.posts (created_at desc);

alter table public.posts enable row level security;

-- New tables aren't exposed automatically on this project, so grant exactly what the app needs
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts" on public.posts for select using (true);

-- Anonymous sign-ins get the authenticated role; each phone can only write its own rows
drop policy if exists "Post as yourself" on public.posts;
create policy "Post as yourself" on public.posts for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Edit your own posts" on public.posts;
create policy "Edit your own posts" on public.posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Delete your own posts" on public.posts;
create policy "Delete your own posts" on public.posts for delete to authenticated using (user_id = auth.uid());

-- Delete account: removes the caller's anonymous user; their posts go with it (on delete cascade).
-- security definer so it can touch auth.users, but it only ever deletes auth.uid(), i.e. yourself.
create or replace function public.delete_me() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;

-- Accounts are email + password (no more anonymous sign-ins). Each post shows its author's photo.
alter table public.posts add column if not exists avatar_url text check (avatar_url is null or char_length(avatar_url) < 500);

-- Profile photos: public to read, and each account can only write <its id>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 524288, allowed_mime_types = array['image/jpeg'];

drop policy if exists "Upload your own avatar" on storage.objects;
create policy "Upload your own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

drop policy if exists "Replace your own avatar" on storage.objects;
create policy "Replace your own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg')
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

drop policy if exists "Delete your own avatar" on storage.objects;
create policy "Delete your own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
