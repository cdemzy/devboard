alter table public.projects
  add column tags jsonb not null default '[]'::jsonb,
  add constraint projects_tags_array_check check (jsonb_typeof(tags) = 'array');
