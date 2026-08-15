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
| `./dev.sh` | Startet Server + Web-App lokal für Entwicklung. |
| `./README.md` | Projekt-Übersicht, Features und Installation (Bare-Metal/Docker) mit E-Mail-basiertem Admin-Login. |
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
| `./Dev-Server-App/LuxStageMenu.swift` | macOS-Menüleisten-App; startet/stoppt Dev-Server via `dev.sh`. |
| `./Dev-Server-App/LuxStageMenu` | Kompilierte macOS-Executable der Menüleisten-App. |
| `./docs/saas-betrieb.md` | Dokumentation für Multi-Mandanten-SaaS-Betrieb. |
| `./docs/deploy-cx43.md` | Deployment-Anleitung für Hetzner-CX43-Server. |
| `./shared/locales/de.json` | Übersetzungen für deutsche Oberfläche. |
| `./shared/locales/en.json` | Übersetzungen für englische Oberfläche. |
| `./shared/filters.json` | Farbfilter-Datenbank (Lee, Rosco etc.) mit Hex-Codes. |
| `./shared/constants.js` | Gemeinsame Konstanten für Server und Web-App (z. B. `PASSWORD_MIN_LENGTH`). |

## server/ (Node.js Backend)

| Datei | Beschreibung |
|---|---|
| `./server/index.js` | HTTP-Server-Einstieg mit CORS, Security-Headern und Job-Starter. |
| `./server/router.js` | HTTP-Router für API-Endpunkte und Datei-Serving; öffentliche API-Ausnahmen sind an Methode und Pfad gebunden, API- und Show-Unterressourcen laufen über geordnete Handler-Listen. |
| `./server/config.js` | Lädt Umgebungsvariablen und Konfigurationsdefaults, einschließlich explizitem Reverse-Proxy-Vertrauen. |
| `./server/bootstrap.js` | Einmaliges Setup-Skript; legt den ersten Admin an (Login = `ADMIN_EMAIL`). |
| `./server/db.js` | Re-Export der Datenbank-Funktionen aus `db/index.js`. |
| `./server/db-init.js` | Datenbankverbindung und Schema-Initialisierung. |
| `./server/db-context.js` | Request-gebundener DB-Kontext für Multi-Tenancy (AsyncLocalStorage). |
| `./server/auth.js` | JWT-Token, Passwort-Hashing und kurzlebige Download-Token-Verwaltung; Cleanup-Timer blockiert keine Einmalprozesse. |
| `./server/helpers.js` | Utility-Funktionen für Body-Parsing, JSON, Fehlerbehandlung. |
| `./server/history.js` | Periodische Snapshots von Show-State zur Versionierung; sichert vor dem Wiederherstellen den aktuellen Stand. |
| `./server/backup.js` | ZIP-basierte Backup- und Wiederherstellungsfunktionen mit request-isoliertem Staging, Restore-Lock, Rollback und Grenzen für ZIP-Einträge sowie entpackte Daten. |
| `./server/photos.js` | Gestreamter Foto-Upload mit Gesamt-, Datei- und Dateianzahlgrenzen, Skalierung und Thumbnail-Generierung. |
| `./server/floorplan.js` | Grundrissbild-Verwaltung mit Format-Validierung. |
| `./server/pdf.js` | PDF-Export für Einleuchtpläne mit Filter-Farbcodierung, inkl. Punktzug-Sonderlayout, Traverse-Innen/Außen-Kennzeichnung und Referrer-Schutz. |
| `./server/sse.js` | Server-Sent Events für Echtzeit-Kanal-Updates und Präsenz, pro Mandant gescopt; Heartbeat blockiert keine Einmalprozesse. |
| `./server/email.js` | SMTP-Konfiguration und Email-Versand mit Fallback-Support. |
| `./server/package.json` | NPM-Abhängigkeiten (sqlite, pdfkit, sharp, bcrypt, jwt). |
| `./server/test/helpers/test-env.js` | Isolierte Testumgebung mit temporärem Datenpfad und HTTP-Response-Stub für Backend-Tests. |
| `./server/test/register.test.js` | Regressionstests für atomare SaaS-Registrierungsbestätigung und Cleanup bei Registry-Konflikten. |
| `./server/test/router.test.js` | Regressionstests für öffentliche API-Methoden und Authentifizierungsgrenzen des HTTP-Routers. |
| `./server/test/photos.test.js` | Regressionstest für gestreamtes Multipart-Staging und garantiertes Cleanup temporärer Foto-Uploads. |
| `./server/test/tenant-backup.test.js` | Regressionstests für Tenant-Snapshot-Restore und Rollback bei fehlgeschlagener Aktivierung. |
| `./server/.env` | Server-Development-Umgebungsvariablen. |
| `./server/saas.js` | Kapsel für SaaS-Funktionalität, lädt Module nur im SaaS-Modus. |
| `./server/registry.js` | Zentrale Registrierung für Mandantenverzeichnis und Doppel-Opt-In; aktiviert Tenant-Eintrag und verbraucht Bestätigungslink atomar. |
| `./server/tenants.js` | Mandantenverzeichnis mit separaten SQLite-DBs pro Kunde und Kompensation fehlgeschlagener Registrierungen. |
| `./server/tenant-resolve.js` | Host-Header-Parsing für Subdomain-basierte Mandantenauflösung. |
| `./server/tenant-backup.js` | Tägliche Snapshots pro Mandant mit Retention-Policy; sichert vor Restore den Ist-Zustand und aktiviert Snapshots per rückrollbarem DB-Swap. |
| `./server/operator.js` | Separater Admin-Login für Betreiber-Panel mit JWT. |
| `./server/operator-panel.html` | HTML-UI für Betreiber-Panel zur Mandantenverwaltung. |
| `./server/operator-panel.js` | Client-Skript für Betreiber-Panel (ausgelagert wg. CSP `script-src 'self'`). |

