# Datei-Übersicht LuxStage

Mini-Doku aller relevanten Dateien im Projekt. Zweck: schnelles Verständnis für Entwickler und KI-Tools.

**Wichtig:** Diese Datei wird bei jeder relevanten Codeänderung mitgepflegt (siehe Regel in `CLAUDE.md`). Neue Dateien ergänzen, gelöschte entfernen, Beschreibung bei Funktionsänderung aktualisieren.

## Root / Infrastruktur

| Datei | Beschreibung |
|---|---|
| `./docker-compose.saas.server.yml` | SaaS-Docker-Compose für geteilten Server; kein Port-Mapping, Ressourcen-Limits. |
| `./docker-compose.saas.yml` | SaaS-Docker-Compose mit Caddy-Netzwerk. |
| `./docker-compose.yml` | Self-Hosted Docker-Compose; Port 3030:3000, Data-Volume. |
| `./Dockerfile` | Multi-Stage Build für Self-Hosted; baut Web-App, entfernt SaaS-Module. |
| `./Dockerfile.saas` | Multi-Stage Build für SaaS-Image (baut Web-App, Module separat). |
| `./entrypoint.sh` | Self-Hosted-Startskript; Bootstrap-Nutzer falls `.bootstrap-done` fehlt. |
| `./entrypoint.saas.sh` | SaaS-Startskript; lädt Server ohne Bootstrap. |
| `./install.sh` | Bash-Installer für Bare-Metal; richtet nvm, PM2, Caddy und Benutzer ein; übergibt Bootstrap-Secrets nur über kurzlebige, restriktiv berechtigte Umgebungsdatei. |
| `./README.md` | Projekt-Übersicht, Features und Installation (Bare-Metal/Docker) mit E-Mail-basiertem Admin-Login. |
| `./DEV-SERVER.md` | Anleitung für lokalen Dev-Server: Start via LuxStage-Dev-App (empfohlen) oder manuell, Login, Konfiguration, Warnung vor Doppelstart (SQLite-Korruptionsrisiko). |
| `./package.json` | Monorepo-Root; Workspaces, better-sqlite3-Dependency, Versionsstand. |
| `./package-lock.json` | Lock-Datei für Monorepo-Dependencies (server, web-app). |
| `./.gitignore` | Ignoriert node_modules, dist, .env, Daten, iOS-Xcode-Artefakte. |
| `./.env` | Development-Umgebungsvariablen (JWT, Passwörter, Host). |
| `./.env.example` | Vorlage für Self-Hosted-Umgebungsvariablen. |
| `./.env.saas.example` | Vorlage für SaaS-Umgebungsvariablen (JWT, SMTP, Domain). |
| `./server.log` | Server-Logdatei (Laufzeitartefakt). |
| `./.claude/settings.json` | Claude-Code-Permissions und erlaubte Bash-/MCP-Befehle. |
| `./.claude/settings.local.json` | Lokale, nicht versionierte Claude-Code-Konfiguration. |
| `./.claude/launch.json` | Debug-Konfiguration für Web-App und Backend. |
| `./.code-review-graph/.gitignore` | Ignoriert die Code-Review-Graph-Datenbankdatei. |
| `./.code-review-graph/graph.db` | Code-Review-Graph-Datenbank (Metadaten, Struktur). |
| `./.github/workflows/release.yml` | GitHub Action: baut Release-ZIP bei `v*`-Tags. |
| `./.github/workflows/codeql.yml` | GitHub Action: CodeQL-Sicherheitsanalyse. |
| `./.github/workflows/saas-image.yml` | GitHub Action: baut SaaS-Image nach GHCR bei `v*`-Tags. |
| `./Dev-Server-App/LuxStageMenu.swift` | macOS-Menüleisten-App; startet/stoppt/restartet Dev-Server via `dev.sh`, zeigt Live-Status (Backend/Web-App erreichbar, Version, PID, Laufzeit), Web-App- und Log-Öffnen-Aktionen. |
| `./Dev-Server-App/LuxStageMenu` | Kompilierte macOS-Executable der Menüleisten-App. |
| `./Dev-Server-App/dev.sh` | Startet Server + Web-App lokal für Entwicklung; von der Menüleisten-App aufgerufen. |
| `./audits/secrets-management-audit-2026-09-01.md` | Secrets-Management-Audit vom 2026-09-01: Findings zu Klartext-Credentials in der DB, Backup-Zugriff, Rotation und Key-Storage; enthält keine echten Secrets. |
| `./audits/solid-principles-audit-2026-09-01.md` | SOLID-Audit vom 2026-09-01: SRP-Verstöße im Frontend (FloorplanEditor, useShowChannels), OCP-Streuung der Section-/Element-Typen, ISP der db.js-Fassade, DIP-Trade-offs. |
| `./audits/architecture-analysis-2026-09-01.md` | Architektur-Analyse vom 2026-09-01: Schichten- und Datenflussdiagramme, Zyklenprüfung (keine Zyklen), Bottlenecks (History-Job, Mandanten-Verbindungscache, prozesslokaler Zustand), Modularitätsbewertung 7/10. |
| `./audits/architecture-analysis-frontend-2026-09-01.md` | Architektur-Analyse Frontend vom 2026-09-01: Schichtmessung, Zyklenprüfung (nur shadcn-ui-Barrels), God-Komponenten, ungenutzte SSE-Events, fehlendes State-Aggregat; Modularität 6/10. |
| `./audits/design-patterns-audit-2026-09-01.md` | Design-Pattern-Audit vom 2026-09-01: Pattern-Inventar Server + Frontend, Memento/CoR/Facade als Positivbefunde, dreifaches Memento, unterbenutzte Strategy, fehlender Logger und Value Objects. |
| `./docs/saas-betrieb.md` | Dokumentation für Multi-Mandanten-SaaS-Betrieb mit alternativem Wildcard- oder On-Demand-TLS; Abschnitt „Skalierung" begründet den Ein-Prozess-Betrieb (prozesslokaler Zustand, SQLite) und nennt Sharding als Weg. |
| `./docs/deploy-cx43.md` | Deployment-Anleitung für Hetzner-CX43-Server. |
| `./shared/locales/de.json` | Übersetzungen für deutsche Oberfläche. |
| `./shared/locales/en.json` | Übersetzungen für englische Oberfläche. |
| `./shared/filters.json` | Farbfilter-Datenbank (Lee, Rosco etc.) mit Hex-Codes. |
| `./shared/constants.js` | Gemeinsame Konstanten und Prüffunktionen für Server und Web-App: `PASSWORD_MIN_LENGTH`, `isValidEmail`, Section-Typen (`sectionTypeHasRows`, `isSectionTableType`). |

## server/ (Node.js Backend)

