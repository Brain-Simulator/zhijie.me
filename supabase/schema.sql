-- Photo wall backend for Supabase
create extension if not exists pgcrypto;

create table if not exists public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  location text not null check (char_length(location) between 1 and 120),
  caption text,
  latitude double precision,
  longitude double precision,
  taken_at timestamptz,
  uploaded_at timestamptz not null default now()
);

alter table public.trip_photos enable row level security;

-- No public table policies on purpose. Edge Functions use the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists trip_photos_taken_at_idx
  on public.trip_photos (taken_at desc nulls last, uploaded_at desc);