### server/db/ (Datenbankzugriff)

| Datei | Beschreibung |
|---|---|
| `./server/db/index.js` | Barrel-Export aller DB-Module. |
| `./server/db/shows.js` | DB-Zugriff für Shows-Tabelle (Erstellen, Lesen, Archivieren, Löschen). |
| `./server/db/users.js` | DB-Zugriff für Benutzer und Passwort-Reset-Tokens. |
| `./server/db/channels.js` | DB-Zugriff für Kanäle-Tabelle und Beleuchtungs-Checks. |
| `./server/db/bars.js` | DB-Zugriff für Obermaschinerie-Elemente (Zugstange/Traverse/Punktzug via bar_type) und deren Befestigungen (Fixtures). |
| `./server/db/towers.js` | DB-Zugriff für Show-Türme und deren Slots. |
| `./server/db/sections.js` | DB-Zugriff für Show-Sections und deren Definitionen. |
| `./server/db/photos.js` | DB-Zugriff für Fotos, Beschreibungen, Reihenfolge, Channel-Fotos. |
| `./server/db/floorplan.js` | DB-Zugriff für Template- und Show-Grundrisse (Bilder, Canvas-Daten). |
| `./server/db/templates.js` | DB-Zugriff für Spielort-Vorlagen und deren Komponenten (Kanäle, Bars, Towers). |
| `./server/db/locks.js` | DB-Zugriff für Bearbeitungs-Sperren (Optimistic Locking). |

### server/routes/ (API-Endpunkte)

