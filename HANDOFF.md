# HANDOFF – Alltags- & Ideen-Kompass

> **Aktueller Stand: v0.6.0 – siehe Abschnitt „v0.6.0 – eigener Gemini-Key im Konto“ ganz am Ende** (davor „v0.5.0 – freie Listen-Erkennung“ und „v0.4.0 – dritte iPhone-Runde“). Frühere Runden: Abschnitte „Übernahme durch Claude – v0.3.0“, „v0.3.1 – iPhone-Rückmeldungen“ und „v0.3.2 – zweite iPhone-Runde“ am Ende dieser Datei.** Alles davor ist Codex-Historie.

## Schritt 1: Initialisierung
Projektpfad: outputs/alltags-kompass. Angelegt: HANDOFF.md.
Umfang: lokales, eigenständiges Projekt-Grundgerüst; kein Dienst aktiviert, kein Deployment.
Entscheidung: Abhängigkeitsarme statische PWA mit ES-Modulen; Supabase-Schema separat. KI zunächst deaktiviert.
## Schritt 2: Daten-Grundgerüst abgeschlossen
Dateien: package.json, .gitignore, .env.example, src/domain/model.d.ts, src/domain/captures.js, src/data/local.js, src/data/cloud.js, supabase/migrations/001_initial.sql.
Implementiert: unveränderter Originaltext, lokale Speicherung mit Fehlerweitergabe, expliziter Cloud-Upload-Adapter, SQL mit RLS für alle Tabellen und zusammengesetzten Fremdschlüsseln gegen fremde Projekte/Captures.
Getestet: noch nichts; SQL nicht auf einer Datenbank ausgeführt. Auth-Adapter vorhanden, echte Anmeldung und Sync noch nicht verdrahtet.
## Schritt 3: Basis-UI und PWA-Shell abgeschlossen
Neue Dateien: index.html, src/styles.css, src/app.js, manifest.webmanifest, icon.svg, sw.js.
Implementiert: Deep-Dark-Layout für Mobil/Desktop, Brain-Dump, Originalanzeige, JSON-Export, Offline-Shell. Diktat über Tastatur-Mikrofon; keine eigene Spracherkennung. Keine privaten Beispieldaten.
Weitere Bereiche sind ausdrücklich als noch nicht implementiert gekennzeichnet. Lokaler Gastmodus nutzt localStorage; keine Mehrnutzer-Anmeldung im UI und kein automatischer Upload.
Offen: PNG-App-Icons/Apple-Touch-Icon, Browser-/iPhone-Test, echter Auth-Flow, Kontowechsel mit getrenntem Offline-Speicher, IndexedDB/Sync-Outbox, Import, Sortierung, Termine, Zähler-UI und Erinnerungen, Fotoeingabe, KI.
## Schritt 4: Start und Prüfungen vorbereitet
Neue Dateien: scripts/serve.mjs, tests/captures.test.mjs, README.md.
Keine Pakete installiert; keine externen Dienste/API-Schlüssel/Konten aktiviert. Kein Hosting veröffentlicht, da der Startauftrag ein Projekt-Grundgerüst betrifft.
Tests decken exakten Originalerhalt, leere Eingabe, Speicherfehler, beschädigte Daten und die Bestandsschwelle ab. `npm test`: 5 bestanden, 0 fehlgeschlagen (25.11.2026).
## Schritt 5: Grundgerüst verifiziert
`node --check`: alle 7 JavaScript-/MJS-Dateien erfolgreich. Kein Ausführungsfehler oder Kontingent-Hinweis festgestellt. Startauftrag als lokales Grundgerüst abgeschlossen.
Nicht geprüft: Rendering im Browser, HTTP-Start, Service-Worker-Lebenszyklus, iOS-Installation, SQL auf Supabase, echter Auth-Adapter. Daher keine Behauptung einer produktionsreifen oder fertig mehrbenutzerfähigen App.
Exakter nächster Schritt für Claude: Im Projektverzeichnis `npm start` ausführen, `http://localhost:4173` im Browser öffnen, eine mehrzeilige Eingabe speichern, neu laden und JSON-Export vergleichen; danach Offline-Neuladen sowie schmale iPhone-Ansicht testen. Zuvor geltende Browser-/Preview-Skill-Regeln lesen. Nach diesem Teilpaket HANDOFF.md aktualisieren. Anschließend PNG-Icons ergänzen und Auth/RLS in einer getrennten Testumgebung mit zwei Konten prüfen, ohne kostenpflichtige Dienste zu aktivieren.
Bei jedem erkannten Fehler oder Limit: Ist-Stand hier festhalten und sofort stoppen.

## Ausbau A: Heimnetz-Start abgeschlossen
Geändert: scripts/serve.mjs (0.0.0.0, LAN-Adressen, Port konfigurierbar), src/domain/captures.js. Neu: START-KOMPASS.cmd, src/domain/id.js.
Doppelklick auf START-KOMPASS.cmd startet die App und zeigt iPhone-Adressen. UUID-Fallback funktioniert auch außerhalb sicherer Browser-Kontexte, wo randomUUID fehlt. Heimnetz-HTTP ermöglicht UI-Test, aber Service Worker benötigt HTTPS/localhost. Firewall wurde nicht verändert.
Noch nicht getestet: Serverstart/LAN-Gerät. Nutzer hat bestätigt: noch keine Supabase-/Gemini-Zugänge; lokal weiterbauen, Einrichtung vorbereiten. Daher keine Live-Cloud-Verifikation möglich.
Nächster Schritt: IndexedDB-Outbox mit getrennten Konten und Cloud-Ereignisprotokoll implementieren, dann Auth-/Realtime-Adapter.

## Ausbau B: Datenhaltung abgeschlossen (noch nicht ausgeführt)
Neu: src/domain/state.js, src/data/store.js, supabase/migrations/002_offline_operations.sql.
IndexedDB speichert Operationen und Bild-Blobs atomar; eigener Namensraum je Gast/Konto. Migration des bisherigen localStorage erhält die alte Sicherung. Append-only Cloud-Protokoll statt Snapshot-Überschreiben; unveränderliche Originale, idempotente IDs, RLS, privater Foto-Bucket. Bestehende 001-Tabellen bleiben erhalten; v0.2 verwendet kompass_ops als maßgebliche Sync-Datenquelle.
Modell ergänzt um Bestand, tägliche Entnahmen, Aufstockungen und Wiederholungsberechnung. Tagesentnahmen werden pro Bestand/Tag nicht doppelt gezählt.
Offen: SQL live testen (kein Projekt vorhanden); Lösch-/Retention-Workflow für das unveränderliche Protokoll später erforderlich.
Nächster Schritt: Auth-, Realtime- und Cloud-Sync-Module, serverseitige Konfiguration/KI-Gateway.

## STOPP – Werkzeugfehler am 25.11.2026
Verbindliche Fehler-Regel ausgelöst. Keine weiteren Implementierungs- oder Prüfrunden durchgeführt.
Exakte Fehlermeldung:
`apply_patch verification failed: invalid patch: multiple operations target C:\Users\Samsung\Documents\Codex\2026-11-25\du-arbeitest-an-einer-neuen-eigenst\outputs\alltags-kompass\src\data\cloud.js`
Ursache: Ein Patch wollte src/data/cloud.js innerhalb desselben Aufrufs löschen und neu anlegen. Das Patch-Werkzeug hat den Patch bei der Validierung abgewiesen. Das gesamte Teilpaket C ist daher NICHT als angewendet zu betrachten; keine nachträgliche Dateiprüfung durchgeführt, um die Stopp-Regel einzuhalten.

### Sicher abgeschlossene Änderungen dieses Ausbaus
- scripts/serve.mjs: 0.0.0.0, Anzeige der LAN-IPv4-Adressen, PORT-Umgebungsvariable.
- START-KOMPASS.cmd: Start per Doppelklick mit Node-Prüfung.
- src/domain/id.js: UUID-Fallback für LAN-HTTP.
- src/domain/captures.js: verwendet neuen UUID-Helper.
- src/domain/state.js: Operationen/Projektion, Bestandsberechnung, Tagesentnahmen, Wiederholungstermine, Entry-Defaults.
- src/data/store.js: IndexedDB, Konto-Namensräume, atomare Outbox/Bild-Speicherung, Migration der alten localStorage-Captures ohne Löschen der Originaldaten.
- supabase/migrations/002_offline_operations.sql: append-only Sync-Protokoll, RLS, Realtime-Publikation, privater Foto-Bucket.
- HANDOFF.md: nach Teilpaket A und B sowie jetzt beim Fehler aktualisiert.

### Funktioniert/getestet vs. offen
Die ursprünglichen fünf Tests und sieben Syntaxchecks gelten nur für v0.1. Neue Änderungen dieser Runde wurden noch NICHT getestet. Die vorhandene Oberfläche verwendet noch den alten localStorage-Adapter, nicht den neuen IndexedDB-Store. src/data/cloud.js ist weiterhin der v0.1-Adapter, sofern keine unerwartete Teilanwendung erfolgte. Neue SQL-Migration nicht ausgeführt. Kein Server gestartet, keine Firewall geändert, kein Cloud-Konto/Deployment/Billing aktiviert.
Service Worker noch v1: neuer Import src/domain/id.js muss vor Offline-Test zur SHELL-Liste hinzugefügt und Cache-Version erhöht werden. Bottom-Nav noch nicht umgesetzt.

### Entscheidungen und Blocker
Nutzerantwort: Noch kein Supabase-Projekt und kein Gemini-Key; lokal weiterbauen und Einrichtung vorbereiten. Keine geheimen Daten im Chat erfragen. .env mit leeren Platzhaltern sollte im abgewiesenen Teilpaket entstehen, ist also noch nicht zuverlässig vorhanden. Live-Auth/Sync/KI können ohne Konfiguration nicht geprüft werden.
Neue Architektur: kompass_ops ist für v0.2 maßgebliche Sync-Quelle; 001-Tabellen unverändert erhalten. Operationen statt kompletter Snapshot-Uploads verhindern Verlust unabhängiger Änderungen. Gastdaten niemals automatisch einem Konto zuordnen. Bild-Blobs lokal und später privater Supabase-Bucket. Geplant: Auth REST, Token-Refresh, Realtime-WebSocket, paginierter Abgleich und Offline-Queue. KI serverseitig über .env, keine Schlüssel im Browser; nur ohne aktiviertes Billing und mit begrenzten Anfragen.
Offizielle Quellen gelesen: https://supabase.com/docs/guides/realtime/protocol , https://supabase.com/docs/guides/auth , https://supabase.com/docs/guides/database/postgres/row-level-security , https://ai.google.dev/gemini-api/docs/structured-output , https://ai.google.dev/gemini-api/docs/pricing , https://supabase.com/pricing . Free-Tiers sind begrenzt; keine Zusage unbegrenzter Gratisnutzung. Gemini Free Tier kann Inhalte zur Produktverbesserung verwenden; sensible Originale/Bilder nur nach bewusster Nutzerwahl übertragen.

