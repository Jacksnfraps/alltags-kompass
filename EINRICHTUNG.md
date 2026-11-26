# Kompass starten und optional synchronisieren

## Lokal starten

Doppelklick auf START-KOMPASS.cmd. Node.js ab Version 20 muss installiert sein. Die angezeigte localhost-Adresse ist für den PC, die LAN-Adresse für das iPhone im selben WLAN. Den Server nach Änderungen neu starten. Falls eine alte Offline-Version erscheint: alle Kompass-Tabs schließen und neu öffnen, keine Browserdaten löschen.

Ohne Zugangsdaten arbeitet die App im Gastmodus. Neue Gedanken werden vollständig in IndexedDB gespeichert. Der frühere localStorage-Bestand wird einmalig übernommen; die alte Kopie bleibt erhalten. Gastdaten sind nicht zwischen Geräten synchronisiert. Export sichert die Daten des gerade geöffneten Kontos/Gastmodus als JSON. Unter ⚙ Einstellungen → „Sicherung importieren“ lässt sich eine solche Datei wieder einspielen; es werden nur fehlende Einträge ergänzt, nichts überschrieben.

## Supabase verbinden

1. Ein Supabase-Projekt im Free-Tarif ohne kostenpflichtige Zusatzdienste verwenden. In dieser Arbeit wurde kein Konto angelegt und kein Tarif aktiviert.
2. Im SQL-Editor einmal zuerst `supabase/migrations/001_initial.sql`, danach `002_offline_operations.sql` ausführen. Bereits erfolgreich ausgeführte Migrationen nicht nochmals ausführen. Die App nutzt `kompass_ops`; die Tabellen aus 001 bleiben erhalten.
3. `.env.example` im Projektordner kopieren und die Kopie `.env` nennen. SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY eintragen. Nur Publishable-/anon-Key verwenden, niemals Service-Role-Key. Server neu starten.
4. Im Supabase-Auth-Bereich E-Mail/Passwort-Registrierung und passende Site-/Redirect-URL für die eigene Installation konfigurieren. Bei aktivierter E-Mail-Bestätigung die erhaltene E-Mail bestätigen und danach in der App anmelden.
5. In der App „Konto & Synchronisierung“ öffnen, registrieren/anmelden. Anmeldung benötigt Internet. Eine bereits bestehende Sitzung kann lokal offline weiterarbeiten; nach abgelaufener Sitzung kann eine erneute Anmeldung nötig sein.
6. Gastgedanken werden nicht automatisch hochgeladen. „Gastdaten übernehmen“ kopiert sie nach ausdrücklicher Bestätigung in das angemeldete Konto. Die Gastkopie bleibt erhalten.

## Offline und Kontowechsel

Jeder angemeldete Nutzer erhält einen eigenen lokalen Speicher pro Supabase-Projekt. Alle Änderungen landen zuerst in der lokalen Warteschlange. Bei Verbindung erfolgt der Upload automatisch; Realtime signalisiert neue Cloud-Daten, zusätzlich erfolgt bei sichtbarer App alle 30 Sekunden ein Abgleich. „Jetzt synchronisieren“ stößt ihn manuell an. Bei Cloud-Fehlern bleiben Einträge in der Warteschlange. Abmelden entfernt die Sitzung, nicht die ungesendeten Kontodaten. Auf gemeinsam genutzten Geräten können lokale Daten durch Personen mit Browserprofil-Zugriff eingesehen werden; der Offline-Speicher ist nicht verschlüsselt.

Die vollständige Offline-App benötigt HTTPS oder localhost und einen ersten erfolgreichen Online-Aufruf. LAN-HTTP auf dem iPhone unterstützt das lokale Speichern einer geöffneten Seite, aber keine Service-Worker-Offline-Installation. Verschiedene URLs/Ports haben getrennte Browser-Speicher; für den gewohnten lokalen Bestand dieselbe Adresse verwenden.

## Prüfung vor echtem Einsatz

Mit zwei Testkonten RLS und private Bilder prüfen, dann mit demselben Konto auf zwei Geräten Online-/Offline-Sync testen. Diese Live-Tests sind ohne eingerichtetes Projekt offen. Die SQL-Migration schützt Operationen per owner_id und ist append-only. Konflikte beim selben Feld folgen der Serverreihenfolge; Operationen bleiben im Verlauf erhalten. Ein späteres Lösch-/Retention-Konzept steht noch aus.

