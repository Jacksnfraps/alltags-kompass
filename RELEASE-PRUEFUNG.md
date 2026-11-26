# Release-Prüfung v0.6.0 – 26.11.2026

## Ergebnis

Veröffentlicht unter https://jacksnfraps.github.io/alltags-kompass/ . Release-Commit `1a917e7`, Build `038c090c1a5308a6`, Service Worker v12. Pages-Workflow erfolgreich. Alle 35 ausgelieferten App-Dateien stimmen bytegenau mit dem geprüften Build überein. Eingabefeld für den eigenen Gemini-Key auf der Live-Seite im Browser bestätigt.

## Ursache

Der vorige Upload war unvollständig: neues sw.js v11, aber altes src/main.js ohne Key-Eingabe und fehlendes src/data/ai-key.js (404). src/data/gemini.js fehlte ebenfalls im Repository. GitHub veröffentlichte diesen Mischstand erfolgreich. Lokaler dist enthielt die Dateien bereits. Pages verwendet `main` und `/ (root)`, nicht einen Unterordner dist.

## Prüfungen und Korrekturen

- 68 Tests bestanden, JavaScript-Syntax geprüft; keine echten API-Keys in dist oder im öffentlichen Git-Stand. Der lokale echte Gemini-Key wurde zusätzlich gegen den Checkout und die vorhandene Git-Historie geprüft, ohne ihn auszugeben.
- Ersatz-Key wird vor dem Speichern geprüft. Ungültige Eingaben löschen keinen vorher gültigen Kontokey.
- Verspätete Kontoantworten können nach Abmelden/Ersetzen keine alte Gerätekopie wiederherstellen. Bei Rückkehr ins Netz wird der Kontowert erneut geladen.
- Migration 004 ist wiederholbar und transaktional; eigene Zeile per RLS, keine Löschung vorhandener Nutzerdaten.
- Build erzeugt Prüfmanifest, prüft Offline-Ressourcen und Secrets, normalisiert Zeilenenden für verlässliche Git-/HTTP-Prüfsummen.
- Build mit `npm.cmd run build:static`; keine Änderung der PowerShell-ExecutionPolicy erforderlich.

## Exakte Änderungen im dist gegenüber dem vorgefundenen lokalen Build

Neu: `build-info.json`.

Geändert: `index.html`, `src/app.js`, `src/data/ai-key.js`, `src/domain/state.js`, `src/domain/when.js`, `src/main.js`, `src/views/ideas.js`, `src/views/todos.js`, `sw.js`.

Davon sind index.html, app.js, state.js, when.js, ideas.js und todos.js reine CRLF→LF-Normalisierung. Inhaltlich geändert sind ai-key.js, main.js und sw.js. Keine dist-Datei entfernt. Gegenüber dem alten GitHub-Stand kommen außerdem `.nojekyll` und `src/data/gemini.js` neu hinzu; cloud.js enthält jetzt die Kontoeinstellungs-Methoden. Vollständige Listen: BUILD-VERGLEICH.json.

## Die drei verbleibenden Schritte

1. Im SQL-Editor des bestehenden Supabase-Projekts den vollständigen Inhalt von `supabase/migrations/004_user_settings.sql` ausführen. Kein API-Key gehört in SQL. 001–003 nicht erneut ausführen, wenn sie bereits eingerichtet sind.
2. Auf der veröffentlichten App am PC mit dem gewünschten Supabase-Konto anmelden. Unter ⚙ → KI-Sortierung den Key speichern; Bestätigung „im Konto gespeichert“ abwarten. Zuvor in AI Studio prüfen, dass für das Gemini-Projekt kein Billing aktiv ist. Ein Key nur in .env wird nicht nach Supabase oder GitHub kopiert.
3. iPhone: dieselbe HTTPS-App mit demselben Konto öffnen und neu laden. Dann entfällt die zweite Key-Eingabe, wenn Supabase erreichbar ist und Schritt 2 erfolgreich war. Falls noch die alte Oberfläche erscheint, App/Safari-Tabs schließen und neu öffnen; keine Website-Daten löschen. Test „Milch kaufen“ muss „mit Gemini“ melden; danach einen nicht privaten Dienstplan auslesen und die Vorschau prüfen.

## Live-Test-Grenzen

Lokale .env enthält einen Key, aber `GEMINI_FREE_TIER_CONFIRMED=false`. Diese Einstellung blieb unverändert; kein echter Google-Aufruf wurde ausgeführt. Für den lokalen Server erst nach Billing-Prüfung auf true setzen und START-KOMPASS.cmd neu starten. Das gilt nicht als automatische Konfiguration der gehosteten App. Die gehostete App verwendet den eigenen Kontokey.

Nicht als bestanden behauptet: echter Supabase-Login, RLS mit zwei Konten, tatsächliche Key-Übernahme auf einem iPhone, echter Gemini-Aufruf und Fotoauslesung. Der anonyme Supabase-Check lieferte 401, keinen Zugriff auf Kontodaten. Die Kontosynchronisierung wurde mit getrennten Geräte-/Kontospeichern in Tests geprüft.

## Git und künftige Veröffentlichungen

Der ursprüngliche Projektordner ist kein Git-Checkout. Für die Veröffentlichung wurde ein isolierter Checkout unter `work/alltags-kompass-publish` verwendet. Er enthält nun auch Build-Skripte, Tests und SQL-Migrationen. Remote: `https://github.com/Jacksnfraps/alltags-kompass.git`. Branch: main. Keine Änderung an anderen Projekten.

Künftig nach `npm.cmd test` und `npm.cmd run build:static` den vollständigen Inhalt von dist einschließlich versteckter `.nojekyll` in die Repository-Wurzel übernehmen. Anschließend `git add --all`, `git diff --cached --stat`, `git commit` und `git push origin main`. Niemals .env kopieren/committen. Pages-Workflow abwarten und die öffentliche build-info.json samt Hashes vergleichen. Nur den Ordner dist oder nur index.html hochzuladen reicht nicht.