| Datei | Beschreibung |
|---|---|
| `./server/routes/shows.js` | API-Routen für Shows (CRUD, Lock, Events, Templates). |
| `./server/routes/auth.js` | API-Routen für Login, Passwort-Änderung, Passwort-Reset sowie begrenztes IP-Rate-Limiting. |
| `./server/routes/users.js` | API-Routen für Benutzer-Verwaltung und Preferences. |
| `./server/routes/register.js` | API-Routen für Self-Service-Registrierung (Double Opt-In). |
| `./server/routes/channels.js` | API-Routen für Kanäle und Beleuchtungs-Checks. |
| `./server/routes/bars.js` | API-Routen für Obermaschinerie-Elemente, Fixtures (inkl. side/positionText), Reordering. |
| `./server/routes/towers.js` | API-Routen für Show-Türme, Slots, Restore. |
| `./server/routes/sections.js` | API-Routen für Show-Sections und deren Definitionen. |
| `./server/routes/photos.js` | API-Routen für Foto-Upload, Beschreibungen, Channel-Fotos. |
| `./server/routes/floorplan.js` | API-Routen für Show- und Template-Grundrisse (Bilder, Snapshots). |
| `./server/routes/templates.js` | API-Routen für Spielort-Vorlagen (Kanäle, Sections, Bars, Towers). |
| `./server/routes/history.js` | API-Routen für Show-Verlauf und Snapshot-Restore. |
| `./server/routes/pdf.js` | API-Route für PDF-Export von Shows. |
| `./server/routes/display.js` | API-Routen für Anzeige-Einstellungen (Maßeinheiten). |
| `./server/routes/system.js` | API-Routen für System-Status, Health-Check, Backup, Restore. |
| `./server/routes/update.js` | API-Routen für Versions-Check und Server-Update; entpackt Release-ZIP streamend, spart Infrastruktur-Dateien aus, sichert den Stand vorher und macht bei Fehlschlag (npm install, Modul-Rauchtest) automatisch ein Rollback. |
| `./server/routes/smtp.js` | API-Routen für SMTP-Konfiguration und Test-E-Mails. |
| `./server/routes/operator.js` | API-Routen für Betreiber-Panel (Mandanten-Verwaltung). |

## web-app/ (Vue 3 + TypeScript Frontend, Vite)

| Datei | Beschreibung |
|---|---|
| `./web-app/index.html` | HTML-Entry-Point der Vue-Web-App. |
| `./web-app/vite.config.js` | Vite-Build-Konfiguration; Code-Splitting, Proxy zum Server. |
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
| `./web-app/src/App.vue` | Root-Komponente: TolgeeProvider, Sidebar, Top-Bar, Routing, globale Dialoge und Status-Updates. |
| `./web-app/src/style.css` | Tailwind, Theme-Variablen, Print-Styles für Tabellen und Foto-Galerien. |
| `./web-app/src/router/index.ts` | Vue Router mit Auth-Guards, Admin-Checks und Route-Definitionen. |

### web-app/src/composables/ (Vue Composition-API-Logik)

| Datei | Beschreibung |
|---|---|
| `./web-app/src/composables/useContainerWidth.ts` | Misst Container-Breite und reagiert responsiv auf Größenänderungen. |
| `./web-app/src/composables/useConfirm.ts` | Verwaltet globale Bestätigungsdialoge mit Promises. |
| `./web-app/src/composables/useShowNav.js` | Stellt Navigationselement-State zwischen Komponenten bereit. |
| `./web-app/src/composables/useDragReorder.ts` | Ermöglicht Drag-and-Drop-Sortierung von Listen-Items. |
| `./web-app/src/composables/useMeasureUnit.ts` | Konvertiert zwischen Maßeinheiten (m, cm, mm) mit Speicherung. |
| `./web-app/src/composables/useKeyboardNav.ts` | Navigiert Tabellen mit Tab, Enter und Pfeiltasten. |
| `./web-app/src/composables/useUpdateCheck.ts` | Speichert globalen Zustand der Verfügbarkeit von Updates. |
| `./web-app/src/composables/useShowFloorplan.ts` | Lädt und speichert Grundriss-Daten und Bilder pro Show. |
| `./web-app/src/composables/useTokenRefresh.ts` | Erneuert JWT-Token automatisch vor Ablauf. |
| `./web-app/src/composables/useShowChannels.ts` | Verwaltet Kanäle mit Undo/Redo, Suche, Filter und EOS-Import. |
| `./web-app/src/composables/useShowTabs.js` | Verwaltet Show-Tab-, Subtab- und Sitzungs-Persistenz inklusive Timeout und validiert verfügbare Aufbau-Tabs. |
| `./web-app/src/composables/useTemplateInsertion.js` | Verwaltet Auswahl, Einfügen und Speichern von Bar-/Turm-Vorlagen für eine Show. |
| `./web-app/src/composables/useLocale.ts` | Kompatibilitäts-Bridge auf @tolgee/vue; bestehende t(key)-Aufrufe laufen jetzt über Tolgee. |
| `./web-app/src/composables/usePhotoSettings.ts` | Speichert Benutzereinstellung für Fotos pro Seite. |
| `./web-app/src/composables/useShowSections.ts` | Lädt und speichert benutzerdefinierte Abschnitte pro Show. |
| `./web-app/src/composables/useBreakpoint.ts` | Erkennt Bildschirmgröße via MediaQueryList-Listener. |
| `./web-app/src/composables/floorplan/useFloorplanState.ts` | Aktuell leer (Platzhalter, ungenutzt). |
| `./web-app/src/composables/useShowPresence.ts` | Verfolgt anwesende Benutzer über Server-Sent Events. |
| `./web-app/src/composables/useShowHistory.js` | Verwaltet Öffnen und Wiederherstellen des Show-Versionsverlaufs inklusive Daten-Reload. |
| `./web-app/src/composables/useShowTowers.ts` | Verwaltet Türme (Lichtstative) mit Slot-Zuweisungen. |
| `./web-app/src/composables/useShowPhotos.ts` | Lädt Fotos-Liste pro Show. |
| `./web-app/src/composables/useUndoRedo.ts` | Allgemeines speicherinternes Undo/Redo mit Focus-Tracking für die aktuelle Show-Sitzung. |
| `./web-app/src/composables/useShowBars.ts` | Verwaltet Obermaschinerie-Elemente mit Fixtures (inkl. side/positionText) und Kanal-Zuordnungen. |