### Exakter nächster Schritt für Claude / nächste freigegebene Runde
1. Zuerst aktuellen Dateibestand lesen; den abgewiesenen Patch NICHT als umgesetzt voraussetzen.
2. src/data/cloud.js mittels EINER Update-Operation ersetzen (nicht Delete und Add desselben Pfads im selben Patch). Danach src/data/sync.js, scripts/config.mjs und leere .env/.env.example ergänzen. Anschließend HANDOFF aktualisieren.
3. Server-Konfigurationsroute und geschütztes Gemini-Gateway mit Limits/Fallback erstellen; lokale manuelle Sortierung zuerst nutzbar machen.
4. App auf IndexedDB migrieren, Auth-/Sync-UI anbinden, Kontowechsel und Gastimport absichern. Bottom-Nav und die vier geforderten Bereichs-UIs implementieren.
5. Service-Worker-Modulliste/Cache-Version aktualisieren. Relevante Tests inklusive Migration, Offline-Speicherung, Kontotrennung, Realtime-Abgleich, Bestandszählung und Wiederholungen ausführen; Browser/LAN testen. SQL mit zwei Konten prüfen, sobald Nutzer kostenloses Projekt eingerichtet hat.
Bei erneutem Werkzeug-/Testfehler oder Rate-/Kontingentwarnung sofort hier aktualisieren und stoppen, wie vom Nutzer verbindlich verlangt.

## Fortsetzung C abgeschlossen: Cloud- und Konfigurationsadapter
Datum: 25.11.2026. Nutzer autorisiert Fortsetzung, Priorität Funktion vor iPhone-Layout.
Geändert/neu: src/data/cloud.js, src/data/sync.js, scripts/config.mjs, .env.example.
Implementiert: Auth REST (Registrierung/Login/Refresh/Logout), idempotenter Operations-Upload, paginierter vollständiger Abgleich, Realtime-WebSocket und periodischer Fallback, private Bildübertragung, Konfigurationsparser ohne Browser-Auslieferung geheimer Keys. Noch keine Zugangsdaten/Dienste eingerichtet und noch nicht getestet.
Nächster Schritt: vorhandene UI auf IndexedDB umstellen, Kontosteuerung/Sync anbinden und Service Worker aktualisieren. Danach KI und Bereichsfunktionen.

## STOPP der Fortsetzung – 25.11.2026
Fehler-Regel erneut ausgelöst; keine weitere Reparatur- oder Prüfrunde begonnen.
Exakte Fehlermeldung des zweiten Patch-Aufrufs:
`apply_patch verification failed: Failed to find expected lines in C:\Users\Samsung\Documents\Codex\2026-11-25\du-arbeitest-an-einer-neuen-eigenst\outputs\alltags-kompass\index.html: <body><div class="shell"><aside>`
Ursache: Ein überflüssiger Update-Hunk am Ende des UI-Pakets verwendete nur einen Zeilenanfang als erwartete ganze Zeile. index.html enthält den Body größtenteils in langen vollständigen Zeilen. Der Patch wurde abgewiesen. Keine nachträgliche Bestandsprüfung vorgenommen, damit die Stopp-Regel eingehalten wird.

### Sicher gespeichert in dieser Fortsetzung
Der erste Patch war erfolgreich:
- src/data/cloud.js: ersetzt durch Cloud-Klasse mit REST Auth, Session-Speicherung, Token-Refresh, Upload/Pull, privaten Foto-Uploads und Realtime-WebSocket.
- src/data/sync.js: neu, Synchronizer mit Outbox-Verarbeitung, Realtime-Anstoß und 30-Sekunden-Abgleich.
- scripts/config.mjs: neu, .env-Parser und Validierung öffentlicher Supabase-Konfiguration.
- .env.example: Supabase/Gemini/Free-Tier-Bestätigung/Port vorbereitet.
- HANDOFF.md: Teilpaket C und dieser Fehlerstand.
Diese Änderungen sind NICHT getestet. Kein Live-Cloud-Projekt, keine Zugangsdaten, kein Billing eingerichtet.

### Abgewiesenes UI-Teilpaket – NICHT als umgesetzt voraussetzen
Geplant waren: neue src/ui.js, src/account.js, src/forms.css; Austausch src/app.js auf IndexedDB + Cloud/Sync; Konfigurationsroute in scripts/serve.mjs; Service Worker v2 mit vollständiger Importliste; Stylesheet-Verknüpfung in index.html.
Der Patch scheiterte bei der Validierung von index.html. Vor Fortsetzung Dateibestand prüfen, mögliche Teilanwendung nicht behaupten. UI-Anbindung weiterhin nicht als funktionsfähig melden. Auch Teilpaket C noch nicht durch Tests bestätigt.

### Exakter nächster Schritt
1. Dateibestand von src/ui.js, src/account.js, src/forms.css, src/app.js, scripts/serve.mjs, sw.js und index.html lesen.
2. Kleine getrennte Patches anwenden. Zuerst UI-Helfer/Account-UI, dann app.js und Server-Konfiguration. index.html separat ändern: komplette tatsächliche Zeile verwenden ODER Stylesheet über @import in src/styles.css einbinden; keinen Teil einer langen HTML-Zeile als Patch-Kontext benutzen.
3. Nach jedem abgeschlossenen Teilpaket HANDOFF aktualisieren. Bereits gespeicherte Cloud-Klasse verwenden, nicht erneut mit Delete/Add ersetzen.
4. Service Worker auf neue Versionsnummer und vollständige Module aktualisieren; danach Syntax und vorhandene Tests prüfen. Bei Fehler sofort hier speichern und stoppen.
5. Erst nach funktionierender IndexedDB-/Auth-/Sync-UI KI-Gateway und vier Bereichs-UIs umsetzen. iPhone-Layout ausdrücklich nachrangig. Live-Supabase/Gemini-Verifikation bleibt ohne Nutzerkonfiguration offen.

### Weiterhin zu berücksichtigen
Keine privaten Beispiele als Nutzerdaten einbauen. Originaltext unveränderlich. Gastdaten nur ausdrücklich einem Konto zuordnen. Kontowechsel darf laufende Sync-Aufträge nicht auf das andere Konto umleiten. Bilder und Originale nur bewusst an Gemini senden; Key ausschließlich serverseitig. Rate-Limit-Fallback speichert lokal und vermeidet unbeschränkte Wiederholungen. 0-Euro-Regel: kein Billing, keine kostenpflichtigen Dienste oder Upgrades.

## UI-Anbindung Teil 1 – 25.11.2026
Dateibestand geprüft: vorherige UI-Patches waren nicht angewendet. Neu: src/main.js und src/account.css. src/app.js lädt jetzt main.js. Bestehendes HTML bleibt unangetastet; Kontobereich/Styles werden über DOM-APIs eingebunden. IndexedDB inklusive Altbestand-Migration, kontogetrennte Entwürfe, Login/Registrierung/Logout, expliziter Gastimport, Sync und Export angebunden. src/data/sync.js wartet beim Stoppen auf laufende Übertragung, bevor ein Konto gewechselt wird. Noch ungetestet. Nächster Schritt: Server-Konfigurationsroute und vollständige Service-Worker-Shell, danach Tests.

## UI-Anbindung Teil 2 – Konfiguration/Offline-Shell abgeschlossen
Geändert: scripts/serve.mjs lädt .env und liefert ausschließlich öffentliche Supabase-Konfiguration unter /api/config. sw.js enthält sämtliche UI-/IndexedDB-/Sync-Module und Cache-Version v3. Neu: EINRICHTUNG.md und tests/sync.test.mjs. index.html wurde nicht über fehleranfälligen Teilzeilen-Patch verändert. Keine Zugangsdaten eingerichtet, keine Dienste aktiviert. Nächster Schritt: Syntaxchecks, automatisierte Tests und lokaler HTTP-/Browser-Test. Live-Cloud/RLS weiterhin ungetestet.

## Prüfung Teil 3
10 automatisierte Tests bestanden (5 Bestand + 5 Sync/Originalschutz), 0 Fehler. JavaScript-Syntaxchecks aller JS/MJS-Dateien bestanden. Tests verwenden Cloud-Stubs; sie ersetzen keinen Live-Supabase-/RLS-Test. Nächster Schritt: lokaler Serverstart und UI-Ladetest.

## Prüfung Teil 4 – UI und HTTP
Lokaler Testserver auf temporärem Port 54455 gestartet. UI lädt, Gast-Kontohinweis korrekt, mehrzeiligen Gedanken gespeichert und nach Neuladen unverändert angezeigt. Keine JavaScript-Fehler im Browserlog. Alle Offline-Shell-Assets per HTTP verfügbar; /api/config enthält nur öffentliche Felder; .env wird nicht ausgeliefert. Testdaten nur im Browser-Origin localhost:54455, nicht im normalen Port 4173. Nächster Schritt: kontrollierter Offline-Test durch Stoppen ausschließlich dieses Testservers.

## Abschluss der gezielten UI-/Sync-Anbindung – 25.11.2026
Dieser Schritt ist abgeschlossen; keine Ausweitung auf KI, Bereichs-UIs oder Layout vorgenommen.

### Dateien und angebundene Funktionen
- src/app.js: schlanker Einstieg in src/main.js.
- src/main.js: vorhandene Oberfläche mit IndexedDB, Originalanzeige, Altbestand-Migration, kontogetrennten Entwürfen, Export, Supabase-Login/Registrierung/Logout, expliziter Gastdatenübernahme und Synchronizer verbunden.
- src/account.css: minimale Styles für Kontobereich; kein UI-Redesign.
- src/data/sync.js: stop() wartet auf laufende Übertragung; UI wechselt erst danach den Kontospeicher. Unbestätigte Operationen bleiben bei Cloud-Fehlern pending.
- scripts/serve.mjs: .env wird durch bestehenden Konfigurationsparser geladen; /api/config gibt nur Supabase-URL/Publishable-Key aus. Geheimnisse/.env nicht über statischen Server verfügbar.
- sw.js: Cache v3, vollständige Liste aller 13 Offline-Shell-Ressourcen.
- EINRICHTUNG.md: lokale Nutzung, Free-Projekt-Konfiguration, SQL-Reihenfolge, Login, Gastimport, Offline-Grenzen und offene Prüfungen.
- tests/sync.test.mjs: fünf neue Tests für Queue, Erfolgsbestätigung, Netzfehler, Stop/Warten und Originalschutz.
- index.html blieb unverändert; fehlerhafter HTML-Zeilenabgleich wird nicht mehr verwendet. Kontobereich und Styles werden sicher über DOM-APIs eingebunden.

### Tatsächlich geprüft
- npm.cmd test: 10 Tests bestanden, 0 fehlgeschlagen.
- node --check: alle 14 JS/MJS-Dateien erfolgreich.
- Lokaler Serverstart auf freiem Testport 54455 erfolgreich.
- Browser: bestehende UI lädt, Kontohinweis im Gastmodus korrekt, keine JavaScript-Fehler beim Online-Test.
- Mehrzeiligen Originaltext gespeichert und nach Reload unverändert sichtbar.
- HTTP: alle 13 Shell-Ressourcen erreichbar; öffentliche Konfiguration auf zwei vorgesehene Felder begrenzt; /.env liefert erwartetes 404.
- Kontrollierter Offline-Test: eigenen Node-Testserver gestoppt, App aus Service-Worker-Cache neu geladen, zweiten mehrzeiligen Gedanken gespeichert, erneut geladen; beide Gedanken erhalten. Dies prüft fehlenden App-Server, keine echte Internetabschaltung am iPhone.
- Testserver danach gestoppt belassen. Testdaten ausschließlich im separaten Browser-Origin localhost:54455. Regulärer Nutzer-Origin/Port 4173 unberührt.