| Datei | Beschreibung |
|---|---|
| `./server/index.js` | HTTP-Server-Einstieg mit CORS, Security-Headern und Job-Starter. |
| `./server/router.js` | HTTP-Router für API-Endpunkte und Datei-Serving; öffentliche API-Ausnahmen sind an Methode und Pfad gebunden, API- und Show-Unterressourcen laufen über geordnete Handler-Listen. Globales IP-Rate-Limiting greift vor jedem API-Request. Fehler in Route-Handlern werden abgefangen (500 statt Prozessabsturz). Liefert hostunabhängig `/.well-known/apple-app-site-association` für Apple Universal Links (Passwort-Reset → App-Login). |
| `./server/config.js` | Lädt Umgebungsvariablen und Konfigurationsdefaults, einschließlich explizitem Reverse-Proxy-Vertrauen. |
| `./server/bootstrap.js` | Einmaliges Setup-Skript; legt den ersten Admin an (Login = `ADMIN_EMAIL`). |
| `./server/db.js` | Re-Export der Datenbank-Funktionen aus `db/index.js`. |
| `./server/db-init.js` | Datenbankverbindung, Basis-Schema und Migrations-Runner (führt `db/migrations/*` einmalig aus, getrackt in `schema_migrations`). |
| `./server/db-context.js` | Request-gebundener DB-Kontext für Multi-Tenancy (AsyncLocalStorage). |
| `./server/auth.js` | JWT-Token, Passwort-Hashing und kurzlebige Download-Token-Verwaltung; Cleanup-Timer blockiert keine Einmalprozesse. |
| `./server/logger.js` | Strukturierter Logger mit Log-Level (`LOG_LEVEL`, Standard `info`) und key=value-Feldern; sicherheitsrelevante Ereignisse in `routes/auth.js` und `routes/users.js` laufen darüber. |
| `./server/helpers.js` | Utility-Funktionen für Body-Parsing, JSON, Fehlerbehandlung, Client-IP-Ermittlung. |
| `./server/rate-limit.js` | Grobes globales IP-Rate-Limiting (300 Req/Min) für alle API-Routen, ergänzt das strengere Login-spezifische Limit in `routes/auth.js`. |
| `./server/history.js` | Periodische Snapshots von Show-State zur Versionierung; sichert vor dem Wiederherstellen den aktuellen Stand. Der Snapshot-Lauf gibt zwischen den Shows den Event-Loop frei und warnt bei Laufzeiten über 1s. |
| `./server/backup.js` | ZIP-basierte Backup- und Wiederherstellungsfunktionen mit request-isoliertem Staging, Restore-Lock, Rollback und Grenzen für ZIP-Einträge sowie entpackte Daten; entfernt SMTP-Passwort und Reset-Token vor dem Export aus der Backup-Kopie. |
| `./server/photos.js` | Gestreamter Foto-Upload mit Gesamt-, Datei- und Dateianzahlgrenzen, Skalierung und Thumbnail-Generierung; Ablage pro Mandant unter dessen Mandantenordner. |
| `./server/floorplan.js` | Grundrissbild-Verwaltung mit Format-Validierung (nur PNG/JPEG); Ablage pro Mandant unter dessen Mandantenordner; Pfadauflösung für den PDF-Export. |
| `./server/migrate-tenant-media.js` | Einmaliges Migrationsskript: verschiebt Fotos/Grundrisse aus dem alten mandantenübergreifend flachen Verzeichnis in die jeweiligen Mandantenordner. |
| `./server/circuit-scan.js` | Wertet Foto einer Kreisliste per Claude Vision (`@anthropic-ai/sdk`, strukturierte Zod-Ausgabe) aus — Vordruck mit Handschrift oder komplett handschriftlich, ohne Vorlage; liefert pro erkannter Zeile alle Spalten (Kanal, Adresse, Gerät, Position, Filter, Notizen). |
| `./server/pdf.js` | PDF-Export für Einleuchtpläne: Orchestrierung (Titel, Sections, Kanalliste, Grundriss, Fotos). `generatePDF(data, stream, opts)` rendert in einen beliebigen Writable-Stream und kennt kein HTTP — Response-Header setzt der Aufrufer, Dateiname über `pdfFilename()`. Optionaler Vordruck-Modus (`opts.blank`) für handschriftlich auszufüllende Kreislisten (Filter/Notizen leer, Leerzeilen je Position, Block „Neue Kreise“); Rendering-Details in `pdf/`. |
| `./server/pdf/constants.js` | Gemeinsame Layout-Konstanten (Maße, Farben, Fonts) für den PDF-Export. |
| `./server/pdf/filter-colors.js` | Lee/Rosco-Filter-Code zu Hex-Farbe, Kontrastfarben-Berechnung. |
| `./server/pdf/layout-primitives.js` | Low-Level-Zeichenhelfer für Tabellenzeilen und Key-Value-Sections; `drawRow`/`calcRowHeight` nehmen optionale `minRowH` für höhere Zeilen im Vordruck-Modus. |
| `./server/pdf/tiptap-parse.js` | Parsen von Tiptap-JSON/Markdown-Setup-Text in Render-Blöcke, inkl. Zeichnen. |
| `./server/pdf/towers.js` | Rendering von Beleuchtungsgestellen (Karten-Grid und Textliste). |
| `./server/pdf/bars.js` | Rendering von Zugstangen/Traversen/Punktzug (Skala, Fixture-Kreise, Textliste). |
| `./server/pdf/floorplan-vector.js` | Zeichnet die Grundriss-Seite direkt als Vektorgrafik aus canvas_data (alle 7 Elementtypen inkl. Rotation, Fixture-Pins, Slot-Badges) statt eines Raster-Snapshots; optionales Hintergrundbild wird weiterhin als Raster eingebettet. |
| `./server/pdf/network.js` | PDF-Export der Netzwerk-Verkabelung: Port-Tabelle je Switch (Hauptswitch zuerst), Abschnitt „Sonstige Verbindungen“ für Switch-lose Verbindungen; nutzt dieselben Layout-Primitives wie `pdf.js`. |
| `./server/pdf/section-renderers.js` | Registry der Section-Typen für den PDF-Export (`kv-table`, `fields`, Default für Setup-Text); je Typ Content-Prüfung und Render-Funktion. Ein neuer Typ ist ein Eintrag hier, `pdf.js` bleibt unverändert. |
| `./server/pdf/utils.js` | Kanalgruppierung, Datumsformat, Bildgrößen-Ermittlung aus PNG/JPEG-Buffer. |
| `./server/sse.js` | Server-Sent Events für Echtzeit-Kanal-Updates und Präsenz, pro Mandant gescopt; Heartbeat blockiert keine Einmalprozesse; sendToUser() für gezielte Zustellung an einen User (z.B. Lock-Übernahme-Anfrage). |
| `./server/email.js` | SMTP-Konfiguration und Email-Versand mit Fallback-Support (u.a. Willkommens-, Bestätigungs- und Freischalt-Anfrage-Mails). |
| `./server/package.json` | NPM-Abhängigkeiten (sqlite, pdfkit, sharp, bcrypt, jwt). |
| `./server/test/helpers/test-env.js` | Isolierte Testumgebung mit temporärem Datenpfad und HTTP-Response-Stub für Backend-Tests. |
| `./server/test/register.test.js` | Regressionstests für atomare SaaS-Registrierungsbestätigung und Cleanup bei Registry-Konflikten. |
| `./server/test/router.test.js` | Regressionstests für öffentliche API-Methoden und Authentifizierungsgrenzen des HTTP-Routers. |
| `./server/test/photos.test.js` | Regressionstest für gestreamtes Multipart-Staging und garantiertes Cleanup temporärer Foto-Uploads. |
| `./server/test/tenant-backup.test.js` | Regressionstests für Tenant-Snapshot-Restore und Rollback bei fehlgeschlagener Aktivierung. |
| `./server/test/secrets.test.js` | Regressionstests für AES-256-GCM-Verschlüsselung der SMTP-Settings und SHA-256-Hashing der Passwort-Reset-Token (inkl. Ablauf, Einmal-Einlösung). |
| `./server/test/network-undo.test.js` | Tests für den globalen Netzwerk-Undo-Stack: Snapshot vor der Änderung, Transaktions-Rollback, Redo-Reihenfolge, Hash-Integrität, Stack-Begrenzung. |
| `./server/test/logger.test.js` | Tests für Format, Log-Level-Schwelle, stdout/stderr-Trennung und Feld-Quoting des Loggers. |
| `./server/test/pdf-generate.test.js` | Tests, dass `generatePDF()` in einen beliebigen Stream rendert (ohne HTTP-Response) und `pdfFilename()` Einleuchtplan/Vordruck unterscheidet. |
| `./server/test/section-renderers.test.js` | Tests für die Section-Renderer-Registry: Typ-Zuordnung, Default-Fallback, Content-Prüfung inkl. Regex-Escaping der Feldnamen. |
| `./server/test/locks.test.js` | Tests für Show-Locks: Erwerb, Ablauf-Aufräumen, Übergabe und Freigabe nur durch den Inhaber. |
| `./server/test/history-job.test.js` | Tests, dass der DB-Kontext (`runWithDb`) über await-Grenzen des asynchronen History-Laufs erhalten bleibt. |
| `./server/test/tenants-lru.test.js` | Tests für die LRU-Obergrenze offener Mandanten-Verbindungen (Verdrängung, Wiederöffnen, Schutz des zuletzt Genutzten). |
| `./server/test/shared-constants.test.js` | Tests für die geteilten Konstanten (`isValidEmail`, `PASSWORD_MIN_LENGTH`) aus `shared/constants.js`. |
| `./server/test/undo-redo-integrity.test.js` | Integrationstests für Full-Snapshot-Undo/Redo-Architektur: Snapshot-Konsistenz, Hash-Verifikation, Redo-Stack-Persistierung, mehrfaches Undo/Redo ohne Datenverlust. |
| `./server/.env` | Server-Development-Umgebungsvariablen. |
| `./server/saas.js` | Kapsel für SaaS-Funktionalität, lädt Module nur im SaaS-Modus. |
| `./server/registry.js` | Zentrale Registrierung für Mandantenverzeichnis und Doppel-Opt-In; aktiviert Tenant-Eintrag und verbraucht Bestätigungslink atomar. |
| `./server/tenants.js` | Mandantenverzeichnis mit separaten SQLite-DBs pro Kunde und Kompensation fehlgeschlagener Registrierungen. |
| `./server/tenant-resolve.js` | Host-Header-Parsing für Subdomain-basierte Mandantenauflösung, plus `tenantBaseUrl()` für Mandanten-URLs in E-Mail-Links. |
| `./server/tenant-backup.js` | Tägliche Snapshots pro Mandant mit Retention-Policy; sichert vor Restore den Ist-Zustand und aktiviert Snapshots per rückrollbarem DB-Swap. |
| `./server/operator.js` | Separater Admin-Login für Betreiber-Panel mit JWT. |
| `./server/operator-panel.html` | HTML-UI für Betreiber-Panel zur Mandantenverwaltung. |
| `./server/operator-panel.js` | Client-Skript für Betreiber-Panel (ausgelagert wg. CSP `script-src 'self'`). |