### web-app/src/utils/

| Datei | Beschreibung |
|---|---|
| `./web-app/src/utils/generateHangerei.ts` | Generiert formatierte Textlisten für Bars und Towers. |
| `./web-app/src/utils/uuid.ts` | Erzeugt UUIDs mit Fallback für Non-Secure-Context. |
| `./web-app/src/utils/templateName.ts` | Entfernt `.csv`-Suffix und ersetzt Bindestriche in Namen. |
| `./web-app/src/utils/index.ts` | Exportiert `cn()`-Utility für Tailwind/clsx Klassenkombination. |
| `./web-app/src/utils/filterColors.ts` | Normalisiert und validiert Filterfarben-Codes (Lee/Rosco). |

### web-app/src/api/ (HTTP-Client-Layer zum Server)

| Datei | Beschreibung |
|---|---|
| `./web-app/src/api/client.ts` | Typisierter HTTP-Client mit einheitlicher Auth-, Fehler-, Download- und SSE-Verwaltung. |
| `./web-app/src/api/jwtDecode.ts` | Dekodiert JWT-Payload ohne externe Abhängigkeit. |
| `./web-app/src/api/cache.ts` | Einfacher In-Memory-Cache mit TTL-Support. |
| `./web-app/src/api/shows.ts` | CRUD-API für Shows, Meta-Daten, History und Snapshots. |
| `./web-app/src/api/channels.ts` | CRUD und CSV-Im-/Export für Kanäle, Merging-Logik. |
| `./web-app/src/api/bars.ts` | Verwaltet Obermaschinerie-Elemente (Zugstange/Traverse/Punktzug), Fixtures und deren Reihenfolge. |
| `./web-app/src/api/towers.ts` | CRUD-API für Lichtstative und Slot-Zuweisungen. |
| `./web-app/src/api/sections.ts` | Lädt/speichert benutzerdefinierte Abschnitte für Shows und Templates. |
| `./web-app/src/api/photos.ts` | Lädt, hochladen, löscht Fotos mit Progress-Tracking. |
| `./web-app/src/api/floorplan.ts` | Speichert/lädt Grundriss-Canvas-Daten und Bilder. |
| `./web-app/src/api/templates.ts` | Verwaltet Templates (Vorlagen) mit Anwendungs- und Upload-Funktionen. |
| `./web-app/src/api/templateBars.ts` | CRUD-API für Bars in Vorlagen. |
| `./web-app/src/api/templateTowers.ts` | CRUD-API für Towers in Vorlagen mit Slot-Verwaltung. |
| `./web-app/src/api/backup.ts` | Backup-Download und Restore-Upload mit ZIP-Format. |