### Offen / nicht live geprüft
Kein Supabase-Projekt/Zugang vorhanden: echter Login, E-Mail-Bestätigung, Refresh, RLS, Realtime und Zwei-Geräte-Sync nicht end-to-end geprüft. Sync-Tests verwenden Stubs. IndexedDB-Migration eines vorhandenen Nutzerdatensatzes und Kontotrennung mit zwei echten Konten noch praktisch prüfen. Private Foto-Adapter vorhanden, keine Upload-Oberfläche in diesem Auftrag. Export vorhanden, Backup-Import-UI fehlt. LAN-HTTP auf iPhone hat keine Service-Worker-Installation; HTTPS erforderlich. .env.example vorbereitet, keine echten Zugangsdaten gespeichert, keine kostenpflichtigen Dienste aktiviert.

### Exakter nächster Schritt
Nutzer kann START-KOMPASS.cmd neu starten, seine gewohnte URL öffnen; bei alter Offline-Version alle Kompass-Tabs schließen und erneut öffnen (keine Browserdaten löschen). Für Live-Sync ein kostenloses Supabase-Projekt nach EINRICHTUNG.md konfigurieren, Migrationen 001/002 einmalig anwenden und URL/Publishable-Key in lokale .env eintragen. Danach mit zwei Konten RLS/Kontotrennung und mit demselben Konto auf zwei Geräten Offline→Online-Abgleich prüfen. Erst anschließend den separat zu autorisierenden KI-/Bereichsausbau fortsetzen. Bei Fehler/Limit weiterhin HANDOFF aktualisieren und stoppen.

## Sortierpaket Teil A – 25.11.2026
Neu: src/domain/sort.js (lückenlose Original-Spannen, Regeln/Kategorien, Bauprojekt-Kontext, Zeit/Energie, Fakten, deterministische IDs, idempotente Sortieroperationen), scripts/gemini.mjs (optionale Metadaten-KI, Antwortvalidierung, Timeout, maximal 20 Aufrufe je Serverstart, Circuit-Breaker und lokaler Fallback). Noch ungetestet. Nächster Schritt: Serverroute und UI mit Originaleinsicht/Unsicherheitsauswahl anbinden. Kein Dienst aktiviert.

## Sortierpaket Teil B – UI/Gateway angebunden
Geändert: src/main.js, src/account.css, scripts/serve.mjs, sw.js; neu: src/sort-view.js. Original wird vor jeder Sortierung separat committed. Neue Einträge werden lokal automatisch sortiert, alte per Jetzt sortieren. Vier Bereiche zeigen abgeleitete Einträge, Gruppen, Fakten, Schätzungen und vollständige Originale; unklare Zuordnung per kompakter Auswahl, manuelle Korrektur möglich. Gemini nur nach Sitzungs-Opt-in, serverseitigem Key und Free-Tier-Bestätigung. API mit Same-Origin/Token-Prüfung und Größenlimits; kein Secret in Browserkonfiguration. Offline-Shell v4. Noch ungetestet. Nächster Schritt: passende Regeln-/Gateway-Tests, Syntax und Browser-Smoke-Test.

## Sortierpaket Teil C – automatische Prüfungen
20 Tests bestanden, 0 Fehler. Alle JS/MJS-Syntaxchecks bestanden (18 Dateien). Neue Tests prüfen lückenlose Spannen, Dezimalmaße, vier Kategorien, Projektfolge, mehrdeutige Räume, Idempotenz, ungültige KI-Antworten und simulierten Ausfall/429-Fallback. Kein echter API-Aufruf. Nächster Schritt: UI-Smoke-Test und Einrichtungshinweise abschließen.

## STOPP / Sortierpaket implementiert, Browser-Abnahme offen – 25.11.2026
Exakte Werkzeugmeldung beim ersten Browser-Aufruf:
`Kernel state was reset after inactivity. This code was not executed. Reinitialize your imports, variables, and browser handles, then retry.`
Gemäß Nutzerregel kein erneuter Browser-Aufruf und keine Reparaturrunde. Das ist ein Browser-Werkzeugzustand, kein nachgewiesener App-Fehler.

### Gespeicherter Umfang
- src/domain/sort.js: lückenlose Zerlegung in Original-Spannen, lokale Kategorie-/Zeit-/Energievorschläge, Bauprojekt-Bündelung und Schrittfolge, Maße, Prüfhinweise, Unsicherheitsflag, deterministische IDs, Schutz gegen erneute doppelte Sortierung.
- scripts/gemini.mjs: optionales Gemini-Gateway, nur freigegebene Modelle, Key + GEMINI_FREE_TIER_CONFIRMED notwendig; Originaltexte und Fakten können durch KI nicht überschrieben werden. Timeout/Fehler/429/ungültige Antwort führen lokal weiter, danach keine weiteren KI-Versuche bis Server-Neustart. Maximal 20 Aufrufe je Serverlauf; kein Billing aktiviert.
- src/main.js: Original wird zuerst gespeichert, danach automatisch lokal sortiert. Altbestand erhält Jetzt-sortieren-Button. KI nur nach bewusstem Checkbox-Opt-in pro Sitzung, sonst keine Datenübertragung an Google. Korrektur der Zuordnung möglich.
- src/sort-view.js: vier Bereiche zeigen abgeleitete Einträge, gruppierte Projekte, Schätzungen, Fakten, Prüfhinweise und vollständigen Originaltext je Eintrag; unklare Zuordnung mit Auswahl.
- src/account.css: minimale zusätzliche Styles.
- scripts/serve.mjs: POST /api/sort, Same-Origin/Token-Prüfung, Körper-/Textgrößenlimit. /api/config ergänzt aiEnabled und sortToken (kein API-Key).
- sw.js: Cache v4 mit 15 Offline-Assets.
- tests/sort.test.mjs: 10 zusätzliche Tests.

### Tatsächlich geprüft
20 Tests bestanden (einschließlich vorheriger 10), 18 JS/MJS-Dateien syntaktisch geprüft. Tests umfassen lückenlose Originalabdeckung inkl. Dezimalmaßen, vier Kategorien, Projektfolge, mehrdeutige Räume, Fakten, Idempotenz und simulierte KI-Ausfälle/ungültige Antworten/429. Keine echte API benutzt. Node-Testserver startete erfolgreich auf Port 62321. Browser-Test wurde wegen obiger Werkzeugmeldung NICHT ausgeführt. Bestehende Live-Supabase-/RLS-Prüfungen weiterhin offen.

### Grenzen / Entscheidungen
Lokale Regeln sind bewusst begrenzt: Sie zerlegen an Satz-/Zeilengrenzen und einigen Übergängen, erkennen typische deutsche Schlüsselwörter und eindeutigen Baukontext. Ein sehr langer unpunktierter Gedanke kann als einzelner Eintrag erhalten bleiben und als unklar markiert werden. Keine Garantie menschlicher semantischer Perfektion. Unklare Zuordnung lässt sich korrigieren; Original bleibt im Eingang und pro Eintrag einsehbar. Maße werden extrahiert, Prüfhinweise sind keine fachliche Bauprüfung. Termin-/Medikamentenbereiche zeigen zugeordnete Gedanken, noch keine fertige Kalender-/Zähler-Funktion. KI liefert nur Metadaten für die lokal festgelegten Textabschnitte. Bereits sortierte Einträge werden nicht automatisch erneut überschrieben.

### Exakter nächster Schritt
1. Browser-Werkzeugsitzung frisch initialisieren und lokalen Server starten; separaten Testport verwenden, keine Nutzerdaten verändern.
2. Testtext eingeben: Wanddurchbruch Wohnzimmer planen. Türzarge einbauen. Danach spachteln. Milch kaufen. Mittwoch Gospelchor. Tabletten Packung 100 Stück.
3. Erwartung: 6 Einträge, vier Kategorien, ein gemeinsamer Umbau-Wohnzimmer-Strang für die drei Bauschritte, vollständiges Original im Eingang und in Eintragsdetails. Reload prüfen, unsicheren Gedanken korrigieren, Altbestand nachsortieren. Offline-Test nach Serverstopp.
4. Nach erfolgreicher Browser-Abnahme HANDOFF aktualisieren und Ergebnis berichten. Keine weitere Feature-Ausweitung für dieses Paket.
5. Optional später mit eigenem Gemini-Projekt OHNE Billing .env befüllen und GEMINI_FREE_TIER_CONFIRMED=true setzen. Free-Tier-Eignung liegt beim eingerichteten Konto; die App kann fremdes Billing nicht technisch prüfen. Bei fehlendem Key immer lokal. Referenz: https://ai.google.dev/gemini-api/docs/pricing . Echte KI-Abnahme bleibt offen.
Eigener Testserver Port 62321 beim Stopp beendet. Kein anderer Server gestoppt.

## Abschluss-Fix implementiert – 25.11.2026
Geändert: src/main.js und sw.js (v5); neu: src/data/capture-flow.js und tests/capture-flow.test.mjs. Automatische Sortierung war bereits aufgerufen; nun als testbarer Ablauf abgesichert: Original-Commit zuerst, danach Sortierung unabhängig von UI-Zwischenschritten. Sortierausfall ergibt explizit saved/pending mit Jetzt-sortieren-Möglichkeit, statt den erfolgreichen Original-Speichervorgang als Fehler darzustellen. Kein neuer Feature-Umfang. Tests noch auszuführen; nächster Schritt npm.cmd test und Syntaxchecks.

## Finale Übergabe an Claude – Abschluss-Fix abgeschlossen (25.11.2026)
Maßgeblicher aktueller Stand; frühere STOPP-Abschnitte sind historische Zwischenstände.

### Verhalten beim Sichern
Der Submit-Handler in src/main.js ruft saveAndSort aus src/data/capture-flow.js automatisch auf. Zuerst wird der exakte Originaltext mit pending-Status dauerhaft gespeichert. Erst danach wird das Eingabefeld geleert und dieselbe vorhandene Sortierung automatisch ausgeführt: Zerlegung, Kategorien, Projekte, Reihenfolge, Zeit/Energie. Keine Auswahl ist vor dem Sichern erforderlich. Ohne Gemini-Key/Opt-in/Netz arbeitet die lokale Heuristik. API-Fehler und Limits fallen lokal zurück. Scheitert auch die Sortierung oder ihr Speichern, bleibt das Original pending im Eingang; der vorhandene Jetzt-sortieren-Button erlaubt einen neuen Versuch. Bei einem Fehler schon beim Original-Commit bleibt die Eingabe stehen. Bereits abgeleitete Originalverknüpfungen werden nicht überschrieben.

### Geänderte Dateien dieses kleinen Abschluss-Fixes
- src/data/capture-flow.js (neu): testbarer save-first/sort-second-Ablauf, unterscheidet Speichern von Sortierausfall.
- src/main.js: verwendet diesen Ablauf; eindeutige Erfolgs-/Fallback-Meldungen, nachträgliche Sortierung ebenfalls mit Erhalt-Hinweis.
- sw.js: Cache v5; capture-flow.js in vollständiger Offline-Shell (16 Ressourcen).
- tests/capture-flow.test.mjs (neu): vier gezielte Ablauf- und Fehlerfalltests.
- HANDOFF.md: vor Tests und jetzt nach Abschluss aktualisiert.

### Verifiziert
npm.cmd test: 24 bestanden, 0 fehlgeschlagen. Alle 20 JS/MJS-Dateien mit node --check erfolgreich geprüft. Neue Tests verwenden den tatsächlichen lokalen Sortierer und einen Speicher-Stub: sechs Teilgedanken, vier Typen, gemeinsamer Projektstrang, Zeitwerte, Original exakt erhalten; Sortierausfall bleibt pending und ist nachsortierbar; fehlgeschlagener Original-Commit löst keine Sortierung/Leerung aus; ein fehlerhafter UI-Zwischenschritt verhindert die Sortierung nicht. Vorhandene Tests für API-Ausfall/429, Originalspannen, Projektreihenfolge und Sync ebenfalls bestanden. Kein echter Rate-Limit-/Werkzeugfehler in dieser Runde aufgetreten.

