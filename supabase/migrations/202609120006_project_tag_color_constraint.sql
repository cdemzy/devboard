-- Keep existing installations in sync with the current tag color palette.
alter table public.project_tags
  drop constraint if exists project_tags_color_check;

alter table public.project_tags
  alter column color set default 'default';

update public.project_tags
set color = 'default'
where color not in ('default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red');

alter table public.project_tags
  add constraint project_tags_color_check
  check (color in ('default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'));