Gemini ist optional: Ohne Key sortiert die App immer lokal. Mit `GEMINI_API_KEY`, `GEMINI_FREE_TIER_CONFIRMED=true` (nur Projekt ohne Billing) und Zustimmung unter ⚙ Einstellungen (gilt pro Sitzung) werden Texte bzw. Dienstplan-Fotos an Gemini gesendet. `GEMINI_DAILY_LIMIT` (Standard 100) begrenzt die Aufrufe pro Tag; nach Fehlern/429 pausiert die KI 15 Minuten und es wird lokal weitergearbeitet. Dienstplan-Ergebnisse werden immer erst zur Bestätigung angezeigt. Keine kostenpflichtigen Upgrades oder Billing aktivieren. Free-Tier-Grenzen vor Einrichtung beim Anbieter prüfen.

## Getrennte Testumgebung

`npm run test:server` startet eine zweite Instanz auf Port 4180. Weil Browser-Speicher pro Adresse/Port getrennt ist, berühren Tests dort die gewohnten Daten unter Port 4173 nicht. `npm test` führt die automatisierten Tests aus.

## Personen

Unter ⚙ Einstellungen → Personen lassen sich der Name der Partnerin und die Namen der Kinder hinterlegen. Sie werden nur auf diesem Gerät gespeichert und dienen der automatischen Zuordnung von Terminen (farbige Markierung I/V/K/F).

## Von unterwegs nutzen (mobile Daten / 5G) – Stand v0.4.0

Ziel: Die App läuft auch dann, wenn der Laptop aus ist. Dafür wird die App als **statische Seite kostenlos gehostet** (HTTPS, damit iPhone-Installation und Offline-Betrieb funktionieren) und die Daten über **Supabase Free** zwischen Geräten abgeglichen. Login per E-Mail/Passwort schützt die Daten (Row Level Security, jede Person sieht nur ihre eigenen Operationen). Der lokale Betrieb ohne Login (`START-KOMPASS.cmd`, Gastmodus) bleibt unverändert.

### Wo du dich anmelden oder registrieren musst

| Schritt | Anmeldung nötig? | Kosten |
|---|---|---|
| Lokal im WLAN (wie bisher) | **Nein** | 0 € |
| Supabase-Projekt anlegen | **Anmelden** im bestehenden Supabase-Konto (JF-Darts) – **keine neue Registrierung** | 0 € (Free) |
| Hosting der App | **Registrierung**, falls noch kein Konto bei GitHub, Cloudflare oder Netlify vorhanden ist | 0 € (Free) |
| In der App selbst | **Einmal registrieren** (eigene E-Mail + Passwort) im eigenen Supabase-Projekt, danach nur anmelden | 0 € |
| Gemini (optional) | **Anmelden** mit einem Google-Konto in Google AI Studio, um einen API-Key zu erstellen – nur wenn gewünscht. Projekt **ohne** Abrechnung/Kreditkarte | 0 € (Free Tier) |

Es wurde in dieser Arbeit **nichts angemeldet, registriert oder aktiviert**.

### Bestehendes Supabase-Konto (JF-Darts) mitverwenden?

Empfehlung: **dasselbe Konto, aber ein eigenes, neues Projekt** (z. B. „alltags-kompass“). Nicht die Datenbank von JF-Darts mitbenutzen.

- **Eigenes Projekt ist sauberer:** eigene Datenbank, eigene Nutzerkonten (Auth), eigene Schlüssel und Speicher-Buckets. Ein Fehler oder eine Migration im Kompass kann JF-Darts nicht beeinflussen, und umgekehrt.
- **Mitbenutzung des JF-Darts-Projekts** wäre technisch möglich (Tabellen heißen `kompass_ops`, Bucket `kompass-photos`), hätte aber gemeinsame Nutzerkonten, gemeinsame Free-Limits (500 MB Datenbank, 1 GB Speicher) und das Risiko, JF-Darts zu verändern. **Nicht empfohlen.**
- **Free-Grenze:** Supabase erlaubt pro Konto **zwei aktive Gratis-Projekte** (über alle Organisationen, in denen du Owner/Admin bist). Wenn JF-Darts eines belegt, ist das zweite für den Kompass frei. Sind schon zwei aktiv, bitte vorher Bescheid geben – dann besprechen wir eine Alternative (z. B. pausiertes Projekt), nichts wird ohne deine Freigabe geändert.
- **Pausieren:** Gratis-Projekte pausieren nach etwa einer Woche ohne Aktivität (Ankündigung per E-Mail, Daten bleiben erhalten, Wiederherstellung im Dashboard). Bei täglicher Nutzung passiert das nicht. Die App arbeitet währenddessen lokal weiter und gleicht später ab.

