-- Supabase / PostgreSQL
create table if not exists reservations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 2 and 80),
  email       text not null check (char_length(email) <= 254),
  date        date not null,
  notes       text check (char_length(notes) <= 1000),
  ip          text,
  user_agent  text
);
alter table reservations enable row level security;  -- service-role key bypasses RLS