### Noch NICHT geprüft
Der neue Sortier-Submit-Ablauf wurde nicht im Browser oder auf dem iPhone end-to-end getestet. Der vorherige Browser-Test der Sortierausbaustufe blieb wegen zurückgesetzter Werkzeugsitzung offen. Frühere UI-/Offline-Speichertests gelten nur für den Stand vor der Sortierung. Kein echter Gemini-Aufruf, keine Live-Supabase-Auth-/RLS-/Zwei-Geräte-Prüfung. Keine Konten, kostenpflichtigen Dienste oder Billing aktiviert; keine Zugangsdaten benötigt. Keine neuen UI-Umbauten/Alltagsmodule begonnen. Kein Server in dieser Runde gestartet.

### Exakter nächster Schritt für Claude
1. START-KOMPASS.cmd bzw. npm.cmd start ausführen; eigene Browser-Werkzeugsitzung frisch initialisieren. Bei alter Offline-Version alle App-Tabs schließen und wieder öffnen, keine Browserdaten löschen.
2. Ohne Login/Key den bereits dokumentierten Sechs-Gedanken-Testtext speichern. Ohne Jetzt-sortieren-Klick müssen sechs Einträge entstehen und in den vier Bereichen erscheinen. Original mit Leerzeichen/Zeilenumbrüchen vergleichen, Projektfolge und Original-Details prüfen; danach Reload und Offline-Speichern testen.
3. Falls diese Abnahme besteht, HANDOFF aktualisieren. Erst danach weitere separat vereinbarte Arbeit beginnen; aktueller Auftrag war ausschließlich dieser Abschluss-Fix.
4. Bei jeder echten Fehlermeldung/Limitwarnung weiterhin sofort HANDOFF speichern und stoppen. Absichtlich simulierte Fehlerfälle in bestandenen Tests sind erwartete Testfälle, keine realen Ausfälle.


---

# Übernahme durch Claude – v0.3.0 (25.11.2026)
**Maßgeblicher aktueller Stand.** Alle Abschnitte oben sind historische Zwischenstände von Codex.

## Arbeitsumgebung
- Getrennte Testumgebung: `.claude/launch.json` → Konfiguration `kompass-test` startet `node scripts/serve.mjs --port 4180`. Port 4180 = eigener Browser-Origin mit eigener IndexedDB; der gewohnte Port 4173 und dessen Daten wurden nicht berührt. Testdaten liegen ausschließlich im Origin `localhost:4180`.
- `scripts/serve.mjs` akzeptiert jetzt `--port <n>` (überschreibt `.env`/`PORT`).
- Kein Framework, keine Pakete installiert, keine Dienste/Konten/Billing aktiviert. Keine `.env` angelegt.

## Paket A – Layout kompakt (fertig, im Browser geprüft)
- `index.html` neu und lesbar formatiert; großer Intro-Block/Orbit entfernt. Kopfzeile = Bereichstitel + Status-Pill + ⚙-Einstellungen.
- Eingabe als einzeilige, automatisch wachsende Zeile mit „＋ Sichern“ (Strg/Cmd+Enter sendet) – in jeder Ansicht oben erreichbar.
- iPhone (≤ 700 px): feste Bottom-Navigation mit 5 Bereichen + Zählern, Safe-Area berücksichtigt, Eingabefelder 16 px (kein iOS-Zoom). Bereiche mit Unteransichten (To-dos, Termine) als Segment-Tabs.
- Desktop (≥ 900 px), „mehr auf einem Blick“: Eingang 2-spaltig (Liste + „Kurz klären“), To-dos 3-spaltig (Aufgaben | Einkauf | Anrufe), Termine 2-spaltig (Agenda | Rhythmen/Müll/Dienstplan), Ideen-Stränge ab 1280 px 2-spaltig.
- Eingang mit Überblick-Kacheln: Kurz klären, offene To-dos (davon 15 Min.), nächster Termin, Tablettenbestand (gelb bei ≤ Schwelle).
- `src/styles.css` komplett neu (Tokens, kompakte Abstände, Deep-Dark beibehalten). `src/account.css` entfernt (in styles.css aufgegangen).
- Neue PNG-Icons `icon-180.png` (apple-touch-icon) und `icon-512.png`, erzeugt mit `scripts/make-icons.mjs` (ohne Abhängigkeiten); Manifest ergänzt.

## Paket B – Zerlegung/Sortierung/Stränge (fertig, getestet)
- Speichern → Original zuerst (unverändert, wie bisher `capture-flow.js`) → automatische lokale Sortierung. Neue Felder je Eintrag: `due_at`, `all_day`, `recurrence` (daily/weekly/biweekly/fourweekly/monthly), `person` (me/vanessa/kids/family), `category` (shopping/call/general bzw. appointment/rhythm/trash/shift), `items` (Einkaufsartikel), `contact` {who, when, why}.
- Neu `src/domain/when.js`: deutsche Datums-/Uhrzeit-/Rhythmuserkennung (heute/morgen, Wochentage, „mittwochs“ = wöchentlich, „alle zwei Wochen“, „3. Dezember“, „12.12.“, „19:30“, „19 Uhr“) und `stripWhen` für kurze Termintitel.
- Zerlegung: „19:30. Vanessa …“ wird getrennt, „3. Dezember“, „12.12.“, „2. Stock“ nicht. Original-Spannen bleiben lückenlos (Tests).
- Stränge: Bau-Bündelung wie bisher, dazu Themen (Garten, Urlaub, Feier, Umzug, Auto, Steuer, Weihnachten, Hochzeit); bestehende Stränge werden wiederverwendet.
- Unklare Zuordnung: Eingang „Kurz klären“ mit Ein-Tipp-Buttons (Idee/To-do/Termin/Tabletten) und Strang-Auswahl. Jeder Eintrag hat „…“ mit vollständigem Original, Bereich/Strang ändern, Titel ändern, Ausblenden (das Original bleibt).
- Ideen & Projekte: Umschalter „Großes Bild / Nächster Handgriff“, Fortschrittsbalken, Schritte umsortieren (↑↓), Schritt ergänzen, Foto-Anhang (lokal auf ≤ 1600 px JPEG verkleinert, IndexedDB, Sync über den vorhandenen privaten Bucket), „Maße & Eckdaten“ oben (aus dem Text erkannt + manuell ergänzbar, Labels wie Breite/Höhe erkannt) mit dezenter Warnung „fehlt: Breite, Höhe“ bei Bau-/Tür-Strängen, Wiedervorlage (⏾ Morgen/3 Tage/1 Woche/1 Monat) für Schritte und ganze Stränge, Stränge abschließen/wieder öffnen.
- Gemini-Gateway (`scripts/gemini.mjs`): nach Fehler/429 jetzt 15 Min. Abkühlphase statt Sperre bis Neustart; Tageslimit `GEMINI_DAILY_LIMIT` (Standard 100) statt 20 je Serverlauf. KI liefert weiterhin nur Metadaten, nur mit Key + `GEMINI_FREE_TIER_CONFIRMED=true` + Sitzungs-Zustimmung (jetzt in ⚙ Einstellungen).

## Paket C – Bereichs-UIs (fertig, im Browser geprüft)
- To-dos: Filter Alle/15/30/60 Min./Wenig Energie/Fokus mit Zählern; Einkaufsliste (Artikel einzeln abhakbar, „Im Wagen“, „Abgehakte entfernen“, Schnell-Eingabe „Milch, Brot“); Anrufe mit Wer/Wann/Weshalb (automatisch erkannt, bearbeitbar, Schnellformular); Erledigt-Listen, Wiedervorlage.
- Termine & Rhythmen: Agenda 7/14/31 Tage nach Tagen gruppiert, Personen farbig + Buchstabe (I/V/K/F, nicht nur Farbe), Personenfilter, „Noch ohne Datum“ mit Datum setzen, Termin-Formular (Person, Wiederholung, Art), Bearbeiten, einzelnes Vorkommen auslassen (⤼), Rhythmus beenden. Rhythmen-Liste mit nächstem Termin. Müllabfuhr: Tonne + erster Termin + Rhythmus, Hervorhebung „heute Abend rausstellen“. Dienstplan: Foto-Upload, „Foto auslesen“ (Gemini, falls freigegeben), **sonst Fallback**: Text einfügen oder Zeilen manuell → Prüf-Tabelle → „Bestätigen & eintragen“ (Früh/Spät/Nacht-Voreinstellungen), Person wählbar.
- Tabletten-Zähler: Bestand anlegen (Vorschlag aus „Packung 100 Stück“), „✓ Heute genommen (−n)“ mit Rückgängig, 7-Tage-Punkte, ≈ Tage Reichweite, ruhige Warnung ab ≤ 30 („Noch X Stück – Neues Rezept anfordern“ + „Erledigt: angefordert“), neue Packung, Bestand zählen & korrigieren (Korrektur als `adjustment` mit `direction:'out'`, SQL-kompatibel, da amount > 0). Doppeltipp auf zwei Geräten offline ergibt dieselbe Dosis-ID.
- Einstellungen-Dialog: Konto/Sync (bestehende Logik), KI-Zustimmung, Personen (Partnerin, Kindernamen für Auto-Zuordnung; nur lokal gespeichert), Sicherung exportieren **und importieren** (ergänzt nur fehlende Operationen/Fotos, überschreibt nichts).

## Paket D – Sync/Offline & Tests
- Bestehende Supabase-Architektur (append-only `kompass_ops`, RLS, Outbox, getrennte Kontospeicher) unverändert weiterverwendet; neue Felder liegen in `data` (jsonb) → **keine neue Migration nötig**. Fotos nutzen den vorhandenen privaten Bucket; fehlt ein Foto lokal und ist man angemeldet, wird es beim Anzeigen nachgeladen (`cloud.downloadBlob`).
- Service Worker v6: **Network-first** mit 4-s-Timeout und Cache-Fallback (vorher Cache-first → alte Versionen blieben hängen). Die Shell-Liste enthält alle 24 Dateien.
- Server: neue Route `POST /api/shiftplan` (Same-Origin + Token, 6-MB-Limit, nur jpeg/png/webp).
- Aktionen laufen in einer seriellen Warteschlange (schnelles Tippen geht nicht verloren).

### Tatsächlich geprüft (25.11.2026)
- `npm test`: **34 bestanden, 0 fehlgeschlagen** (24 bisherige + 10 neue in `tests/alltag.test.mjs`: Datumserkennung, Zerlegung, Kategorien/Personen/Anrufe/Einkauf, Operationsfelder, Wiederholungen inkl. Auslassen/Ende, Tablettenbestand inkl. Doppeltipp/Rückgängig/Korrektur/Schwelle, Dienstplan-Parser + KI-Validierung, To-do-Filter/Einkaufsliste, Maße-Warnung/Reihenfolge, Gemini-Tageslimit/Abkühlung mit simuliertem Fetch).
- `node --check`: alle 30 JS/MJS-Dateien ok.
- Browser (eingebauter Browser, Port 4180, Desktop 1280 px + iPhone-Emulation 375×812): 12-teiliger Test-Dump → 12 Einträge automatisch, Original zeichengenau gleich, 1 unklarer Eintrag in „Kurz klären“; Strang „Umbau Wohnzimmer“ mit 3 Schritten in richtiger Reihenfolge; Maße ergänzt → Warnung verschwindet; Foto-Anhang + Vorschau; Nächster Handgriff erledigt → nächster erscheint; Einkauf abhaken; Anrufe Wer/Wann/Weshalb; Agenda/Rhythmen/Müll; Dienstplan-Foto + Text-Fallback → 3 Dienste bestätigt; Tabletten 100 → 99 → Korrektur 30 → Warnung. Keine JS-Fehler; kein horizontales Scrollen am iPhone.
- Offline: Testserver gestoppt, App aus dem Service-Worker-Cache geladen, mehrzeiligen Gedanken gespeichert + sortiert; nach Server-Neustart alles erhalten.
- HTTP: `/.env` → 404, `/api/config` nur öffentliche Felder, `/api/shiftplan` ohne Token → 403.