### Schritt für Schritt

1. **Supabase:** Im bestehenden Konto „New project“ (Free, Region z. B. Frankfurt) anlegen. Im SQL-Editor nacheinander `001_initial.sql`, `002_offline_operations.sql`, `003_lists.sql` und `004_user_settings.sql` ausführen (003: eigene Listen, v0.4.0; 004: Kontoeinstellungen für den eigenen Gemini-Key, v0.6.0; bei einem bereits eingerichteten Projekt nur die fehlenden ausführen).
2. Unter *Project Settings → API* die Projekt-URL und den **Publishable/anon key** kopieren (niemals den Service-Role-/Secret-Key) und in `.env` als `SUPABASE_URL` und `SUPABASE_PUBLISHABLE_KEY` eintragen.
3. `npm run build:static` ausführen. Es entsteht der Ordner `dist/` mit `config.json` (enthält nur öffentliche Werte, keine Geheimnisse, keinen Gemini-Key).
4. **Hosting (eine Variante wählen):**
   - *Cloudflare Pages* oder *Netlify*: neues Projekt → „Direct Upload“/„Deploy manually“ → Ordner `dist` hochladen. Du erhältst eine HTTPS-Adresse.
   - *GitHub Pages*: Repository anlegen, Inhalt von `dist/` hochladen, unter *Settings → Pages* veröffentlichen.
   Falls JF-Darts bereits bei einem dieser Anbieter läuft, dasselbe Konto nutzen, aber eine **neue, getrennte Seite** anlegen.
5. **Supabase Auth:** *Authentication → URL Configuration*: „Site URL“ und „Redirect URLs“ auf die neue HTTPS-Adresse setzen. E-Mail-Bestätigung eingeschaltet lassen.
6. App über die HTTPS-Adresse öffnen → ⚙ → **Registrieren**, Bestätigungs-E-Mail öffnen, anmelden. Danach in Supabase unter *Authentication → Sign In / Providers* **„Allow new users to sign up“ ausschalten**, damit sich niemand anderes registrieren kann.
7. iPhone: Adresse in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Jetzt funktioniert die App über WLAN und mobile Daten, auch offline (Abgleich später).

### Wichtig zu wissen

- **Getrennte Gerätespeicher:** Die Gastdaten unter der LAN-Adresse (`http://192.168…:4173`) und die Daten unter der neuen HTTPS-Adresse sind getrennte Browser-Speicher. Zum Umzug einmal lokal ⚙ → „Sicherung exportieren“, unter der neuen Adresse „Sicherung importieren“ – oder lokal anmelden und „Gastdaten übernehmen“.
- **KI in der gehosteten Version (ab v0.6.0):** Ohne Key sortiert die App lokal. Mit eigenem Key unter ⚙ → „KI-Sortierung (optional)“ ruft die App Gemini direkt aus dem Browser auf (Free Tier, max. 100 Aufrufe pro Tag und Gerät, 15 Minuten Pause nach Fehlern). Angemeldet liegt der Key in den Kontoeinstellungen (Supabase-Tabelle `kompass_user_settings`, nur das eigene Konto kann ihn lesen) und ist nach dem Login auf allen Geräten da. Ohne Anmeldung bleibt er nur in diesem Browser. Der Key steht nie in `config.json`, `.env`-Vorlagen oder im Repository.
  - Key holen: aistudio.google.com → „Get API key“ → Key in einem Projekt **ohne** Abrechnung erstellen. Keine Kreditkarte hinterlegen, kein Upgrade.
  - Hinweis: Im Free Tier kann Google gesendete Inhalte zur Produktverbesserung nutzen.
