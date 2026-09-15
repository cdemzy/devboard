-- Platform tags use only the three base Notion-inspired board colors.
alter table public.project_tags
  drop constraint if exists project_tags_color_check;

alter table public.project_tags
  alter column color set default 'purple';

update public.project_tags
set color = 'purple'
where color not in ('green', 'yellow', 'purple');

alter table public.project_tags
  add constraint project_tags_color_check
  check (color in ('green', 'yellow', 'purple'));
