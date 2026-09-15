alter table public.tasks
  add column complexity varchar(10) not null default 'standard'
  check (complexity in ('easy', 'standard', 'hard'));