### web-app/src/views/ (Seiten/Routen)

| Datei | Beschreibung |
|---|---|
| `./web-app/src/views/LoginView.vue` | Anmeldung mit E-Mail und Passwort. |
| `./web-app/src/views/RegisterView.vue` | Team-Registrierung mit E-Mail-Bestätigung. |
| `./web-app/src/views/ConfirmView.vue` | Bestätigung der Team-Registrierung via E-Mail-Link. |
| `./web-app/src/views/ForgotPasswordView.vue` | Passwort-Zurücksetzen anfordern per E-Mail. |
| `./web-app/src/views/ResetPasswordView.vue` | Passwort-Zurücksetzen nach E-Mail-Link. |
| `./web-app/src/views/ShowsView.vue` | Übersicht aller Produktionen mit Sortierung und Erstellung. |
| `./web-app/src/views/ShowDetailView.vue` | Hauptansicht einer Show mit Kanaltabelle und Editoren. |
| `./web-app/src/views/ArchiveView.vue` | Anzeige und Verwaltung archivierter Produktionen mit Wiederherstellung. |
| `./web-app/src/views/TemplatesView.vue` | Erstellung, Bearbeitung, Upload von Beleuchtungs-Vorlagen. |
| `./web-app/src/views/SettingsView.vue` | Sub-Navigation zu verschiedenen Einstellungsbereichen. |
| `./web-app/src/views/settings/AccountView.vue` | Passwort-Änderung, Druckeinstellungen, Abmelden. |
| `./web-app/src/views/settings/UsersView.vue` | Benutzerverwaltung, Rollen, Passwort-Reset für Admin. |
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
| `./web-app/src/components/FloorplanEditor.vue` | Interaktiver Zeichnungseditor mit Drag-Drop für Kanäle, Gestelle, Stangen und Formen. |
| `./web-app/src/components/ColorAutocomplete.vue` | Farbfilter-Autocomplete mit Lee- und Rosco-Codes und Vorschau. |
| `./web-app/src/components/show/ShowHeader.vue` | Titel-Editor, Show-Metadaten, Import/Export (EOS, CSV, PDF) und Verlauf. |
| `./web-app/src/components/show/ShowActionBar.vue` | Undo/Redo, Live-Präsenz-Avatare mit zeitbasierter Aktivitätsanzeige und Kanal-Datenqualitäts-Badges oben. |
| `./web-app/src/components/show/ShowHealthBadge.vue` | Dropdown-Anzeige fehlender Geräte-, Positions-, Noten- und Adressdaten in Kanälen. |
| `./web-app/src/components/show/PhotoGallery.vue` | Fotogalerie mit Upload, Beschriftungen, Kanalnummern und Lightbox-Vorschau. |
| `./web-app/src/components/show/HistorySlideOver.vue` | Snapshots älterer Kanalkonfigurationen zum Durchsuchen und Wiederherstellen; behandelt Ladefehler und verwirft veraltete Antworten nach dem Schließen. |
| `./web-app/src/components/show/ZugstangenView.vue` | Drag-Drop-Liste für Obermaschinerie-Elemente (Zugstange/Traverse/Punktzug, per Typ-Filter und -Auswahl) mit Scheinwerfer-Positionen und Vorlagen. |
| `./web-app/src/components/show/SectionEditor.vue` | Bearbeitbare Markdown- oder Tabellen-Abschnitte mit Drag-Drop, komponentenlokalen KV-Table-Refs und Migrations-Fallback. |
| `./web-app/src/components/show/GassenturmView.vue` | Beleuchtungsgestelle mit Slots und Kanalbelegung, Vorlagen und Drag-Drop. |
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
| `./web-app/src/components/ui/SidebarBtn.vue` | Adaptive Button-Komponente für Sidebar und horizontale Ribbon-Toolbar (icon-only oder mit Label). |
| `./web-app/src/components/ui/PanelBtn.vue` | Kleine Button-Komponente für Panel-Aktionen. |
