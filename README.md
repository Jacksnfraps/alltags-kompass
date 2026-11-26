# Aktueller Stand: v0.6.2

Kompakte PWA mit fünf Bereichen (Eingang, Ideen & Projekte, To-dos inkl. Einkauf, eigene Listen und Anrufe, Termine & Rhythmen inkl. Müll/Dienstplan, Tabletten-Zähler). Gedanken werden ohne Sortierzwang gesichert und automatisch lokal einsortiert; das Original bleibt vollständig erhalten. 65 automatisierte Tests bestehen. KI-Sortierung optional mit eigenem Gemini-Key (⚙ Einstellungen, im Konto gespeichert). Start/Sync: [EINRICHTUNG.md](EINRICHTUNG.md); Arbeitsstand und offene Punkte: [HANDOFF.md](HANDOFF.md). Live-Supabase, echter Gemini-Aufruf und echter iPhone-Test sind noch offen. Der historische Abschnitt unten beschreibt v0.1.

---

# Alltags- & Ideen-Kompass

Eigenständiges lokales PWA-Grundgerüst, ohne Framework- oder Laufzeitabhängigkeiten. Node.js ab Version 20 genügt:

```sh
npm start
# http://localhost:4173
npm test
```

## Aktueller Funktionsumfang

Text erfassen, Original unverändert lokal speichern, Eingang anzeigen und JSON-Sicherung herunterladen. Diktat funktioniert über das Mikrofon der Betriebssystem-Tastatur. Nach dem ersten erfolgreichen Laden kann der Service Worker die App-Shell offline bereitstellen. Speicherfehler lassen die Eingabe im Feld stehen. KI ist nicht erforderlich und nicht angebunden.

Lokale Daten gehören zum Browserprofil und bleiben auch nach Schließen erhalten. Browserdaten-Löschen oder Speicherbereinigung kann sie entfernen: Export verwenden. Dieser Gastmodus ist für ein persönliches Gerät gedacht. Es gibt noch keine Anmeldung; Daten werden nicht in die Cloud übertragen. Die anderen Navigationsbereiche zeigen den geplanten Umfang ehrlich als Ausbaustufen an.

## Struktur

- `src/domain/`: Domain-Funktionen und TypeScript-Verträge
- `src/data/`: lokale Persistenz und vorbereiteter Supabase-Upload-Adapter
- `src/app.js`, `src/styles.css`: Oberfläche
- `supabase/migrations/001_initial.sql`: Tabellen, RLS, Eigentümer-Fremdschlüssel, Originalschutz
- `tests/`: Tests für verlustfreie Persistenz und Fehlerfälle
- `scripts/serve.mjs`: ausschließlich lokaler Entwicklungsserver
- `HANDOFF.md`: laufender Übergabestand

## Ausbau zur Mehrnutzer-App

Zuerst SQL in einem separaten Supabase-Testprojekt prüfen. Anschließend Auth-Client mit Publishable-Key anbinden, Login/Logout und Session-Wechsel implementieren. Lokalen Speicher vor Sync auf IndexedDB mit eigenem Namensraum je Nutzer und einer idempotenten Outbox umstellen. Gast-Captures nur nach expliziter Zuordnung importieren. Zwei Testkonten müssen fremde IDs weder lesen noch ändern oder verknüpfen können. Service-Role- und KI-Schlüssel dürfen niemals im Browser liegen. Der Adapter ist noch kein fertiger Synchronisationsmechanismus.

Ein Capture bleibt die unveränderliche Quelle. Daraus entstehen mehrere `entries`, jeweils mit `capture_id`. Projektbündelung, Fakten, fehlende Angaben, Reihenfolge, Aufwand, Energie, Wiedervorlage und Wiederholung haben eigene Felder. Personenzuordnung, strukturierte Einkaufslisten, Ausnahme-Termine und Medikamenten-Entnahmeprotokoll benötigen weitere Tabellen. Vor KI-Nutzung: Vorschau und Bestätigung der abgeleiteten Inhalte, Quellenbezug, Schema-Validierung, begrenzte Wiederholungen und lokale Warteschlange. Kein stilles Archivieren.

## 0-Euro-Ziel und Bereitstellung

Aktuell werden keinerlei externe Dienste aufgerufen und es entstehen durch diese App keine API-Kosten. Die statischen Dateien können später auf einem geeigneten kostenlosen Hosting-Tarif liegen. Es wurde kein Konto angelegt, Tarif aktiviert oder Deployment ausgeführt. Aktuelle Free-Tier-Bedingungen, Datenschutzanforderungen und regionale Verfügbarkeit müssen unmittelbar vor Aktivierung geprüft werden; dauerhafte Gratis-Verfügbarkeit wird nicht vorausgesetzt. Keine Kreditkarte hinterlegen, kein automatisches kostenpflichtiges Upgrade aktivieren. Gemini nur optional hinter einer serverseitigen Funktion mit festen Kontingenten anbinden; bei Ausfall bleibt die lokale Erfassung verfügbar.

Für ein Deployment nur `index.html`, `src/`, `sw.js`, `manifest.webmanifest`, `icon.svg` ausliefern. HTTPS ist für PWA-Funktionen erforderlich (localhost ist eine Entwicklungs-Ausnahme). iPhone-Installation über Safari → Teilen → Zum Home-Bildschirm. PNG-Icons, Apple-Touch-Icon, tatsächlicher iOS-Test und Offline-Update-Test stehen aus. PWA-Fähigkeit ist keine App-Store-Zulassung; Store-Verpackung und deren Anforderungen sind ein späteres Teilprojekt.

## Nächste Schritte

Siehe `HANDOFF.md`. Vor produktiver Nutzung fehlen insbesondere Auth/Sync, End-to-End-RLS-Prüfung, Backup-Import, echte Bereichs-UIs, Datenschutz-/Löschkonzept und Benachrichtigungen. Der Medikamentenbereich zählt Bestände; er gibt keine Dosierungsanweisungen.

