begin;
create table public.captures (
 id uuid primary key, owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 original_text text not null check (length(trim(original_text)) > 0),
 created_at timestamptz not null default now(), sorting_status text not null default 'pending' check (sorting_status in ('pending','reviewed')),
 unique(id, owner_id)
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null, unique(id, owner_id)
);
create table public.entries (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 capture_id uuid not null, project_id uuid,
 kind text not null check(kind in ('idea','todo','event','medication')), title text not null, details text not null default '',
 minutes integer check(minutes in (15,30,60)), energy text check(energy in ('low','medium','high')),
 due_at timestamptz, revisit_at timestamptz, status text not null default 'open' check(status in ('open','done')),
 position integer not null default 0, facts jsonb not null default '{}', missing_fields jsonb not null default '[]',
 contact jsonb not null default '{}', recurrence text, timezone text not null default 'Europe/Berlin',
 foreign key(capture_id,owner_id) references public.captures(id,owner_id),
 foreign key(project_id,owner_id) references public.projects(id,owner_id)
);
create table public.medication_stocks (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 label text not null, remaining integer not null check(remaining >= 0), reminder_threshold integer not null default 30 check(reminder_threshold >= 0)
);
-- An original capture can be removed explicitly, but never rewritten by sorting.
create function public.preserve_original() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.original_text is distinct from old.original_text then raise exception 'Originaltext ist unveränderlich'; end if;
 return new;
end $$;
create trigger preserve_capture before update on public.captures for each row execute function public.preserve_original();
do $$ declare t text; begin
 foreach t in array array['captures','projects','entries','medication_stocks'] loop
 execute format('alter table public.%I enable row level security', t);
 execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
 execute format('create index on public.%I(owner_id)', t);
 execute format('revoke all on public.%I from anon', t);
 execute format('grant select, insert, update, delete on public.%I to authenticated', t);
 end loop;
end $$;
commit;
