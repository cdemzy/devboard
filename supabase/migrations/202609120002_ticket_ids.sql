alter table public.projects
  add column ticket_prefix varchar(2),
  add column next_ticket_number integer not null default 1 check (next_ticket_number > 0);

alter table public.tasks
  add column ticket_number integer,
  add column ticket_id varchar(16);

create or replace function public.assign_ticket_prefixes() returns void language plpgsql
set search_path = '' as $$
declare
  project_row record;
  normalized_name text;
  prefix_candidate text;
  character_index integer;
begin
  for project_row in
    select id, owner_id, name from public.projects order by created_at, id
  loop
    normalized_name := regexp_replace(upper(project_row.name), '[^A-Z0-9]', '', 'g');
    if length(normalized_name) = 0 then normalized_name := 'P'; end if;
    character_index := 2;
    loop
      prefix_candidate := substr(normalized_name, 1, 1) || case
        when character_index <= length(normalized_name) then substr(normalized_name, character_index, 1)
        else substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', character_index - length(normalized_name), 1)
      end;
      exit when not exists (
        select 1 from public.projects
        where owner_id = project_row.owner_id and ticket_prefix = prefix_candidate
      );
      character_index := character_index + 1;
      if character_index > length(normalized_name) + 36 then
        raise exception 'No ticket prefix is available for project %', project_row.id;
      end if;
    end loop;
    update public.projects set ticket_prefix = prefix_candidate where id = project_row.id;
  end loop;
end;
$$;

select public.assign_ticket_prefixes();
drop function public.assign_ticket_prefixes();

with numbered_tasks as (
  select tasks.id, projects.ticket_prefix,
    row_number() over (partition by tasks.project_id order by tasks.created_at, tasks.id) as number
  from public.tasks
  join public.projects on projects.id = tasks.project_id
)
update public.tasks
set ticket_number = numbered_tasks.number,
    ticket_id = numbered_tasks.ticket_prefix || '-' || numbered_tasks.number
from numbered_tasks
where public.tasks.id = numbered_tasks.id;

update public.projects
set next_ticket_number = coalesce((
  select max(ticket_number) + 1
  from public.tasks
  where public.tasks.project_id = public.projects.id
), 1);

alter table public.projects
  alter column ticket_prefix set not null,
  add constraint projects_owner_ticket_prefix_key unique (owner_id, ticket_prefix),
  add constraint projects_ticket_prefix_format_check check (ticket_prefix ~ '^[A-Z0-9]{2}$');

alter table public.tasks
  alter column ticket_number set not null,
  alter column ticket_id set not null,
  add constraint tasks_project_ticket_number_key unique (project_id, ticket_number),
  add constraint tasks_ticket_number_positive_check check (ticket_number > 0);
