alter table public.tasks
  add column archived boolean not null default false;

create index tasks_project_archived_status_position_idx
  on public.tasks (project_id, archived, status, position);
