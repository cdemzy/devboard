-- Persist each owner's manually chosen platform-tag order.
alter table public.project_tags
  add column position integer not null default 0;

with ranked_tags as (
  select id, row_number() over (partition by owner_id order by name, id) - 1 as position
  from public.project_tags
)
update public.project_tags tags
set position = ranked_tags.position
from ranked_tags
where tags.id = ranked_tags.id;

alter table public.project_tags
  add constraint project_tags_position_check check (position >= 0);

create index project_tags_owner_position_idx
  on public.project_tags (owner_id, position, id);
