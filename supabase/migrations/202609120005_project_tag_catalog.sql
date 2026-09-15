create table public.project_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  normalized_name text not null check (char_length(normalized_name) between 1 and 40),
  color text not null default 'default' check (color in ('default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red')),
  unique (owner_id, normalized_name)
);

insert into public.project_tags (owner_id, name, normalized_name)
select distinct p.owner_id, trim(value), lower(trim(value))
from public.projects p cross join lateral jsonb_array_elements_text(p.tags) as value
where trim(value) <> ''
on conflict (owner_id, normalized_name) do nothing;