### server/db/ (Datenbankzugriff)

| Datei | Beschreibung |
|---|---|
| `./server/db/index.js` | Barrel-Export aller DB-Module. |
| `./server/db/shows.js` | DB-Zugriff für Shows-Tabelle (Erstellen, Lesen, Archivieren, Löschen). |
| `./server/db/users.js` | DB-Zugriff für Benutzer, Passwort-Reset-Tokens (SHA-256-gehasht gespeichert) und Freischaltung selbst-registrierter (pending) Nutzer. |
| `./server/db/channels.js` | DB-Zugriff für Kanäle-Tabelle, Beleuchtungs-Checks und mandantenweite Farbnutzungsstatistik. |
| `./server/db/bars.js` | DB-Zugriff für Obermaschinerie-Elemente (Zugstange/Traverse/Punktzug via bar_type) und deren Befestigungen (Fixtures); restoreBars() ersetzt den kompletten Bars-Zustand einer Show (für Undo/Redo). |
| `./server/db/towers.js` | DB-Zugriff für Show-Türme und deren Slots. |
| `./server/db/sections.js` | DB-Zugriff für Show-Sections und deren Definitionen. |
| `./server/db/photos.js` | DB-Zugriff für Fotos, Beschreibungen, Reihenfolge, Channel-Fotos. |
| `./server/db/floorplan.js` | DB-Zugriff für Template- und Show-Grundrisse (Bilder, Canvas-Daten). |
| `./server/db/full-state.js` | Liest/schreibt kompletten Show-Zustand (Channels, Sections, Bars, Towers) atomar als Snapshot; Basis für Undo/Redo-Integrität. |
| `./server/db/templates.js` | DB-Zugriff für Spielort-Vorlagen (Stammdaten, Kanäle). |
| `./server/db/template-sections.js` | DB-Zugriff für Template-Sections und deren Definitionen. |
| `./server/db/template-bars.js` | DB-Zugriff für Template-Bars und deren Fixtures. |
| `./server/db/template-towers.js` | DB-Zugriff für Template-Towers und deren Slots. |
| `./server/db/template-apply.js` | Anwendung von Templates auf Shows (einzeln und auf alle Shows eines Templates) sowie Rück-Speichern von Show-Items als Template-Einträge. |
| `./server/db/locks.js` | DB-Zugriff für Show-weiten Schreib-Lock: acquire/release/touch/get/transfer (direkte Übergabe an anderen User) sowie listLocks() für die Show-Übersicht. |
| `./server/db/undo-stack.js` | Gemeinsame Mechanik der Undo/Redo-Stacks (`makeUndoStack`): Snapshot aufzeichnen, Redo-Stack, Begrenzung auf 50 Einträge, transaktionale Klammer. Zwei Varianten leiten sich daraus ab — je Show (`show_id`) und global fürs Netzwerk. |
| `./server/db/operations.js` | Undo/Redo für Shows: Konfiguration von `makeUndoStack` mit Show-Scope und Full-Snapshot-Zustand; Funktion `withUndoSnapshot()` für transaktionale Snapshots. |
| `./server/db/network.js` | DB-Zugriff für Netzwerk-Elemente (network_nodes: Typ, Raum, Portanzahl bei Switches, Position im Graph), deren Verbindungen (network_connections) und einen speicherbaren Positions-Snapshot der Topologie-Ansicht (network_layout_snapshot). |
| `./server/db/network-state.js` | Liest/schreibt kompletten Netzwerk-Zustand (Elemente + Verbindungen) atomar als Snapshot; Basis für Netzwerk-Undo/Redo, analog zu `full-state.js` aber ohne Show-Bezug. |
| `./server/db/network-operations.js` | Netzwerk-Undo/Redo: Konfiguration von `makeUndoStack` ohne Scope-Spalte (einziger globaler Stack, da das Netzwerk gebäudeweit ist), `withNetworkUndoSnapshot()` für transaktionale Snapshots. |
| `./server/db/settings.js` | DB-Zugriff für generische Key-Value-Settings-Tabelle (SMTP-Konfig, Anzeige-Einstellungen); `setSecretSetting`/`getSecretSetting` verschlüsseln Secrets (z. B. SMTP-Passwort) at rest mit AES-256-GCM, Schlüssel aus `JWT_SECRET` abgeleitet. |
| `./server/db/migrations/index.js` | Geordnete Liste aller Schema-Migrationen. |
| `./server/db/migrations/039-operations-full-snapshot.js` | Migration: ändert operations-Tabelle für Full-Snapshot-Historie, fügt redo_stack-Tabelle für persistente Redo-Stack hinzu. |
| `./server/db/migrations/NNN-*.js` | Einzelne Schema-Migration (`up`, `alreadyApplied`); wird von `db-init.js` einmalig ausgeführt und in `schema_migrations` getrackt. |

