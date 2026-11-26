-- v0.6.0: Kontoeinstellungen je Nutzer (z. B. eigener Gemini-API-Key für die KI-Sortierung).
-- Nur einmal ausführen, nach 001–003. Bestehende Daten bleiben unverändert.
-- Bewusst NICHT im Operationslog (kompass_ops): das ist unveränderlich und würde jeden alten Key
-- für immer aufbewahren. Hier gibt es genau eine Zeile pro Konto, die überschrieben/gelöscht werden kann.
begin;
create table if not exists public.kompass_user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  gemini_key text check (gemini_key is null or char_length(gemini_key) between 30 and 80),
  updated_at timestamptz not null default now()
);
alter table public.kompass_user_settings enable row level security;
-- Jedes Konto sieht und ändert ausschließlich die eigene Zeile.
-- Wiederholbar, auch wenn die Tabelle bereits angelegt wurde; keine Nutzerdaten löschen.
drop policy if exists own_settings_read on public.kompass_user_settings;
drop policy if exists own_settings_insert on public.kompass_user_settings;
drop policy if exists own_settings_update on public.kompass_user_settings;
drop policy if exists own_settings_delete on public.kompass_user_settings;
create policy own_settings_read on public.kompass_user_settings for select to authenticated using ((select auth.uid()) = owner_id);
create policy own_settings_insert on public.kompass_user_settings for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy own_settings_update on public.kompass_user_settings for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_settings_delete on public.kompass_user_settings for delete to authenticated using ((select auth.uid()) = owner_id);
revoke all on public.kompass_user_settings from anon, authenticated;
grant select, insert, update, delete on public.kompass_user_settings to authenticated;
commit;
