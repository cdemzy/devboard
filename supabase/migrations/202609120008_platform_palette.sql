-- Add the remaining Platform palette colors.
alter table public.project_tags
  drop constraint if exists project_tags_color_check;

alter table public.project_tags
  add constraint project_tags_color_check
  check (color in ('green', 'yellow', 'purple', 'orange', 'blue', 'pink', 'red', 'brown'));