### server/routes/ (API-Endpunkte)

| Datei | Beschreibung |
|---|---|
| `./server/routes/shows.js` | API-Routen für Shows (CRUD, Lock inkl. Übernahme-Anfrage und -Übergabe, Events, Templates, Undo/Redo mit Full-Snapshot-Verifikation: Hash-Check bei Undo/Redo, 409 bei manipuliertem Snapshot). |
| `./server/routes/auth.js` | API-Routen für Login, Passwort-Änderung, Passwort-Reset sowie begrenztes IP-Rate-Limiting. |
| `./server/routes/users.js` | API-Routen für Benutzer-Verwaltung, Preferences, Selbst-Registrierung (`/api/self-register`) und Freischaltung pending Nutzer. |
| `./server/routes/register.js` | API-Routen für Self-Service-Registrierung (Double Opt-In). |
| `./server/routes/channels.js` | API-Routen für Kanäle, Beleuchtungs-Checks und mandantenweite Farbnutzungsstatistik (`/api/channels/color-usage`); zeichnet Undo-Operation pro Save auf; `POST .../circuit-scan` wertet Foto eines ausgefüllten Kreislisten-Vordrucks per Claude Vision aus (liefert vollständige Zeilen als Vorschlag, kein DB-Write). |
| `./server/routes/bars.js` | API-Routen für Obermaschinerie-Elemente, Fixtures (inkl. side/positionText), Reordering; jede Aktion zeichnet den kompletten Bars-Zustand als Undo-Operation auf. |
| `./server/routes/towers.js` | API-Routen für Show-Türme, Slots, Restore; jede Aktion zeichnet den kompletten Towers-Zustand als Undo-Operation auf. |
| `./server/routes/sections.js` | API-Routen für Show-Sections und deren Definitionen; sendet SSE nach Inhalts- und Definitionsänderungen, zeichnet Undo-Operationen auf. |
| `./server/routes/photos.js` | API-Routen für Foto-Upload, Beschreibungen, Channel-Fotos. |
| `./server/routes/floorplan.js` | API-Routen für Show- und Template-Grundrisse (Bilder, Canvas-Daten). |
| `./server/routes/templates.js` | API-Routen für Spielort-Vorlagen (Kanäle, Sections, Bars, Towers); `GET .../pdf` liefert Kreislisten-Vordruck (Blank-Modus) für die Vorlage. |
| `./server/routes/history.js` | API-Routen für Show-Verlauf und Snapshot-Restore. |
| `./server/routes/pdf.js` | API-Route für PDF-Export von Shows; löst Grundriss-Bildpfad (Show- oder Template-Fallback) für den Vektor-Export auf; `?blank=1` liefert Kreislisten-Vordruck zum handschriftlichen Ausfüllen. |
| `./server/routes/display.js` | API-Routen für Anzeige-Einstellungen (Maßeinheiten). |
| `./server/routes/system.js` | API-Routen für System-Status, Health-Check, Backup, Restore. |
| `./server/routes/update.js` | API-Routen für Versions-Check und Server-Update; entpackt Release-ZIP streamend, spart Infrastruktur-Dateien aus, sichert den Stand vorher und macht bei Fehlschlag (npm install, Modul-Rauchtest) automatisch ein Rollback. |
| `./server/routes/smtp.js` | API-Routen für SMTP-Konfiguration und Test-E-Mails. |
| `./server/routes/operator.js` | API-Routen für Betreiber-Panel (Mandanten-Verwaltung, Server-Version). |
| `./server/routes/network.js` | API-Routen für die gebäudeweite Netzwerk-Übersicht (Elemente wie Dose/Switch/Gerät und deren Verbindungen), unabhängig von einzelnen Shows; validiert, dass Netzwerkdose↔Netzwerkdose und Gerät↔Gerät nicht direkt verbunden werden (nur über einen Switch) und dass Dose max. zwei Verbindungen (Durchschleifung rein/raus), Gerät max. eine hat (Switch-Ausnahme); jede Mutation läuft über `withNetworkUndoSnapshot()`, dazu `POST /api/network/undo`/`redo`; inkl. PDF-Export (`GET /api/network/pdf`, siehe `pdf/network.js`). |

## web-app/ (Vue 3 + TypeScript Frontend, Vite)

