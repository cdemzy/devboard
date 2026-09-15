-- Persist each owner's active-project navigation order.
alter table public.projects
  add column position integer not null default 0
  check (position >= 0);

with ranked_projects as (
  select id, row_number() over (partition by owner_id, archived order by created_at, id) - 1 as position
  from public.projects
)
update public.projects projects
set position = ranked_projects.position
from ranked_projects
where projects.id = ranked_projects.id;

create index projects_owner_archived_position_idx
  on public.projects (owner_id, archived, position, created_at, id);
