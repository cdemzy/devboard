create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name varchar(120) not null check (length(trim(name)) > 0),
  description text not null default '' check (length(description) <= 10000),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects(owner_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title varchar(240) not null check (length(trim(title)) > 0),
  description text not null default '' check (length(description) <= 10000),
  status varchar(20) not null default 'todo' check (status in ('todo','in_progress','done')),
  priority varchar(10) not null default 'medium' check (priority in ('low','medium','high')),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_status_position_idx on public.tasks(project_id,status,position);

create function public.set_updated_at() returns trigger language plpgsql
set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();

-- API-only data access. No browser grants or policies; backend checks ownership.
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
revoke all on public.projects, public.tasks from anon, authenticated;