| Datei | Beschreibung |
|---|---|
| `./web-app/index.html` | HTML-Entry-Point der Vue-Web-App. |
| `./web-app/vite.config.js` | Vite-Build-Konfiguration; Code-Splitting, Proxy zum Server. |
| `./web-app/playwright.config.ts` | Playwright-E2E-Testkonfiguration; Setup-Projekt loggt einmalig ein und teilt `storageState` mit dem authentifizierten Projekt, unauth-Tests laufen separat. |
| `./web-app/e2e/auth.setup.ts` | Einmaliger Login vor den authentifizierten E2E-Tests, speichert Session in `e2e/.auth/user.json`. |
| `./web-app/e2e/smoke.spec.ts` | E2E: Login-Seite lädt, Auth-Redirect, 404-Route (unauthentifiziert). |
| `./web-app/e2e/login.spec.ts` | E2E: Login mit gültigen/ungültigen Zugangsdaten. |
| `./web-app/e2e/shows-crud.spec.ts` | E2E: Show erstellen und wieder archivieren. |
| `./web-app/e2e/channels-crud.spec.ts` | E2E: Kanal in einer Show anlegen, löschen, Show aufräumen. |
| `./web-app/e2e/undo-redo.spec.ts` | E2E: Undo/Redo einer Kanal-Erstellung, einfach und mehrfach über mehrere Kanäle (LIFO-Stack). |
| `./web-app/package.json` | Web-App-Dependencies: Vue 3, Tailwind, Shadcn-ui, Editor. |
| `./web-app/tsconfig.json` | TypeScript-Compiler-Optionen für die Web-App. |
| `./web-app/tsconfig.tsbuildinfo` | TypeScript-Build-Metadaten (Laufzeitartefakt). |
| `./web-app/jsconfig.json` | Pfad-Aliase für Web-App (`@/` und `@shared/`). |
| `./web-app/components.json` | Shadcn-vue UI-Komponenten-Konfiguration. |
| `./web-app/.env` | Development-Umgebungsvariablen für Web-App. |
| `./web-app/.env.production` | Produktiv-Umgebungsvariablen für Web-App. |
| `./web-app/.env.development.local` | Lokale Tolgee-Server-URL und API-Key (nicht versioniert). |
| `./web-app/.tolgeerc.json` | Tolgee-CLI-Config für `npm run tolgee:push`/`tolgee:pull`. |
| `./web-app/src/main.ts` | Bootstrap: erstellt Vue-App, registriert Router und Tolgee, wendet System-Theme an. |
| `./web-app/src/env.d.ts` | Vite-Umgebungs- und Build-Konstanten-Typen für den Typecheck. |
| `./web-app/src/shims-vue.d.ts` | Globale TypeScript-Deklaration für lokale Vue-Single-File-Komponenten. |
| `./web-app/src/shared.d.ts` | TypeScript-Deklarationen für Shared-JavaScript-Module außerhalb des WebApp-Projekts. |
| `./web-app/src/tolgee.ts` | Zentrale Tolgee-Instanz: Dev lädt live vom Server (In-Context-Editor), Prod nutzt shared/locales als staticData. |
| `./web-app/src/App.vue` | Root-Komponente: TolgeeProvider, globaler TooltipProvider, Sidebar, Top-Bar, Routing, globale Dialoge und Status-Updates. |
| `./web-app/src/style.css` | Tailwind, Theme-Variablen, Print-Styles für Tabellen und Foto-Galerien. |
| `./web-app/src/router/index.ts` | Vue Router mit Auth-Guards, Admin-Checks und Route-Definitionen. |

### web-app/src/composables/ (Vue Composition-API-Logik)

| Datei | Beschreibung |
|---|---|
| `./web-app/src/composables/useContainerWidth.ts` | Misst Container-Breite und reagiert responsiv auf Größenänderungen. |
| `./web-app/src/composables/useConfirm.ts` | Verwaltet globale Bestätigungsdialoge mit Promises. |
| `./web-app/src/composables/useShowNav.js` | Stellt Navigationselement-State (inkl. addSection/deleteSection) zwischen Komponenten bereit. |
| `./web-app/src/composables/useShowSidebarNav.js` | Baut die Sidebar-Navigationsitems einer Show (Kanäle, Aufbau-Subtabs, Sections, Fotos, Grundriss) inkl. Section-Löschen. |
| `./web-app/src/composables/useDragReorder.ts` | Ermöglicht Drag-and-Drop-Sortierung von Listen-Items. |
| `./web-app/src/composables/useMeasureUnit.ts` | Konvertiert zwischen Maßeinheiten (m, cm, mm) mit Speicherung. |
| `./web-app/src/composables/useKeyboardNav.ts` | Navigiert Tabellen mit Tab, Enter und Pfeiltasten. |
| `./web-app/src/composables/useUpdateCheck.ts` | Speichert globalen Zustand der Verfügbarkeit von Updates. |
| `./web-app/src/composables/useShowFloorplan.ts` | Lädt und speichert Grundriss-Daten und Bilder pro Show. |
| `./web-app/src/composables/useTokenRefresh.ts` | Erneuert JWT-Token automatisch vor Ablauf. |
| `./web-app/src/composables/useShowChannels.ts` | Verwaltet Kanäle mit Suche, Filter, EOS-Import und Kreisliste-Scan-Import (inkl. Diff-Vorschau vor Übernahme, Lade-/Erfolg-/Fehler-Status); Undo/Redo läuft serverseitig über useUndoRedo.ts, das nach erfolgreichem Undo/Redo über `onAfter` die betroffenen Show-Daten neu lädt. |
| `./web-app/src/composables/useColorUsage.js` | Modulweiter Cache der mandantenweiten Farbnutzungsstatistik für ColorAutocomplete. |
| `./web-app/src/composables/useShowTabs.js` | Verwaltet Show-Tab-, Subtab- und Sitzungs-Persistenz inklusive Timeout und validiert verfügbare Aufbau-Tabs. |
| `./web-app/src/composables/useTemplateInsertion.js` | Verwaltet Auswahl, Einfügen und Speichern von Bar-/Turm-Vorlagen für eine Show. |
| `./web-app/src/composables/useLocale.ts` | Kompatibilitäts-Bridge auf @tolgee/vue; bestehende t(key)-Aufrufe laufen jetzt über Tolgee. |
| `./web-app/src/composables/usePhotoSettings.ts` | Speichert Benutzereinstellung für Fotos pro Seite. |
| `./web-app/src/composables/useShowSections.ts` | Lädt und speichert benutzerdefinierte Abschnitte pro Show. |
| `./web-app/src/composables/useBreakpoint.ts` | Erkennt Bildschirmgröße via MediaQueryList-Listener. |
| `./web-app/src/composables/floorplan/useFloorplanState.ts` | Aktuell leer (Platzhalter, ungenutzt). |
| `./web-app/src/composables/useShowLockEvents.ts` | Abonniert Lock-Status, Übernahme-Anfragen und Präsenz (`presentUsers` — wer die Show gerade offen hat, ohne den eigenen Zugang) über Server-Sent Events. |
| `./web-app/src/composables/useShowLock.ts` | Show-weiter Schreib-Lock im Frontend: Akquise beim Öffnen, periodischer Heartbeat, Freigabe/Übergabe, Übernahme-Anfrage-Handling. |
| `./web-app/src/composables/useShowHistory.js` | Verwaltet Öffnen und Wiederherstellen des Show-Versionsverlaufs inklusive Daten-Reload. |
| `./web-app/src/composables/useShowTowers.ts` | Verwaltet Türme (Lichtstative) mit Slot-Zuweisungen; meldet Schreib-Lock-Konflikte (423) über onLockConflict. |
| `./web-app/src/composables/useShowPhotos.ts` | Lädt Fotos-Liste pro Show. |
| `./web-app/src/composables/useUndoRedo.ts` | Serverseitiges Undo/Redo: `useServerUndoRedo()` trägt die Mechanik (optimistische canUndo/canRedo-Führung, 400 = leerer Stack, 423 = Lock-Konflikt, `onAfter`-Reload, Cmd/Ctrl+Z-Kürzel), `useUndoRedo(showId)` konfiguriert sie für Shows; die Netzwerk-Ansicht nutzt dieselbe Mechanik mit den Netzwerk-Endpunkten. `markSaved()` öffnet canUndo nach einem regulären Save wieder. |
| `./web-app/src/composables/useShowBars.ts` | Verwaltet Obermaschinerie-Elemente mit Fixtures (inkl. side/positionText) und Kanal-Zuordnungen; meldet Schreib-Lock-Konflikte (423) über onLockConflict. |
| `./web-app/src/composables/useSaveToTemplateDialog.ts` | "Als Vorlage speichern"-Dialog-Logik (Namenskonflikt-Check, Speichern), geteilt von GassenturmView und ZugstangenView. |

