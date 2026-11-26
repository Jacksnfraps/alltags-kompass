-- Apply after 001. v0.2 uses this append-only synchronization log.
-- 001 tables remain intact for migration/backwards compatibility.
begin;
create table public.kompass_ops (
 seq bigint generated always as identity unique,
 id uuid not null,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 entity text not null check(entity in ('capture','entry','project','stock','dose','adjustment','attachment')),
 entity_id uuid not null,
 action text not null check(action in ('create','patch')),
 data jsonb not null check(jsonb_typeof(data) = 'object' and octet_length(data::text) <= 100000),
 created_at timestamptz not null,
 primary key(owner_id,id),
 check(entity <> 'capture' or action <> 'create' or (jsonb_typeof(data->'original_text') = 'string' and length(data->>'original_text') > 0)),
 check(entity <> 'capture' or action <> 'patch' or not (data ?| array['original_text','attachments'])),
 check(entity not in ('dose','adjustment') or action <> 'create' or (jsonb_typeof(data->'amount') = 'number' and (data->>'amount')::numeric > 0))
);
create unique index kompass_entity_creation on public.kompass_ops(owner_id,entity,entity_id) where action = 'create';
create index kompass_ops_owner_sequence on public.kompass_ops(owner_id,seq);
alter table public.kompass_ops enable row level security;
create policy own_ops_read on public.kompass_ops for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_ops_insert on public.kompass_ops for insert to authenticated with check ((select auth.uid()) = owner_id);
revoke all on public.kompass_ops from anon, authenticated;
grant select,insert on public.kompass_ops to authenticated;
grant usage on sequence public.kompass_ops_seq_seq to authenticated;
-- Inserts are idempotent. No update/delete policy: original captures and history are immutable.
alter publication supabase_realtime add table public.kompass_ops;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('kompass-photos','kompass-photos',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy kompass_photo_read on storage.objects for select to authenticated
using(bucket_id = 'kompass-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy kompass_photo_insert on storage.objects for insert to authenticated
with check(bucket_id = 'kompass-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
