-- Lock In — database schema
-- Paste this whole file into the Supabase SQL editor and press Run.
-- Safe to run more than once.

-- ---------------------------------------------------------------- tasks ----
create table if not exists public.tasks (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  notes        text        not null default '',
  category     text        not null default 'homework',
  course       text        not null default '',
  due_at       timestamptz,
  priority     smallint    not null default 0,
  estimate_min integer,
  done         boolean     not null default false,
  completed_at timestamptz,
  focus_sec    integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Soft delete, so a deletion on one device propagates to the others
  -- instead of the row simply reappearing on the next sync.
  deleted_at   timestamptz
);

create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists tasks_due_idx  on public.tasks (user_id, due_at);

-- ------------------------------------------------------------- sessions ----
create table if not exists public.sessions (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  task_id      uuid,
  label        text        not null default '',
  started_at   timestamptz not null,
  duration_sec integer     not null default 0,
  kind         text        not null default 'focus',
  route        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists sessions_user_idx    on public.sessions (user_id);
create index if not exists sessions_started_idx on public.sessions (user_id, started_at);

-- ------------------------------------------------------------------ RLS ----
-- Row Level Security is the real security boundary here: the browser holds
-- only the anon key, and these policies are what stop one account reading
-- another's rows.
alter table public.tasks    enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
