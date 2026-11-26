-- v0.4.0: eigene Listen (z. B. Packlisten) als zusätzliche Entität im Operationslog.
-- Nur einmal ausführen, nach 001 und 002. Bestehende Daten bleiben unverändert.
alter table public.kompass_ops drop constraint if exists kompass_ops_entity_check;
alter table public.kompass_ops add constraint kompass_ops_entity_check
  check (entity in ('capture','entry','project','stock','dose','adjustment','attachment','list'));