- **Müll-Kalender (.ics):** Am lokalen Server holt `/api/ics` den Kalender ab. In der gehosteten Version versucht die App den direkten Abruf; blockiert der Entsorger das (CORS), die `.ics`-Datei herunterladen und über „.ics-Datei importieren“ einlesen.
- **Updates:** Nach Änderungen erneut `npm run build:static` und den neuen `dist`-Ordner hochladen.

## Veröffentlichung v0.6.0 – geprüft am 26.11.2026

Die öffentliche Seite verwendet **Branch main, Ordner / (root)**. Daher gehört der **gesamte Inhalt von dist**, einschließlich src/data und .nojekyll, in die Repository-Wurzel. Nur einzelne Dateien hochzuladen ergibt einen Mischstand. Ein Ordner dist in der Repository-Wurzel allein wird bei dieser Pages-Einstellung nicht veröffentlicht.

PowerShell ohne Änderung der ExecutionPolicy:

```powershell
npm.cmd test
npm.cmd run build:static
```

Der Build prüft seine Dateien auf echte Gemini-Schlüssel, die Vollständigkeit der Offline-Shell und erzeugt build-info.json mit Version, Build-ID und SHA-256-Prüfsummen. Auf GitHub Pages muss build-info.json dieselbe Build-ID liefern wie lokal. _headers ist für andere Hoster; GitHub Pages wertet diese Datei nicht als Cache-Regel aus.

### Supabase und Geräte

Im bestehenden Kompass-Projekt den vollständigen Inhalt von supabase/migrations/004_user_settings.sql einmal im SQL-Editor ausführen. Die aktualisierte Migration kann bei Unklarheit nochmals laufen: sie erhält Daten, erneuert nur die vier eigenen RLS-Policies und läuft in einer Transaktion. **Keinen Gemini-Key in SQL eintragen.** Keine neue Supabase-Instanz und keine Wiederholung von 001–003 erforderlich, wenn diese bereits erfolgreich liefen.

Danach auf der veröffentlichten Seite am PC als das gewünschte Konto anmelden, ⚙ → KI-Sortierung → eigenen Key speichern. Erst die Bestätigung „im Konto gespeichert“ belegt den Cloud-Speichervorgang. Ein Key ausschließlich in der lokalen .env wird absichtlich NICHT nach Supabase oder ins Hosting kopiert. Auf dem iPhone dieselbe HTTPS-Seite mit demselben Supabase-Konto öffnen und neu laden: der Kontowert wird beim Start geladen, eine zweite Eingabe entfällt bei erreichbarer Tabelle und erfolgreichem Login. Andere Nutzerkonten sehen ihn nicht. Bei Offline-Start wird nur eine bereits vorhandene kontogetrennte Gerätekopie genutzt; Abmelden entfernt diese Kopie, nicht den Cloud-Wert. Es gibt keine automatische Warteschlange für das Speichern eines API-Keys: offline bitte später erneut speichern.

### Echten KI-Aufruf verifizieren

Zuerst in Google AI Studio sicherstellen, dass das Projekt OHNE Billing läuft. Lokaler Server: GEMINI_FREE_TIER_CONFIRMED=true erst nach dieser Prüfung setzen und START-KOMPASS.cmd neu starten; für den Server-Key die Sitzungszustimmung in den Einstellungen aktivieren. Gehostet: eigener Kontokey wird unabhängig von .env benutzt. Das Kennzeichen „KI an“ bedeutet nur konfiguriert, nicht bereits erfolgreich aufgerufen.

Einen unkritischen Test wie „Milch kaufen“ sichern und auf die Meldung „mit Gemini“ achten; ein lokales Ergebnis ist kein erfolgreicher KI-Nachweis. Im Browser-Netzwerkprotokoll muss generateContent HTTP 200 liefern (Header/Key nicht teilen). Danach einen nicht privaten Test-Dienstplan fotografieren, auslesen und die Vorschau vor Übernahme prüfen. 429/Timeout/ungültige Antwort: lokaler Fallback; 15 Minuten Pause, 100 Aufrufe pro Tag/Gerät. Diese Grenzen sind keine globale Kontosperre über alle Geräte. Der API-Key ist im eigenen Browser und in der RLS-geschützten Supabase-Zeile lesbar, nicht zusätzlich clientseitig verschlüsselt.