### web-app/src/utils/

| Datei | Beschreibung |
|---|---|
| `./web-app/src/utils/generateHangerei.ts` | Generiert formatierte Textlisten für Bars und Towers. |
| `./web-app/src/utils/uuid.ts` | Erzeugt UUIDs mit Fallback für Non-Secure-Context. |
| `./web-app/src/utils/templateName.ts` | Entfernt `.csv`-Suffix und ersetzt Bindestriche in Namen. |
| `./web-app/src/utils/index.ts` | Exportiert `cn()`-Utility für Tailwind/clsx Klassenkombination. |
| `./web-app/src/utils/filterColors.ts` | Normalisiert und validiert Filterfarben-Codes (Lee/Rosco). |
| `./web-app/src/utils/floorplanSnapshot.js` | Rendert Floorplan-SVG+Hintergrundbild in Canvas für den PNG-Export-Button; Bild wird unverzerrt (contain) eingepasst. |
| `./web-app/src/utils/eos-csv.ts` | Parst ETC-Eos-CSV-Exporte: aktive Kanäle, Moving-Light-Erkennung, Adressnormalisierung, Gerätenamen. |
| `./web-app/src/api/currentUser.ts` | Liefert den eingeloggten Nutzernamen aus dem JWT (geteilt von Lock- und Präsenz-Logik). |
| `./web-app/src/composables/useUndoRedo.test.ts` | Unit-Tests für die serverseitige Undo/Redo-Anbindung: Zustandsführung, 400/423-Mapping, onAfter-Reload, Tastaturkürzel (vitest). |
| `./web-app/src/api/cache.test.ts` | Unit-Tests für den API-Cache: TTL, Invalidierung, In-Flight-Deduplizierung, Aufräumen nach Fehlern (vitest). |
| `./web-app/src/utils/eos-csv.test.ts` | Unit-Tests für den Eos-CSV-Parser (vitest). |

### web-app/src/api/ (HTTP-Client-Layer zum Server)

| Datei | Beschreibung |
|---|---|
| `./web-app/src/api/client.ts` | Typisierter HTTP-Client mit einheitlicher Auth-, Fehler-, Download- und SSE-Verwaltung; subscribeShow() für Lock-Status-, Übernahme-Anfrage- und Präsenz-Events. |
| `./web-app/src/api/jwtDecode.ts` | Dekodiert JWT-Payload ohne externe Abhängigkeit. |
| `./web-app/src/api/cache.ts` | Einfacher In-Memory-Cache mit TTL-Support. |
| `./web-app/src/api/shows.ts` | CRUD-API für Shows, Meta-Daten, History und Snapshots, Show-Lock (inkl. Übergabe), Undo/Redo. |
| `./web-app/src/api/channels.ts` | CRUD und CSV-Im-/Export für Kanäle, Merging-Logik, Abruf der Farbnutzungsstatistik; `scanCircuitSheet` lädt Vordruck-Foto zur Vision-Auswertung hoch. |
| `./web-app/src/api/bars.ts` | Verwaltet Obermaschinerie-Elemente (Zugstange/Traverse/Punktzug), Fixtures und deren Reihenfolge. |
| `./web-app/src/api/towers.ts` | CRUD-API für Lichtstative und Slot-Zuweisungen. |
| `./web-app/src/api/sections.ts` | Lädt/speichert benutzerdefinierte Abschnitte für Shows und Templates. |
| `./web-app/src/api/photos.ts` | Lädt, hochladen, löscht Fotos mit Progress-Tracking; Beschriftungen und Kreis-Zuordnungen pro Foto. |
| `./web-app/src/api/floorplan.ts` | Speichert/lädt Grundriss-Canvas-Daten und Bilder (PDF-Grundriss wird serverseitig live aus Canvas-Daten gerendert, kein Snapshot-Upload mehr). |
| `./web-app/src/api/network.ts` | CRUD-API für Netzwerk-Elemente und -Verbindungen (gebäudeweite Netzwerk-Übersicht). |
| `./web-app/src/api/templates.ts` | Verwaltet Templates (Vorlagen) mit Anwendungs- und Upload-Funktionen; `fetchTemplatePdfUrl` liefert Download-Link für den Kreislisten-Vordruck. |
| `./web-app/src/api/templateBars.ts` | CRUD-API für Bars in Vorlagen. |
| `./web-app/src/api/templateTowers.ts` | CRUD-API für Towers in Vorlagen mit Slot-Verwaltung. |
| `./web-app/src/api/backup.ts` | Backup-Download und Restore-Upload mit ZIP-Format. |

### web-app/src/views/ (Seiten/Routen)