### Nicht geprüft / offen
- **Live-Supabase** (Login, RLS mit zwei Konten, Realtime, Zwei-Geräte-Sync, Foto-Upload/-Download) – keine Zugangsdaten vorhanden.
- **Echter Gemini-Aufruf** (Sortierung und Dienstplan-Foto) – kein Key; nur mit simuliertem Fetch getestet. Qualität der Foto-Auslesung unbekannt → Ergebnis wird immer erst zur Bestätigung angezeigt.
- **Echtes iPhone/Safari** (Home-Bildschirm-Installation, Kamera-Upload, Bottom-Nav mit Home-Indikator, Datum-/Zeit-Picker). Nur Viewport-Emulation im Chromium-Pane. Offline-PWA auf dem iPhone braucht HTTPS (LAN-HTTP nur online).
- Kindernamen/Partnerin werden nur lokal gespeichert (nicht synchronisiert; die SQL-Prüfung erlaubt keine eigene „settings“-Entität ohne Migration).
- Die lokale Heuristik ist regelbasiert: ungewöhnliche Formulierungen landen ggf. in „Kurz klären“ oder im falschen Bereich (jederzeit per „…“ korrigierbar). Bereits vor v0.3 sortierte Einträge behalten ihre alten Titel/Felder.
- Keine Push-Erinnerungen (Müll am Vorabend, Rezept) – PWA-Push auf iOS braucht Installation + Web-Push-Server.

### Exakter nächster Schritt
1. Nutzer: `START-KOMPASS.cmd` starten, gewohnte URL öffnen (Port 4173 – dort liegen die echten Daten). Network-first-SW lädt die neue Version automatisch; falls noch alt: alle Kompass-Tabs schließen und neu öffnen.
2. Auf dem echten iPhone im WLAN durchklicken (Eingabe, Bottom-Nav, Foto-Upload, Datumsfelder) und Auffälligkeiten melden.
3. Für Sync: kostenloses Supabase-Projekt nach EINRICHTUNG.md, `.env` füllen, dann Zwei-Konten-RLS- und Zwei-Geräte-Test.
4. Optional Gemini (ohne Billing) → Dienstplan-Foto mit echtem Plan testen.
5. Danach mögliche Ausbauten: Erinnerungen/Push, Personen-Einstellungen synchronisieren (neue Migration), Lösch-/Retention-Konzept.

## v0.3.1 – iPhone-Rückmeldungen (Claude, 25.11.2026)
Anlass: Jan hat v0.3.0 auf dem echten iPhone getestet und drei Punkte gemeldet. Weiterhin 0 €, keine neuen Dienste/Konten, keine `.env` angelegt. Version 0.3.1, Service-Worker-Cache `kompass-shell-v7` (iPhone lädt neuen Stand automatisch).

**1. Startseite ruhiger**
- `src/views/inbox.js`: Die Liste der Originaltexte ist standardmäßig eingeklappt („▸ Letzte Eingänge (X) anzeigen · zuletzt …“). Aufgeklappt gibt es Suche plus alle vollständigen Originale. Der Zustand `ui.inboxOpen` gilt bewusst nur für die Sitzung und steht nicht in `UI_KEYS`. Eine aktive Suche hält die Liste offen (`inboxArchiveOpen`).
- „Kurz klären“ erscheint nur noch, wenn wirklich etwas offen ist. Sonst sagt die Kachel „alles zugeordnet“ und der Eingang nutzt die volle Breite.
- Neu: Für ältere, noch offene Rückfragen rechnet `reviewSuggestion` mit den neuen Regeln nach und bietet einen Ein-Tipp-Vorschlag an („✓ To-do · Umbau Wohnzimmer“). Ab zwei Vorschlägen gibt es „✓ N Vorschläge übernehmen“. Nichts wird still übernommen.

**2. Termine & Rhythmen**
- Layout-Bug behoben: `.row-title` hat `flex:1; min-width:0; overflow-wrap:break-word` statt `overflow-wrap:anywhere` (das war der Buchstaben-Umbruch). Die „Noch ohne Datum“-Zeilen haben ein eigenes Layout: Titel in voller Breite, Datumsfelder umbrechend darunter.
- Die Agenda ist eine rein chronologische Liste ohne Tagesblöcke und ohne Stundenraster. Jede Zeile zeigt über dem Titel „Heute, 19:00“ bzw. „Fr 27.11., ganztägig“ und hat ein Personen-Badge. Der heutige Tag ist hervorgehoben (`whenText`, `eventRow(...,{flat:true})`).
- In „Noch ohne Datum“ wird ein im Text erkanntes Datum vorausgefüllt („Erkannt: Heute, 19:00 – bitte bestätigen“), relativ zum Schreibzeitpunkt des Eintrags.
- Wechselt man einen Eintrag manuell auf „Termin“ (Kurz klären oder „…“), wird das Datum aus dem Text übernommen (`kindPatch` in `src/ui.js`). Vermutete Ursache des iPhone-Befunds: Ein Eintrag war vorher Idee/Rückfrage und wurde per Knopf zum Termin, ohne Datum.

**3. Selbstständigere Sortierung** (`src/domain/sort.js`, `src/domain/when.js`)
- Bugfix: „übermorgen“ wurde nie erkannt, weil JS-`\b` Umlaute nicht als Buchstaben kennt. Jetzt prüfen Unicode-Lookarounds. Neu ist „am Wochenende“ (nächster Samstag). „heute Abend“ und ähnliche Angaben werden aus Titeln entfernt.
- Neue Reihenfolge der Regeln:
  - Tabletten
  - feste Uhrzeit plus Termin-Wort → Termin
  - Ideen-Signal („mir ist wichtig“, „wäre schön“, „man könnte“ …) → Idee
  - klare Aufgabe (Verbliste oder „ich muss / nicht vergessen / weiter arbeiten …“) → To-do
  - Bau-/Planungsschritt → Idee (Strang)
  - kleingeschriebenes Infinitiv am Ende („Fahrrad Reifen flicken“) → To-do
  - Termin-Wort oder Datum → Termin
- „Kurz klären“ kommt nur noch bei Fragmenten unter 4 Wörtern ohne jedes Signal oder bei mehreren passenden Strängen.
- Ein eindeutig passender bestehender Strang (Titelwörter im Text) oder ein Themen-Strang hebt die Rückfrage auf. „Durchbruch“ zählt jetzt als Bau-Stichwort, sodass ein einziger bestehender „Umbau …“-Strang automatisch zugeordnet wird.
- Titel werden gekürzt („Heute ist um 19:00 Uhr Chorprobe“ → „Chorprobe“, „Ich muss heute an dem Durchbruch …“ → „An dem Durchbruch weiter arbeiten“). Das Original bleibt unverändert und über „…“ einsehbar.

**Nebenbei behoben:** In `src/main.js` war die Regex, die geöffnete `<details>` über Neu-Renderings hält, kaputt (`/(d+)/` statt `/\(\d+\)/`).

**Geprüft**
- `npm test`: 42/42 bestanden. Neu ist `tests/iphone-feedback.test.mjs` mit 8 Tests: relative Daten, die drei Beispielsätze, Operationen und Original, `kindPatch`, `reviewSuggestion`, eingeklapptes Archiv, chronologische Agenda, CSS-Umbruch. `node --check` ist für alle JS-Dateien fehlerfrei.
- Browser auf Testport 4180 bei 375×812 und 390×844:
  - Der Dump mit den drei Beispielsätzen ergab ohne Rückfrage Termin „Chorprobe“ heute 19:00, To-do im Strang „Umbau Wohnzimmer“ und eine Idee. Nur „Hmm, das da“ landete in „Kurz klären“.
  - Das Archiv ist zu, lässt sich aufklappen, und die Suche findet 2 Treffer.
  - Der Vorschlags-Knopf wirkt.
  - Agenda-Titel sind 180–260 px breit (vorher 63–109 px), kein seitliches Scrollen, keine Konsolenfehler.
  - Die Desktop-Ansicht wurde kurz gesichtet.
- Nicht geprüft: echtes iPhone/Safari mit v0.3.1 (bitte erneut ansehen), Supabase und Gemini wie zuvor.

**Bekannte Grenzen:** Die Heuristik bleibt eine Heuristik. Ein Satz wie „Heizungswartungstermin … absprechen“ wird wegen „Termin“ zum Termin ohne Datum. Partizipien am Satzende („bleibt erhalten“) können als To-do vorgeschlagen werden. Alles lässt sich über „…“ korrigieren.

## v0.3.2 – zweite iPhone-Runde (Claude, 25.11.2026)
Weiterhin 0 €, keine neuen Dienste/Konten, keine `.env`. `JF-AI` und `JF Darts` wurden nicht angefasst. Version 0.3.2, Service-Worker-Cache `kompass-shell-v8`.

**1. Eingabezeile unten (mobil ≤ 700 px)**
- `.capture` ist fest unten direkt über der Navigationsleiste: `bottom: calc(var(--nav-h) + env(safe-area-inset-bottom))`, Statuszeile darüber, ＋-Knopf 44×44.
- Desktop bleibt unverändert: Eingabe oben.
- Tastatur (`src/main.js`, `syncKeyboard`): Die Tastaturhöhe wird über `visualViewport` gemessen (`--kb`). Bei offener Tastatur hebt `body.kb-open` die Eingabe genau über die Tastatur und blendet die Reiter aus. Tippt man in ein anderes Feld, wird die Eingabe ausgeblendet (`body.kb-open:not(.dump-focus)`), damit sie nichts verdeckt.
- `main` hat unten genug Abstand, damit nichts hinter Eingabe und Reitern verschwindet.

**2. Kurzfassungen und bereinigte Titel**
- `shortIdea` in `src/domain/sort.js`:
  - entfernt Einleitungen („Mir ist wichtig, dass man …“, „Es wäre schön, wenn …“, „Ich möchte …“) und Modalverben,
  - entfernt den Strangnamen am Ende („… in Alltagskompass“),
  - kürzt auf rund 70 Zeichen mit „…“.
- Neue Ideen bekommen die Kurzfassung direkt beim Sortieren als Titel.
- `displayTitle` in `src/ui.js` gilt für alle Ansichten, auch für bereits gespeicherte Einträge:
  - Ideen: Kurzfassung.
  - Termine/Müll/Dienste: Datum- und Zeitphrasen entfernt („Heute ist um 19:00 Uhr Chorprobe“ → „Chorprobe“; Zeitpunkt steht darüber als „Heute, 19:00“).
  - To-dos: Füllwörter wie „Ich muss …“ entfernt.
- Von Hand geänderte Titel bleiben unverändert: „Titel ändern“ setzt jetzt `title_custom:true`.
- Das vollständige Original bleibt im „⋯“-Menü und im Eingangs-Archiv. Der volle gespeicherte Titel steht im Tooltip (`title`).
- Das Termin-Formular füllt den bereinigten Titel vor.

**3. Ideen & Projekte auf der Startseite**
- Fünfte Kachel „Ideen & Projekte“ mit Zahl der offenen Ideen und dem zuletzt aktiven Strang samt nächstem Handgriff, z. B. „Umbau Wohnzimmer → An dem Durchbruch weiter arbeiten · 1 Strang“. Antippen öffnet „Ideen“.
- `ideasSummary` in `src/views/inbox.js`.
- Mobil volle Breite mit bis zu zwei Zeilen, Desktop fünf Kacheln in einer Reihe.

**4. Ein Menü pro Eintrag, einheitliche Größen**
- Statt ✎ + ⏾ + … gibt es pro Eintrag genau einen „⋯“-Knopf (`entryDetails` / `actionMenu` in `src/ui.js`). Oben stehen die bereichsspezifischen Aktionen, darunter folgen Wiedervorlage, Original, Bereich/Strang (inkl. „＋ Neuer Strang …“) sowie „Titel ändern“ und „Ausblenden“.
  - Termine: „Dieses Mal auslassen (Datum)“ für Rhythmen, Bearbeiten-Formular, „Termin entfernen“ bzw. „Rhythmus beenden“.
  - Anrufe: Wer/Wann/Weshalb-Formular.
  - Stränge: Foto anhängen, Wiedervorlage, Umbenennen, Abschließen.
- Das separate „→ Strang“-Auswahlfeld bei losen Ideen ist entfallen und steckt jetzt im Menü.
- Einheitliche Tap-Größe `--tap`: 44 px auf Touch/iPhone, 36 px am Desktop, für ⋯, ↑, ↓ und ✕. Die Kurz-klären-Knöpfe haben mindestens 36 px.
- Mobil öffnet „⋯“ als Blatt von unten (volle Breite, max. 72 % Höhe, eigener ✕-Knopf). Es ist immer nur ein Menü offen.

**Geprüft**
- `npm test`: 47/47 bestanden. Neu ist `tests/iphone-feedback-2.test.mjs` mit 5 Tests: Kurzfassung, bereinigte Titel inkl. eigener Titel, Ideen-Zusammenfassung, keine ✎/…-Doppelmenüs plus Tap-Größe, Eingabe-Position mit Safe-Area und Tastatur-Regeln. `node --check` ist für alle Dateien fehlerfrei.
- Browser auf Testport 4180:
  - 375×812: Die Eingabe liegt bündig über der Navigation (Unterkante 757 = Oberkante der Navigation). Mit simulierter Tastatur von 300 px sitzt sie genau darüber (Unterkante 512), die Reiter sind ausgeblendet.
  - Agenda: „Heute, 19:00“ über „Chorprobe“, „Fr 27.11., ganztägig“ über „🗑 Gelbe Tonne“, je ein ⋯ mit 44×44.
  - Das Menü öffnet als Blatt von unten.
  - Ideen (390×844): Kurzfassungen, einheitliche ⋯-Knöpfe, kein seitliches Scrollen, keine Konsolenfehler.
  - Desktop 1024 px: Eingabe oben, fünf Kacheln.

**Offen / bitte am echten iPhone prüfen** (nach dem Neuladen; die neue Version kommt über den Service-Worker, notfalls App einmal schließen und neu öffnen)
- Verhalten der Eingabe beim Tippen und Diktieren mit echter Safari-Tastatur. Die `visualViewport`-Berechnung ist nur simuliert getestet. Im Homescreen-Modus und in Safari kann sie sich unterschiedlich verhalten.
- Ob das ⋯-Blatt bei langen Originaltexten angenehm scrollt.
- Die Kurzfassung ist heuristisch. Bei ungewöhnlichen Sätzen kann sie zu knapp oder zu lang sein; dann über „⋯ → Titel ändern“ korrigieren.

---

## v0.4.0 – dritte iPhone-Runde (25.11.2026)

Rahmen: `JF-AI` und `JF Darts` nicht angefasst. Strikt 0 €: kein Dienst aktiviert, nichts angemeldet oder registriert, keine neuen Abhängigkeiten.

### Umgesetzt

1. **Echte Kurzfassung statt Abschneiden** (`summarize` in `src/domain/sort.js`, `shortIdea` ist jetzt ein Alias)
   - Entfernt Füllwörter („tatsächlich“, „gegebenenfalls“, „auf jeden Fall“ …), die Einleitung „Mir ist wichtig, dass man …“, Modalverben, „in dem Programm X“, den eigenen Strangnamen und Begründungen („…, weil/bevor …“).
   - Lange Aufzählungen werden zu „A, B usw.“. Bei zu langen Sätzen bleibt das Verb am Ende erhalten. Es wird nie mehr mit „…“ abgeschnitten.
   - Beispiel: „Mir ist tatsächlich wichtig, dass man auch gegebenenfalls Bilder hinterlegen kann in dem Programm Alltagskompass“ → „Bilder hinterlegen“.
   - Gilt für Ideen und To-dos. `displayTitle` fasst aus dem Originalabschnitt (`details`) zusammen, deshalb werden auch alte, mit „…“ gekürzte Titel repariert.
   - Mit „Titel ändern“ gesetzte Titel (`title_custom`) bleiben unverändert. Das Original ist weiter über ⋯ und im Eingangs-Archiv zu sehen.
2. **Einkaufsliste und eigene Listen**
   - Formulierungen wie „auf die Einkaufsliste (setzen)“ oder „auf den Einkaufszettel“ werden vollständig entfernt: „Zahnpasta von Elmex auf die Einkaufsliste“ → `Zahnpasta von Elmex`. Auch der Titel ist nur noch der Artikel.
   - Neu ist die Entität `list` (Migration `supabase/migrations/003_lists.sql`) mit einem Reiter „Listen“ unter To-dos:
     - Listen anlegen, umbenennen und archivieren.
     - Gegenstände abhaken, „Alle Haken entfernen“ (Packliste wiederverwenden) und „Abgehakte entfernen“.
   - Die freie Eingabe erkennt:
     - „Föhn auf Liste Tasche Alfsee“
     - „Liste Tasche Alfsee: Handtuch, Sonnencreme und Badehose“
     - „Ich muss auf jeden Fall einen Föhn mit zum Alfsee nehmen“
     - „Zum Alfsee die Luftmatratze mitnehmen“
   - Jeweils landet nur der Gegenstand in der passenden Liste; „Alfsee“ findet „Tasche Alfsee“.
   - Ohne passende Liste wird „Packliste <Ziel>“ angelegt.
   - Personen und Termine werden nicht als Gegenstand erkannt („Oma mit zum Arzt nehmen“ bleibt ein To-do).
   - Eine Gemini-Sortierung überschreibt Listeneinträge nicht.
3. **Müllabfuhr**
   - **Kalender-Link (.ics/iCal/webcal)** im Reiter Müll:
     - Abgleich auf Knopfdruck oder automatisch beim Öffnen, höchstens etwa einmal in 20 Stunden.
     - Feed-Termine haben feste IDs aus der iCal-UID. Ein erneuter Abgleich legt nichts doppelt an, verschobene Termine werden aktualisiert, aus dem Feed entfallene künftige Termine ausgeblendet.
     - Termine, die schon als Rhythmus von Hand eingetragen sind, werden übersprungen.
   - Der lokale Server holt den Kalender über `/api/ics` ab. Abgesichert ist das mit Token und gleicher Herkunft, nur öffentliche http(s)-Adressen, maximal 2 MB, 12 s Zeitlimit.
   - Fehler und Ausweichweg:
     - Bei falscher Adresse oder fehlenden iCal-Daten erscheint eine klare Meldung, und bestehende Termine bleiben unverändert.
     - Alternativ kann man eine **.ics-Datei importieren**.
     - Nicht unterstützte Rhythmen (z. B. mehrere Wochentage) werden als Einzeltermine übernommen und gemeldet.
   - **Aufklappbarer Monats-Abfuhrplan** mit ‹ › für den Monatswechsel und „Zum aktuellen Monat“: alle Abholungen chronologisch nach Datum und Tonne, mit Farbpunkt je Tonne.
   - Die Liste oben zeigt pro Tonne nur die nächste Abholung.
4. **Dienstplan**
   - Jedes Foto hat ein ✕ zum Entfernen (mit Rückfrage). Das Foto wird ausgeblendet (`removed:true`, append-only); bereits eingetragene Dienste bleiben.
   - Neues Feld **„Nur Zeilen für“**, Vorgabe `J. Twele`, gespeichert pro Gerät. Leer bedeutet alle Zeilen. Es findet auch „Twele, J.“, „Twele J“ und „Jan Twele“.
   - Die Text-Erkennung versteht Zeilen („02.12. 06:00-14:00 Früh J. Twele“) und **Wochenraster**:
     - Kopfzeile mit den Daten, je Mitarbeitendem eine Zeile mit F/S/N, Uhrzeiten oder frei/U/K.
     - Freie Tage werden übersprungen, und der Name steht nicht im Diensttitel.
   - Die Prüf-Tabelle hat eine Kopfzeile (✓ · Datum · Von · Bis · Bezeichnung), einen Hinweis wie „Nur ‚J. Twele‘: 1 von 3 Zeilen im Wochenraster“ und den Knopf „Alle Zeilen zeigen“. Der eingefügte Text bleibt zum Nachbessern stehen.
   - KI-Auslesung: Gemini wird nur nach dieser Person gefragt. Der Name wird vorher bereinigt, die Antwort zusätzlich gefiltert, und erst nach Bestätigung wird etwas eingetragen.
5. **Navigation und Startseite**
   - Der Reiter heißt jetzt „Start“, die Seite „Überblick“.
   - Die Kacheln führen **direkt in den Unterbereich**, also ein Tipp statt zwei: Nächster Termin, To-dos, Einkauf, Listen, Müll, Ideen & Projekte, Tabletten.
   - Leere Kacheln („Kurz klären“ bei 0, Listen, Müll, Tabletten ohne Bestand) werden ausgeblendet.
   - Das Zwei-Spalten-Raster am iPhone hat keine Lücken, und die vier Reiter-Beschriftungen passen ohne seitliches Scrollen.
   - Am Desktop stehen die vier To-do-Bereiche in einem 2×2-Raster.
6. **Von unterwegs (5G) vorbereitet**
   - `npm run build:static` erzeugt `dist/` für kostenloses statisches Hosting (Cloudflare Pages, Netlify oder GitHub Pages; HTTPS, damit iPhone-Installation und Offline-Betrieb funktionieren).
   - `config.json` enthält nur öffentliche Werte (Supabase-URL und Publishable-Key), keinen Gemini-Key und keinen Server.
   - Die App lädt `./api/config` und weicht sonst auf `./config.json` aus.
   - Mit `KOMPASS_REQUIRE_LOGIN=true` (Standard) bietet die gehostete Version beim Start die Anmeldung an.
   - Der lokale Betrieb ohne Login bleibt unverändert.
   - Anleitung, Tabelle „Wo du dich anmelden musst“ und die Supabase-Empfehlung stehen in `EINRICHTUNG.md` → „Von unterwegs nutzen“.

### Geprüft