| Datei | Beschreibung |
|---|---|
| `./web-app/src/views/LoginView.vue` | Anmeldung mit E-Mail und Passwort; zeigt Hinweis bei Konto mit ausstehender Freischaltung, verlinkt Selbst-Registrierung. |
| `./web-app/src/views/RegisterView.vue` | Team-Registrierung mit E-Mail-Bestätigung. |
| `./web-app/src/views/SelfRegisterView.vue` | Selbst-Registrierung neuer Nutzer innerhalb eines bestehenden Tenants; Konto bleibt pending bis ein bestehender Nutzer freischaltet. |
| `./web-app/src/views/ConfirmView.vue` | Bestätigung der Team-Registrierung via E-Mail-Link. |
| `./web-app/src/views/ForgotPasswordView.vue` | Passwort-Zurücksetzen anfordern per E-Mail. |
| `./web-app/src/views/ResetPasswordView.vue` | Passwort-Zurücksetzen nach E-Mail-Link. |
| `./web-app/src/views/ShowsView.vue` | Übersicht aller Produktionen mit Sortierung; zeigt Schreib-Sperre pro Show (Schloss-Icon); Erstellung per Schnell-Dialog oder ShowWizardDialog (FAB-Menü). |
| `./web-app/src/views/ShowDetailView.vue` | Hauptansicht einer Show mit Kanaltabelle und Editoren; read-only-Overlay bei fremdem Schreib-Lock (leitet Scroll-Events an den Content weiter), Übernahme-Anfrage-Dialog; fixierte Statusanzeige (Lade-Spinner/Erfolg/Fehler) beim Kreisliste-Scan. |
| `./web-app/src/views/ArchiveView.vue` | Anzeige und Verwaltung archivierter Produktionen mit Wiederherstellung. |
| `./web-app/src/views/NetworkView.vue` | Gebäudeweite Netzwerk-Übersicht: Topologie als interaktiver, per Vollbild vergrößerbarer Vue-Flow-Graph (frei verschiebbare Knoten, Verbindungen per Drag zwischen Handles neu anlegen oder bestehende umhängen — `edges-updatable`/`@edge-update`; Löschen von Knoten/Kanten per Backspace direkt im Canvas wird über `@nodes-change`/`@edges-change` in die API persistiert, statt nur lokal im Vue-Flow-Modell zu verschwinden und beim nächsten Sync wiederzukehren; dagre-Auto-Layout für neue Elemente); Verbindungen als Port-Grid je Switch (Hauptswitch zuerst, freie Ports hervorgehoben) plus Tabelle für switchlose Verbindungen (neue Einträge als ungespeicherter Entwurf, bis beide Elemente gewählt sind); Dose hat max. zwei Verbindungen (rein/raus), Gerät max. eine — bei ausgeschöpftem Limit fragt die Zuweisung nach, ob die älteste Verbindung ersetzt wird (`claimNodeSlot`); Elemente-Tabelle nach Ort gruppiert/einklappbar mit Suche und neu-Markierung, neues Element per Dropdown mit Pflicht-Kategorie (Dose/Gerät/Switch) angelegt; Löschen von Elementen/Verbindungen fragt nach Bestätigung; Verbindungsauswahl blockt Dose↔Dose und Gerät↔Gerät; PDF-Export der Verkabelung über `GET /api/network/pdf`; serverseitiges Undo/Redo (⌘Z/⌘⇧Z, globaler Stack). |
| `./web-app/src/components/network/SwitchNode.vue` | Vue-Flow-Knotenkomponente für Switches: zeigt nummerierte Ports (zwei Reihen, ungerade/gerade) als eigene Handles, belegte Ports farblich hervorgehoben. |
| `./web-app/src/components/network/DeviceNode.vue` | Vue-Flow-Knotenkomponente für Dose/Gerät: einfache Box mit einem Handle je Seite, Hintergrundfarbe je nach Typ (Dose bläulich, Gerät bernsteinfarben) zur Unterscheidung auf einen Blick. |
| `./web-app/src/views/TemplatesView.vue` | Vorlagenliste, Neu-Anlegen, Löschen, Download des Kreislisten-Vordrucks (PDF); Detail-Bearbeitung an TemplateDetailPanel, Upload an TemplateUploadDialog delegiert. |
| `./web-app/src/views/SettingsView.vue` | Sub-Navigation zu verschiedenen Einstellungsbereichen. |
| `./web-app/src/views/settings/AccountView.vue` | Passwort-Änderung, Druckeinstellungen, Abmelden. |
| `./web-app/src/views/settings/UsersView.vue` | Benutzerverwaltung: Anlegen, Löschen, Freischalten selbst-registrierter Nutzer, Passwort-Reset. |
| `./web-app/src/views/settings/DisplayView.vue` | Sprach- und Maßeinheit-Einstellungen (Deutsch/Englisch). |
| `./web-app/src/views/settings/ServerView.vue` | Server-URL, Versionsinformationen und Speicherstatus. |
| `./web-app/src/views/settings/BackupView.vue` | Datenbank-Backup-Download und Wiederherstellung, beides Admin-only. |
| `./web-app/src/views/settings/SmtpView.vue` | Konfiguration von SMTP-Einstellungen und Test-E-Mails. |
| `./web-app/src/views/settings/UpdateView.vue` | Software-Update-Check und -Durchführung mit Live-Log. |
| `./web-app/src/views/NotFoundView.vue` | 404-Fehlerseite mit Navigation zur Startseite. |

### web-app/src/components/ (Fachliche Komponenten)

| Datei | Beschreibung |
|---|---|
| `./web-app/src/components/ConfirmDialog.vue` | Bestätigungsdialog zum Löschen mit Warnicon und konfigurierbaren Button-Labeln. |
| `./web-app/src/components/MarkdownEditor.vue` | Rich-Text-Editor mit Toolbar für Fett, Kursiv, Überschriften, Listen und Tabellen. |
| `./web-app/src/components/EosMergePreviewDialog.vue` | Vorschau neu aktiver, verschwundener und unberührter Kanäle bei EOS-Import. |
| `./web-app/src/components/Spinner.vue` | Animiertes Lade-Icon mit konfigurierbarer Größe. |
| `./web-app/src/components/FloorplanEditor.vue` | Interaktiver Zeichnungseditor mit Drag-Drop für Kanäle, Gestelle, Stangen und Formen; gruppierte Ribbon-Toolbar mit Tooltips, Empty-State mit Upload (nur PNG/JPEG), A4-Druckbereich-Guide, neue Uploads unverzerrt ins A4-Format eingepasst. |
| `./web-app/src/components/ColorAutocomplete.vue` | Farbfilter-Autocomplete mit Lee- und Rosco-Codes, Vorschau, Sortierung nach Nutzungshäufigkeit und Aufklapp-Richtung je nach verfügbarem Platz. |
| `./web-app/src/components/show/ShowHeader.vue` | Titel-Editor, Show-Metadaten, Import/Export (EOS, CSV, Kreisliste-Scan, PDF) und Verlauf. |
| `./web-app/src/components/show/ImportModal.vue` | Auswahl-Dialog für Kanal-Import: EOS, CSV oder Kreisliste-Scan (Foto des ausgefüllten Vordrucks oder komplett handschriftlicher Liste). |
| `./web-app/src/components/show/CircuitScanPreviewDialog.vue` | Diff-Vorschau vor Übernahme des Kreisliste-Scans: aktualisierte Kreise (alt→neu je Feld) und neue Kreise, einzeln per Checkbox abwählbar (inkl. "Alle umschalten"); Übernehmen/Abbrechen. |
| `./web-app/src/components/show/ShowWizardDialog.vue` | Mehrstufiger Assistent zum Anlegen einer Show: Vorlage, Name/Datum, Bereiche (Türme/Bars), dynamische Einzelauswahl-Schritte für Vorlagen-Bereiche/Obermaschinerie/Beleuchtungsgestelle, Zusammenfassung. |
| `./web-app/src/components/show/ShowActionBar.vue` | Undo/Redo, Schreib-Sperre-Anzeige mit Übernahme-Button, Mitleser-Badges (Initialen mit Tooltip aus der SSE-Präsenz) und klickbare Warn-Badges (doppelte Adresse/Kreisnummer, unvollständige Kreise) die die Kanalliste filtern. |
| `./web-app/src/components/show/ChannelPickerGrid.vue` | Wiederverwendbares Kreisauswahl-Grid (Suchfeld + nummerierte Buttons) für Scheinwerfer-/Kreis-hinzufügen-Modale; unterstützt Einzel- und Mehrfachauswahl. |
| `./web-app/src/components/show/PhotoGallery.vue` | Fotogalerie mit Upload, Beschriftungen, Mehrfachauswahl von Kreisen aus der Kreisliste (ChannelPickerGrid) und Lightbox-Vorschau. |
| `./web-app/src/components/show/HistorySlideOver.vue` | Snapshots älterer Kanalkonfigurationen zum Durchsuchen und Wiederherstellen; behandelt Ladefehler und verwirft veraltete Antworten nach dem Schließen. |
| `./web-app/src/components/show/ZugstangenView.vue` | Drag-Drop-Liste für Obermaschinerie-Elemente (Zugstange/Traverse/Punktzug, per Typ-Filter und -Auswahl) mit Scheinwerfer-Positionen und Vorlagen; vertikal zentrierter Empty-State mit Hinzufügen-Button, FAB nur bei vorhandenen Einträgen. |
| `./web-app/src/components/show/SectionEditor.vue` | Bearbeitbare Markdown- oder Tabellen-Abschnitte mit Drag-Drop, komponentenlokalen KV-Table-Refs und Migrations-Fallback. |
| `./web-app/src/components/show/GassenturmView.vue` | Beleuchtungsgestelle mit Slots und Kanalbelegung, Vorlagen und Drag-Drop; vertikal zentrierter Empty-State mit Hinzufügen-Button, FAB nur bei vorhandenen Einträgen. |
| `./web-app/src/components/show/GeneratedTextAccordion.vue` | Read-only-Bereich mit automatisch generierten Zusammenfassungen zu Beleuchtungsgestellen und Obermaschinerie. |
| `./web-app/src/components/channel/ChannelTable.vue` | Virtuelle Kanaltabelle mit Suche, Gruppierung, Drag-Drop-Sortierung und Inline-Bearbeitung. |
| `./web-app/src/components/channel/ChannelRow.vue` | Einzelne Kanalzeile mit Nummer, Farbe, Gerät, Notizen, Montage-Referenz und Assign-Menü. |
| `./web-app/src/components/channel/ChannelTextarea.vue` | Auto-wachsendes Textfeld für Geräte- und Notizenspalten mit Fokus-Styling. |
| `./web-app/src/components/channel/QuantitySelect.vue` | Combobox-Auswahl für Gerätemengen (1–10) mit Dropdown oder direkter Eingabe. |
| `./web-app/src/components/icons/IconKanaele.vue` | Icon für Kanäle/DMX-Adressen. |
| `./web-app/src/components/icons/IconRaum.vue` | Icon für Bühnengrundriss-Ansicht. |
| `./web-app/src/components/icons/IconBeleuchtungsgestelle.vue` | Icon für Beleuchtungsgestelle/Racks. |
| `./web-app/src/components/icons/IconAufbau.vue` | Icon für Aufbauplan/Bühnenaufbau. |
| `./web-app/src/components/icons/IconObermaschinerie.vue` | Icon für Zugstangen-Verwaltung. |
| `./web-app/src/components/template/TemplateDetailPanel.vue` | Detail-Editor einer Vorlage: Kanaltabelle, Sections, Grundriss, Zugstangen, Beleuchtungsgestelle in Tabs; Umbenennen, OSC-Host, Übertragen auf alle Shows, Download des Kreislisten-Vordrucks (PDF). |
| `./web-app/src/components/template/TemplateUploadDialog.vue` | Dialog für CSV-Upload neuer Vorlagen mit Vorschau der Kanäle. |
| `./web-app/src/components/template/TemplateBarsPanel.vue` | Zugstangen-Verwaltung innerhalb einer Vorlage mit Drag-Drop und Scheinwerfer-Zuordnung; zentrierter Empty-State mit Hinzufügen-Button. |
| `./web-app/src/components/template/TemplateTowersPanel.vue` | Beleuchtungsgestelle-Verwaltung innerhalb einer Vorlage mit Slots und Kanalbelegung; zentrierter Empty-State mit Hinzufügen-Button. |

### web-app/src/components/ui/ (Generische UI-Bausteine, shadcn-vue-Stil)

| Ordner | Beschreibung |
|---|---|
| `./web-app/src/components/ui/button/` | Button-Komponente mit Varianten (primary/ghost/outline). |
| `./web-app/src/components/ui/input/` | Text-Input-Komponente mit Größen-Varianten. |
| `./web-app/src/components/ui/textarea/` | Mehrzeiliges Text-Input-Feld. |
| `./web-app/src/components/ui/checkbox/` | Checkbox-Input-Komponente. |
| `./web-app/src/components/ui/label/` | Label für Formularelemente. |
| `./web-app/src/components/ui/select/` | Select/Dropdown-Input (mehrteilig). |
| `./web-app/src/components/ui/slider/` | Schieberegler-Komponente. |
| `./web-app/src/components/ui/toggle/` | Toggle-Button (An/Aus-Schalter). |
| `./web-app/src/components/ui/dialog/` | Modal Dialog (mehrteilig mit Header/Content/Footer). |
| `./web-app/src/components/ui/alert-dialog/` | Modal Alert-Dialog für Bestätigungen (mehrteilig). |
| `./web-app/src/components/ui/sheet/` | Sheet/Drawer-Komponente für Side-Navigation. |
| `./web-app/src/components/ui/dropdown-menu/` | Dropdown-Menü (mehrteilig, Radix-Style). |
| `./web-app/src/components/ui/tabs/` | Tab-Navigation UI-Komponente (Radix-Style, mehrteilig). |
| `./web-app/src/components/ui/tooltip/` | Tooltip-Komponente mit Provider und Content-Subparts. |
| `./web-app/src/components/ui/card/` | Card-Container für Content-Strukturen (mehrteilig). |
| `./web-app/src/components/ui/table/` | Tabellen-Komponente (Header/Body/Zellen). |
| `./web-app/src/components/ui/progress/` | Progress-Bar-Komponente für Fortschrittsanzeige. |
| `./web-app/src/components/ui/alert/` | Alert-Box für Meldungen (destructive/default). |
| `./web-app/src/components/ui/separator/` | Visuelle Trennlinie (horizontal/vertikal). |
| `./web-app/src/components/ui/badge/` | Badge/Tag-Komponente für Labels. |
| `./web-app/src/components/ui/HelpIcon.vue` | Kleines Tooltip-Icon mit Hilfetext. |
| `./web-app/src/components/ui/ToolBtn.vue` | Icon-Button für Toolbar-Aktionen. |
| `./web-app/src/components/ui/SidebarBtn.vue` | Adaptive Button-Komponente für Sidebar und horizontale Ribbon-Toolbar (icon-only oder mit Label); zeigt bei gesetztem `title` automatisch ein Tooltip. |
| `./web-app/src/components/ui/PanelBtn.vue` | Kleine Button-Komponente für Panel-Aktionen. |