- `npm test`: **55/55** bestanden. Neu ist `tests/v040.test.mjs` mit 8 Tests: (a) Kurzfassung, (b) Einkauf und Listen inklusive Operationen, Migration und Zählern, (c) .ics-Import, Abgleich ohne Duplikate, Verschiebung, Monatsplan und Fehler, (d) Foto entfernen, Filter auf J. Twele in Raster, Zeilen und KI-Antwort, außerdem der Hosting-Build. Ein Altertest erwartete noch „…“ und wurde angepasst.
- `node --check` ohne Fehler für alle Dateien in `src/`, `scripts/` und `sw.js`. `npm run build:static` lief erfolgreich (`dist/` danach gelöscht, steht in `.gitignore`).
- Browser auf dem Testport 4180:
  - Bei **375×812** und **390×844** gibt es kein seitliches Scrollen, keine Titel schmaler als 90 px.
  - Startkacheln führen in den richtigen Unterbereich. Listen zeigen „Föhn“ und „Handtuch“ in „Tasche Alfsee“.
  - Müll:
    - Monatswechsel behält den aufgeklappten Plan.
    - .ics-Datei zweimal importiert ergibt „2 neu“, dann „0 neu“.
    - Eine Nicht-iCal-Adresse liefert eine saubere Fehlermeldung.
  - Dienstplan:
    - Fotos hochgeladen und eines entfernt.
    - Raster mit 3 Personen ergibt nur die Twele-Dienste.
  - Desktop 1024 px: 2×2-Raster.
  - Konsole: nur der absichtlich ausgelöste 422 aus dem Fehlertest.

### Offen und am echten iPhone zu prüfen

- App neu laden (Service-Worker-Cache v9), notfalls einmal ganz schließen und wieder öffnen.
- Kurzfassungen an echten, diktierten Sätzen prüfen. Es ist eine lokale Faustregel ohne KI; passt ein Titel nicht, hilft „⋯ → Titel ändern“.
- Den echten Kalender-Link des Entsorgers verbinden. Liefert er keinen Abruf, die .ics-Datei herunterladen und importieren.
- Einen echten Wochenplan als Text oder Foto mit dem Namensfilter testen. Die Schreibweise im Plan muss den Nachnamen enthalten.
- Das ✕ an Fotos ist 32 px groß statt 44 px, damit es das 64-px-Vorschaubild nicht verdeckt. Bitte auf Treffsicherheit prüfen.

### Selbst zu erledigen (Anmeldungen, nichts davon wurde getan)

1. **Supabase:** im **bestehenden** Konto anmelden (keine neue Registrierung) und ein **neues, eigenes Projekt** für den Kompass anlegen, nicht das JF-Darts-Projekt mitbenutzen. Free erlaubt zwei aktive Projekte pro Konto. Danach die Migrationen 001, 002 und 003 ausführen und URL plus Publishable-Key in `.env` eintragen.
2. **Hosting:** Konto bei Cloudflare, Netlify oder GitHub. Das ist eine **Registrierung**, falls noch keins vorhanden ist. Dann `npm run build:static` ausführen und `dist/` hochladen.
3. **In Supabase:** Site- und Redirect-URL auf die Hosting-Adresse setzen. In der App einmal **registrieren**, danach „Allow new users to sign up“ ausschalten.
4. **Daten umziehen:** lokal „Sicherung exportieren“ und unter der neuen Adresse importieren, oder angemeldet „Gastdaten übernehmen“.

---

## v0.5.0 – freie Listen-Erkennung mit KI-Intent-Zerlegung (26.11.2026)

Rahmen: `JF-AI` und `JF Darts` nicht angefasst. 0,00 €: nichts aktiviert, nichts angemeldet. Gemini bleibt optional (Free Tier, bestehendes Tageslimit und 15-Minuten-Pause). Der Dienstplan-Foto-Parser wurde bewusst nicht verändert.

### Probleme aus dem iPhone-Test und Lösung

| Eingabe | Vorher | Jetzt |
|---|---|---|
| „Ich fahre am Wochenende zum Aasee und muss dafür eine Tasche packen. Füge eine Liste hinzu für die Tasche.“ | keine Liste | neue Liste **„Tasche Aasee“**, kein To-do aus den Anweisungssätzen |
| „Füge folgendes zu der Liste Tasche Alfsee Hinzu:\nFöhn\niPad\nHaussocken“ | 4 Teile, „Füge folgendes“ als To-do, 3× „Kurz klären“ | **1 Einheit**: Föhn, iPad und Haussocken in „Tasche Alfsee“, 0× „Kurz klären“ |
| „in die Tasche für den Alfsee muss noch ein Ladekabel“ / „zum Alfsee muss ich auch Unterwäsche mitnehmen“ / „Sonnencreme für Alfsee noch einpacken“ | nicht oder falsch erkannt | `Ladekabel` / `Unterwäsche` / `Sonnencreme` in „Tasche Alfsee“ |
| „Erstelle eine Packliste für den Urlaub (mit Sonnencreme und Badehose)“ | – | neue Liste „Packliste Urlaub“, optional gleich mit den Gegenständen |

### Aufbau

- **`src/domain/intent.js`** (neu) ist der gemeinsame Kern für den lokalen Fallback und die KI-Validierung.
  - `findList`/`similar`: unscharfer Abgleich mit den vorhandenen Listen.
    - Toleriert Beugung („Alfsees“), kleine Tippfehler und Wortreihenfolge.
    - „Aasee“ wird ausdrücklich **nicht** zu „Alfsee“.
    - Allgemeine Wörter (Tasche, Liste) entscheiden nur, wenn genau eine Liste passt.
  - `detectListIntent`: erkennt
    - Doppelpunkt-Köpfe,
    - „zu der Liste X hinzu“ und „X auf Liste Y“,
    - „Liste für die Tasche“ und „Packliste für den Urlaub“,
    - „neue Liste X“,
    - Kopfzeilen ohne das Wort „Liste“,
    - Pack-Formulierungen (mitnehmen, einpacken, „in die Tasche …“).
    Übrig bleibt nur der reine Gegenstand, ohne Artikel, Füllwörter, Ziel und Zeitangaben.
  - `groupListIntents`: fasst Kopfzeile und folgende Kurzzeilen zu **einem** Abschnitt zusammen. Ziel und Liste aus früheren Sätzen gelten als Kontext („zum Aasee …“ + „Liste für die Tasche“ = „Tasche Aasee“). Die Abschnitte bleiben lückenlos, das Original wird also weiter vollständig abgedeckt.
  - Personen und Termin-Ziele werden ausgeschlossen („Oma mit zum Arzt nehmen“ bleibt ein To-do).
  - Die Einkaufsliste ist ein gültiges Ziel: „Einkaufsliste:\nMilch\nBrot“ landet im Einkauf.
- **Intent-Vertrag** pro Abschnitt: `{index, kind, minutes, energy, project, uncertain, position, action: none|create_list|add_to_list, list_name, items[]}`.
- **`/api/parse`** (neu; `/api/sort` bleibt als Alias): Der Browser schickt den Text plus die **aktuellen Listen- und Projektnamen** mit. Der Server bereinigt die Namen (`cleanNames`: nur Strings, max. 200 × 80 Zeichen, ohne `<>`) und gibt sie Gemini als Daten mit, samt „Einkaufsliste“.
- **Strikte Validierung** (`validateSuggestions(rows, parts, {lists, text})`, im Server **und** erneut im Browser):
  - Eine unbekannte `action` verwirft die ganze KI-Antwort und führt zum lokalen Ergebnis.
  - `list_name` wird zuerst einer vorhandenen Liste zugeordnet, auch unscharf („Alfsee Tasche“ → „Tasche Alfsee“). Neue Listennamen sind nur erlaubt, wenn ihre Wörter im Text vorkommen.
  - `items` müssen wörtlich im Abschnitt stehen; erfundene Gegenstände werden verworfen.
  - Ist der KI-Vorschlag ungültig, gilt das lokale Ergebnis.
- **Lokaler Fallback** (offline, kein Key, Tageslimit, Pause, Fehler): dieselbe Zerlegung mit demselben Kontext, also dieselben Abschnitte.
- **Operationen** (`sortingOperations`):
  - `create_list` ohne Gegenstände legt nur die Liste an (`list`-Operation mit stabiler ID) und erzeugt kein To-do.
  - Die Aufnahme bekommt `linked_lists`. Dadurch gilt sie als sortiert, wird nicht doppelt verarbeitet und zeigt im Eingangs-Archiv einen Link „☰ Tasche Aasee“.
  - Gegenstände werden je Abschnitt als ein Eintrag mit `items[]` und `list_id` gespeichert.
- **Oberfläche:**
  - Die Statuszeile nennt das Ziel („→ „Tasche Alfsee““ bzw. „Liste „Packliste Urlaub“ bereit“).
  - Link-Chips im Eingangs-Archiv öffnen direkt die richtige Liste.
- Kleinere Änderungen:
  - Befehlswörter („Füge … hinzu“) landen nicht mehr in Einkaufsartikeln.
  - `iPad` behält seine Schreibweise.
  - Version 0.5.0, Service-Worker-Cache v10 (`intent.js` im Offline-Paket).

### Geprüft

- `npm test`: **60/60** bestanden. Neu ist `tests/v050.test.mjs` mit 5 Tests:
  1. Liste „Tasche Aasee“ anlegen, ohne To-do, ohne Kurz klären, wiederholbar ohne Duplikate.
  2. Mehrzeiliger Block mit 3 Einträgen in „Tasche Alfsee“, dazu Komma-Variante, Kopf ohne „Liste“ und Einkaufsblock.
  3. Freie Varianten (Ladekabel, Unterwäsche, Sonnencreme, Föhn, Luftmatratze) sowie Alltagssätze, die keine Liste werden dürfen.
  4. KI-Pfad (4a): Kontext im Prompt, freie Formulierung „gehört zu den Alfsee-Sachen“, erneute Prüfung im Browser, `create_list` mit Ort aus dem Vorsatz.
  5. Strikte Prüfung und Fallback (4b): erfundener Gegenstand, erfundener Listenname, unscharfer KI-Name, ungültige Aktion, kein Key und Tageslimit; Namen bereinigt, Route vorhanden.
- `node --check` ohne Fehler für alle Dateien in `src/`, `scripts/` und `sw.js`.
- Browser auf dem Testport 4180, 375 px, lokaler Pfad:
  - Beide iPhone-Eingaben wörtlich eingegeben: „Tasche Aasee“ wurde angelegt; Föhn, iPad, Haussocken, Unterwäsche, Ladekabel und Sonnencreme stehen in „Tasche Alfsee“.
  - Der Zähler „Kurz klären“ ist unverändert.
  - „Erstelle eine Packliste für den Urlaub“ legt die Liste an.
  - Kein seitliches Scrollen.

### Offen

- **Echter Gemini-Aufruf** ist ungetestet, weil kein Key eingerichtet ist. Der KI-Pfad ist mit simulierten Antworten getestet. Ohne Key läuft immer der lokale Fallback.
- In der gehosteten Version (statisches Hosting) gibt es keinen Server, dort gilt immer der lokale Fallback.
- **Am echten iPhone prüfen** (App neu laden, Cache v10): diktierte Varianten. Die lokale Erkennung braucht für freie Pack-Sätze ein Signal wie mitnehmen, einpacken, packen oder „in die Tasche“ und erkennt Gegenstände über die Großschreibung, die die iOS-Diktierfunktion normalerweise liefert.
- Grenzen des lokalen Fallbacks: Ein Ziel aus zwei Wörtern („nach Den Haag“) wird als ein Wort gelesen. Sätze ohne Pack-Signal („Das Ladekabel gehört zu den Alfsee-Sachen“) erkennt nur der KI-Pfad.
- Bereits falsch zerlegte Einträge aus dem letzten Test (z. B. „Füge folgendes“ als To-do) bleiben bestehen. Bitte einmal von Hand ausblenden, die Originale bleiben dabei erhalten.

---

## v0.6.0 – eigener Gemini-Key im Konto (26.11.2026)

Rahmen: `JF-AI` und `JF Darts` nicht angefasst. 0,00 €: nichts aktiviert, nichts angemeldet, kein echter Key verwendet. Kein Key in `config.json`, `.env.example` oder in Quelldateien.

### Was neu ist

- **Eingabefeld** unter ⚙ → „KI-Sortierung (optional)“: Key eingeben, „Key speichern“, „Key entfernen“.
  - Statuszeile: „Aktiv · Key AIza…1234 im Konto gespeichert“ / „nur auf diesem Gerät (Gastmodus)“ / „Aus · es wird lokal sortiert“.
  - Format wird geprüft (30–80 Zeichen, `A–Z a–z 0–9 _ -`). Danach eine kurze Prüfung bei Google (nur Modell-Metadaten, kein Inhalt, zählt nicht zum Tageslimit). Lehnt Google den Key ab, wird er nicht behalten.
  - Hinweis auf AI Studio, Projekt ohne Abrechnung (0 €), Datennutzung im Free Tier und die Limits.
- **Speicherort** (`src/data/ai-key.js`, `AiKeyStore`):
  - **Angemeldet:** Supabase-Tabelle `kompass_user_settings` (eine Zeile pro Konto, RLS: nur das eigene Konto liest und ändert). Kopie pro Konto im Gerät für den Offline-Start (`kompass.gemini:<supabase-url>:<user-id>`). Beim Start und beim Zurückholen der App (höchstens alle 10 Minuten) wird der Kontowert neu geladen. So ist ein am PC gespeicherter Key nach dem Login auf dem iPhone automatisch da.
  - **Nicht angemeldet:** nur `localStorage` (`kompass.gemini:guest`).
  - Ein Gast-Key wird nach dem Login **nicht** still hochgeladen. Der Knopf „Ins Konto übernehmen“ macht das auf Wunsch.
  - **Abmelden** löscht die Gerätekopie; der Key bleibt im Konto.
  - Bewusst nicht im Operationslog `kompass_ops` (unveränderlich, alte Keys blieben für immer) und nicht in `kompass.settings` oder der Sicherungsdatei.
- **Neue Migration** `supabase/migrations/004_user_settings.sql`. Fehlt die Tabelle, zeigt die App einen klaren Hinweis und nutzt die Gerätekopie weiter.
- **KI-Aufruf direkt aus dem Browser** (`src/data/gemini.js`, gemeinsamer Kern; `scripts/gemini.mjs` ist nur noch die Server-Hülle mit Token):
  - Gleicher Intent-Vertrag, gleiche strenge Prüfung (`validateSuggestions`), gleiche Abschnitte wie der lokale Fallback (inkl. Personen).
  - Funktioniert dadurch auch in der gehosteten Version ohne Server.
  - Limits: 100 Aufrufe pro Tag und Gerät, 15 Minuten Pause nach Fehlern oder 429. Der Zähler übersteht Neuladen (`kompass.ai.budget`).
  - Key nur im Header `x-goog-api-key`, nie in der URL.
  - Auch das Dienstplan-Foto-Auslesen nutzt den eigenen Key (Parser selbst unverändert; Ergebnis wird weiterhin erst zur Prüfung angezeigt).
- **Aktivierung:** Eigener Key vorhanden → KI-Sortierung automatisch aktiv („KI an“ oben). Kein Key → lokale Sortierung wie bisher. Der Server-Key aus `.env` funktioniert weiter wie bisher (Zustimmung pro Sitzung) und wird nur genutzt, wenn kein eigener Key gesetzt ist.
- Version 0.6.0, Service-Worker-Cache v11 (`ai-key.js`, `gemini.js` im Offline-Paket).

### Geprüft

- `npm test`: **65/65** bestanden. Neu ist `tests/v060.test.mjs` mit 5 Tests:
  1. Key im Konto, zweites Gerät bekommt ihn nach dem Login, anderes Konto sieht nichts, Ersetzen, Entfernen, Abmelden.
  2. Gastmodus nur lokal; Übernahme ins Konto nur auf Knopfdruck.
  3. Ungültiger Key, fehlende Tabelle (Hinweis auf 004), offline.
  4. Browser-KI-Pfad mit Kontext, Tageslimit über Neuladen hinweg, ohne Key kein Aufruf, Key-Prüfung.
  5. Kein Key in `config.json`/`/api/config`, Operationslog oder Quelldateien; RLS in 004.
- Browser (Testport 4180, 375 px, Gastmodus, Google-Aufrufe im Test simuliert):
  - Ungültige Eingabe wird abgelehnt.
  - Test-Key gespeichert → „KI an“, Key nur in `kompass.gemini:guest`.
  - Ein Satz ohne Pack-Signal landet „mit Gemini“ in „Tasche Alfsee“, mit Listen-Kontext im Aufruf.
  - Key entfernt → wieder lokal, kein weiterer Aufruf.
  - Kein seitliches Scrollen.

### Offen / für Jan

- **Supabase:** einmal `004_user_settings.sql` im SQL-Editor des Kompass-Projekts ausführen (dafür im Supabase-Dashboard **anmelden**). Ohne die Tabelle wird der Key nicht im Konto gespeichert.
- **Gemini-Key:** in Google AI Studio mit einem Google-Konto **anmelden** und einen Key in einem Projekt **ohne Abrechnung** erstellen. Dann in der App angemeldet unter ⚙ eintragen.
- Echter Gemini-Aufruf und echtes iPhone noch ungetestet (keine echten Keys/Zugänge in dieser Sitzung).
- Sicherheitsabwägung: Der Key liegt im Browser (localStorage) und in der eigenen Supabase-Zeile im Klartext (Supabase verschlüsselt die Datenbank auf dem Datenträger). Die App lädt keine fremden Skripte. Ein Free-Tier-Key ohne Abrechnung kann keine Kosten verursachen; bei Verdacht in AI Studio löschen und neu erstellen.

## Audit 26.11.2026 – Ursache nachgewiesen
Aktueller Projektordner ohne .git; separater öffentlicher Repository-Checkout unter work/alltags-kompass-publish. Live: src/main.js veraltet (kein Key-Feld), src/data/ai-key.js 404; sw.js v11 und index/config identisch zum lokalen dist. Pages-Workflow auf main Commit 029ec8f erfolgreich. Ursache: unvollständiger/mischversioniger Upload, nicht allein Browsercache. Lokales v0.6.0 enthält Key-Feld unabhängig von aiEnabled. Alte Stopp-Regel wird durch aktuellen Auftrag zur eigenständigen vollständigen Fehlerklärung ersetzt; technische Lese-/Werkzeugfehler werden dokumentiert und soweit reversibel behoben. Keine Secrets ausgegeben. Nächster Schritt: Key-Speichern/Synchronisierung absichern, Tests, vollständigen Build prüfen und Veröffentlichung abgleichen.

## Audit / Build abgeschlossen – Veröffentlichung vorbereitet (26.11.2026)
68/68 Tests bestehen; Syntaxchecks erfolgreich. Ein alter Test suchte pauschal das Wort geminiKey im Build-Skript und schlug deshalb auf den neuen Leak-Scanner an. Der Test prüft jetzt gezielt das ausgegebene öffentliche Konfigurationsobjekt; der Build prüft zusätzlich die tatsächlichen Dateien gegen den echten Key (nur im Speicher, keine Ausgabe) und das Gemini-Key-Muster. Kein Secret gefunden. Build-ID: 7054782c3739488a. BUILD-VERGLEICH.json enthält die vollständige bytegenaue Dateiliste vor/nach Build und gegenüber GitHub.
Geändert: src/main.js (Key vor Speichern prüfen; online Kontowert nachladen), src/data/ai-key.js (Race-Schutz nach Logout/Save; klare Offline-Meldung), sw.js v12, scripts/build-static.mjs (Manifest/Secret-/Shell-Prüfung), supabase/migrations/004_user_settings.sql (wiederholbar/Transaktion), tests/v040.test.mjs und tests/release060.test.mjs, EINRICHTUNG.md.
Pages-Konfiguration per authentifizierter GitHub-API geprüft: main /root, legacy branch deployment. Lokaler Projektordner ist kein Git-Checkout; Veröffentlichung wird über isolierten Checkout work/alltags-kompass-publish vorbereitet, dessen Remote Jacksnfraps/alltags-kompass ist. GitHub-Anmeldung als Jacksnfraps verfügbar. Neben vollständigem dist werden Build-Skripte, Tests und SQL-Migrationen als reproduzierbare Quellen aufgenommen; .env nie kopieren.
Lokale .env: Gemini-Key vorhanden, GEMINI_FREE_TIER_CONFIRMED=false. Deshalb kein echter Google-Aufruf und keine Änderung dieser bewussten Kostenfreigabe. Anonymer Supabase-Tabellencheck liefert 401 (keine Daten abgefragt); kein Beweis für authentifizierte Migration/RLS. Live-Supabase-Zweigeräteprüfung bleibt offen, bis Nutzer mit eigenem Konto prüft.

Build nach Git-Zeilenendungsprüfung final neu erstellt: 038c090c1a5308a6. Textdateien im dist deterministisch LF-normalisiert, .gitattributes ergänzt; damit stimmen Manifest-Hashes auch nach Git-Upload. Vorherige Build-ID 7054782c3739488a ist überholt. Vollständige Dateiliste in BUILD-VERGLEICH.json aktualisiert.

## Abschluss Live-Veröffentlichung – 26.11.2026
Release-Commit 1a917e70073a27528e95185c54015228f92c3d9f auf origin/main gepusht. Pages-Workflow 45738768307 erfolgreich abgeschlossen. Live https://jacksnfraps.github.io/alltags-kompass/ liefert Build-ID 038c090c1a5308a6; ALLE 35 Manifest-Dateien per HTTP/SHA-256 gegen dist geprüft, keine Abweichung. Neues Eingabefeld unter KI-Sortierung im Browser auf der echten Live-URL sichtbar, ungültige Eingabe wird lokal abgelehnt, Testfeld danach geleert. Keine Anmeldung und kein echter Key im Browser verwendet. Git-Checkout nach Release sauber. 68 Tests auch im veröffentlichten Checkout bestanden.
Zusätzliche Nachweise: LIVE-PRUEFUNG.json und BUILD-VERGLEICH.json. Release-Bericht: RELEASE-PRUEFUNG.md.

Offen: Migration 004 im angemeldeten Supabase-Projekt ausführen/prüfen (RLS mit zwei echten Konten ungetestet). Danach Key bei bestätigtem Free-Projekt im angemeldeten App-Konto speichern und auf iPhone mit gleichem Konto neu laden. Die Code-/Stub-Tests bestätigen den Geräteablauf, ersetzen aber keinen echten Zwei-Geräte-Test. Gemini-Metadaten-/Generierungsaufruf und echte Foto-Auslesung bleiben ungetestet, weil GEMINI_FREE_TIER_CONFIRMED=false in .env gesetzt ist. Dies nicht ohne Prüfung des Billing-Status ändern. Es wurden keine kostenpflichtigen Dienste aktiviert, keine Keys veröffentlicht und keine Datenbankinhalte verändert.
Nächster Schritt für Claude/Nutzer: veröffentlichte App neu laden, vollständige 004-SQL im bestehenden Supabase-Projekt ausführen, angemeldet Key speichern, Testtext und nicht privaten Dienstplan testen. GitHub-Upload ist bereits erledigt. Browser-/iPhone-Cache NICHT durch Löschen aller Website-Daten leeren, solange ungesendete Offline-Daten vorhanden sind.
