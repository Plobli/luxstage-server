# Findings-Backlog (Ermessensfragen)

Für Fragen ohne deterministischen Maßstab — siehe `audits/README.md`. Ein
Review trägt hier neue Punkte ein oder aktualisiert den Status bestehender;
es schreibt nie einen neuen Gesamtbericht. Punkte bleiben nach Erledigung
stehen (mit Datum/Commit), damit die Historie nachvollziehbar ist.

Format pro Eintrag: Titel, Quelle (welcher Audit/Review), Importance (1-10,
subjektiv — dient nur der Priorisierung untereinander, kein absoluter Wert),
Status, Beschreibung, Remediation.

Nach der Abarbeitung eines jeden offenen Punktes einen commit machen.

---

## Offen

### API-Client-Schicht (`web-app/src/api/*.ts`) durchgängig mit `any`/`Promise<any>` typisiert
- **Quelle**: design-quality-review-2026-09-06
- **Importance**: 5/10
- **Status**: offen
- 55 Vorkommen von `any`/`Promise<any>`/`as any` über 14 Dateien in
  `web-app/src/api/` (`grep -rn ": any\b\|Promise<any>\|<any>\|as any\b"
  api/` → 55 Treffer, u.a. `client.ts`, `shows.ts`, `channels.ts`,
  `floorplan.ts`, `templates.ts`, `sections.ts`, `photos.ts`, `smtp.ts`,
  `users.ts`, `backup.ts`, `auth.ts`). Das ist genau die Grenze, an der
  TypeScript den größten Nutzen hätte: jede dieser Funktionen ist die
  einzige Typ-Schnittstelle zwischen Backend-Response und den aufrufenden
  Vue-Komponenten/Composables. Konkrete Beispiele:
  - `api/client.ts:28`: `ApiError`s `body: any = null` — jeder
    Error-Handling-Code, der auf `e.body.lockedBy`/`e.body.since` zugreift
    (z.B. `useResourceLock.ts:56`, `useShowLock.ts`), tut das ohne jede
    Typprüfung; ein Tippfehler im Feldnamen fällt erst zur Laufzeit auf.
  - `api/shows.ts:27-28,57-59`: SSE-Callback-Payloads (`onLockStatus`,
    `onTakeoverRequested`, `onPresence`) sind `any` bzw. `(e: any) => ...`
    — obwohl die Shapes durch den Server exakt vorgegeben sind
    (`{ lockedBy, since }` etc.).
  - `api/shows.ts:90-140`: praktisch jede exportierte Funktion
    (`fetchShows`, `createShow`, `updateMeta`, `fetchHistory`, ...) hat
    `Promise<any>`/`Promise<any[]>` als Rückgabetyp — ein Refactoring der
    Server-Antwortform (z.B. Feld umbenennen) wird vom Compiler an keiner
    einzigen Aufrufstelle im Frontend erkannt.
  - `api/channels.ts:10`: `[key: string]: any` als Index-Signatur für den
    Channel-Typ selbst, das zentrale Datenmodell der App.
  - `api/floorplan.ts`: alle 8 exportierten Funktionen `Promise<any>`.
  Das Projekt hat bereits eine geteilte Typdeklarationsdatei
  (`web-app/src/shared.d.ts`, genutzt u.a. für `contrastColor()` aus
  `@shared/color.js`) — die Infrastruktur für echte Typen an dieser Grenze
  existiert also schon, wird hier aber nicht genutzt.
- **Remediation**: Schrittweise echte Interfaces für die häufigsten
  Response-Shapes einführen (`Show`, `Channel`, `HistoryEntry`,
  `LockStatus`, `FloorplanData`, ...) statt `any` — am wertvollsten zuerst
  dort, wo mehrere Aufrufer existieren (`shows.ts`, `channels.ts`) und bei
  SSE-Callback-Payloads (`onLockStatus`/`onTakeoverRequested`/`onPresence`),
  da deren Shape bereits serverseitig feststeht und sich leicht als
  Interface in `shared.d.ts` oder einer neuen `api/types.ts` festhalten
  lässt. Kein Big-Bang nötig — jede einzelne Funktion kann unabhängig
  typisiert werden, ohne die anderen zu berühren.

### Undo/Redo-Ausführung ist keine einzige Transaktion — Crash zwischen den Schritten hinterlässt inkonsistenten Stack
- **Quelle**: business-logic-review-2026-09-06
- **Importance**: 6/10
- **Status**: offen
- `handleUndoRedo()` (`server/routes/undo-redo.js:20-41`) führt die
  Undo/Redo-Sequenz als fünf unabhängige, nicht in eine gemeinsame
  SQLite-Transaktion gefasste Schritte aus: `getEntry()` → `readState()` →
  `writeState(targetState)` (Zeile 36) → `consumeEntry(entry)` (Zeile 37) →
  `pushOpposite(currentState)` (Zeile 38). Jeder einzelne Schritt ist zwar für
  sich transaktional (`writeFullShowState`/`recordSnapshot` nutzen intern
  `getDb().transaction()`), aber zwischen den Schritten liegt kein
  gemeinsames Transaktionsdach. Konkretes Szenario: Server stürzt ab (OOM,
  PM2-Neustart durch Deploy, unbehandelte Exception in einem der
  `broadcast`-Aufrufe direkt danach) unmittelbar nach `writeState(targetState)`
  in Zeile 36, aber bevor `consumeEntry(op)` in Zeile 37 den
  `operations`-Eintrag löscht. Nach Neustart zeigt die Show bereits den
  wiederhergestellten (alten) Zustand, aber `getLastOperation(show.id)`
  liefert beim nächsten Undo-Klick weiterhin denselben, jetzt bereits
  konsumierten Snapshot zurück — ein zweites Undo wendet denselben Snapshot
  nochmal an, obwohl der tatsächliche "davor"-Zustand (durch zwischenzeitliche
  Bearbeitung) längst ein anderer sein kann. Ebenso: Crash zwischen
  `consumeEntry()` (Zeile 37) und `pushOpposite()` (Zeile 38) löscht den
  Undo-Eintrag korrekt, befüllt aber nie den Redo-Stack — der Nutzer verliert
  kommentarlos die Möglichkeit, die gerade rückgängig gemachte Aktion wieder
  herzustellen. Der Hash-Check in Zeile 29 (`computeHash(targetState) !==
  entry.hash`) schützt nur die Integrität des Snapshots selbst, nicht die
  Konsistenz der Gesamtsequenz Undo-Anwendung → Stack-Aktualisierung.
- **Remediation**: `handleUndoRedo()` (bzw. die aufrufenden Stellen in
  `routes/shows.js`) in eine einzige `getDb().transaction()` fassen, die
  `readState`, `writeState`, `consumeEntry` und `pushOpposite` atomar
  ausführt — analog zum bereits vorhandenen Muster in `undo-stack.js`s
  `withSnapshot()`. `broadcast()` bewusst außerhalb der Transaktion belassen
  (SSE-Broadcast ist kein DB-Schreibvorgang und soll einen erfolgreichen
  Commit nicht blockieren).

### `saveShowItemsToTemplate` erzeugt doppelte Template-Bars/-Towers bei Namenskollision statt zu aktualisieren
- **Quelle**: business-logic-review-2026-09-06
- **Importance**: 5/10
- **Status**: offen
- `applyBarsToTemplate()` und `applyTowersToTemplate()`
  (`server/db/template-save-from-show.js:9-56` bzw. `:58-98`) bauen die
  Dedupliziertions-Map `tplBarByName`/`tplTowerByName` (Zeile 13 bzw. 62)
  **einmal vor** der Schleife aus dem bereits in der DB vorhandenen
  Template-Bestand auf und aktualisieren diese Map innerhalb der Schleife nie
  mit neu eingefügten Einträgen. `bars.name`/`towers.name`
  (`server/db/migrations/012-bars.js:13`, `010-towers.js:13`) haben keine
  UNIQUE-Constraint — zwei Bars derselben Show können also denselben Namen
  tragen (z.B. durch Nutzerfehler beim manuellen Umbenennen). Konkretes
  Szenario: Show "Sommerkonzert" hat zwei Bars, beide fälschlich "Zugstange 1"
  genannt (unterschiedliche `id`s), keiner davon existiert im Ziel-Template
  bisher. Ein `POST /api/shows/sommerkonzert/to-template` mit `scope: 'bars'`
  und `selectedIds: [bar1.id, bar2.id]` (technisch möglich — der
  Route-Handler in `server/routes/shows.js:104-124` validiert `selectedIds`
  nur als Array, keine Eindeutigkeits- oder Namensprüfung) läuft beide Male
  durch den `else`-Zweig (Zeile 25-29 in template-save-from-show.js), weil
  `tplBarByName.has('Zugstange 1')` beim zweiten Durchlauf immer noch `false`
  ist — es entstehen zwei separate `template_bars`-Zeilen mit identischem
  Namen `'Zugstange 1'`. Bei einem späteren `applyBars()`
  (`template-apply-to-show.js:56-91`, `existingByName`-Deduplizierung nach
  Namen) wird beim Anwenden dieses Templates auf eine neue Show nur einer der
  beiden Duplikate berücksichtigt (Zeile 65: `if
  (!existingByName.has(tb.name))`), der andere bleibt dauerhaft als
  unerreichbare Karteileiche im Template stehen. Zusätzlich verstärkt
  `overrideName` (`server/routes/shows.js:113`,
  `template-save-from-show.js:19`/`:68`) dasselbe Problem: der Server
  erzwingt nicht, dass `overrideName` nur bei genau einem Element in
  `selectedIds` gesetzt werden darf — bei mehreren ausgewählten Bars/Towers
  mit demselben `overrideName` entstehen ebenfalls mehrere Template-Einträge
  mit identischem Namen (aktuell nur über direkten API-Aufruf erreichbar, da
  das Frontend `useTemplateInsertion.js:60-67` `overrideName` nur mit einem
  einzelnen `[tower.id]`/`[bar.id]` sendet — das serverseitige Invariant
  fehlt aber unabhängig vom Frontend-Verhalten).
- **Remediation**: In beiden Funktionen die Map nach jedem Insert
  aktualisieren (`tplBarByName.set(barName, { id: tplBarId })` bzw. analog für
  Towers), damit Duplikate innerhalb desselben Aufrufs zusammengeführt statt
  neu angelegt werden. Zusätzlich in `saveShowItemsToTemplate()` (bzw. im
  Route-Handler `server/routes/shows.js:104-124`) `overrideName` nur
  akzeptieren, wenn `selectedIds.length === 1` ist — sonst 400 zurückgeben.

---

## Erledigt

### Kein Graceful Shutdown bei SIGTERM/SIGINT — laufende Requests, SSE-Verbindungen und Mandanten-DB-Handles werden hart gekappt
- **Quelle**: resilience-review-2026-09-06
- **Erledigt**: 2026-09-06
- `process.on('SIGINT'/'SIGTERM', () => process.exit(0))` beendete den
  Prozess sofort ohne Drain — jedes PM2-Deployment (jeder `pm2 restart`)
  sendet SIGTERM, kappte damit laufende Foto-/Backup-Uploads, offene
  SSE-Verbindungen und Tenant-DB-Handles hart.
- **Remediation**: `gracefulShutdown()` in `server/index.js`: `server.close()`
  (nimmt keine neuen Verbindungen mehr an, lässt laufende zu Ende laufen),
  15s-Timeout als harte Obergrenze (unterhalb PM2s Default-`kill_timeout`),
  danach `process.exit(0)`. Neue Funktion `closeAllConnections()`
  (`server/sse.js`) benachrichtigt offene SSE-Clients mit einem
  `server-shutdown`-Event und beendet sie, statt sie dem Reconnect-Timeout zu
  überlassen. Neue Funktion `closeAllTenantDbs()` (`server/tenants.js`)
  schließt beim Shutdown alle offenen Mandanten-DB-Verbindungen (SaaS-Modus);
  im Self-Hosted-Modus wird die globale DB-Verbindung geschlossen. Tests in
  `server/test/sse.test.js` und `server/test/tenants-lru.test.js` für die
  beiden neuen Helper-Funktionen. Der Signal-Handler selbst wurde manuell
  per In-Prozess-`process.emit('SIGTERM')` verifiziert (Windows liefert
  `SIGTERM`/`SIGINT` an Kindprozesse nicht zuverlässig zu, ein
  Kindprozess-Test war deshalb auf der Entwicklungsumgebung nicht möglich —
  das Produktions-Deployment läuft laut `install.sh` unter Linux/PM2, wo
  echte POSIX-Signale zugestellt werden).

### Ungefilterter Snapshot-Name im `Content-Disposition`-Header des Operator-Backup-Downloads
- **Quelle**: security-review-2026-09-06
- **Erledigt**: 2026-09-06
- `GET /api/operator/tenants/:id/backups/:name/download` interpolierte den
  Snapshot-Namen ungefiltert in den `Content-Disposition`-Header —
  `snapshotPath()` prüft nur `/`, `..` und `.db`-Suffix, nicht `"`/`\r`/`\n`.
  Analog zum bereits behobenen `pdfFilename()`-Finding, das diesen Pfad aber
  nicht abdeckte. Praktisch nur betreiberseitig relevant (Snapshot-Namen sind
  serverseitig generierte ISO-Zeitstempel), aber `snapshotPath()` selbst
  verlässt sich nicht darauf.
- **Remediation**: Neue exportierte Funktion
  `safeContentDispositionFilename()` (`server/routes/operator.js`, analog zum
  Sanitizing in `pdfFilename()`) entfernt `"`/`\r`/`\n` vor Interpolation in
  den Header. Tests in `server/test/operator-login.test.js`: Unit-Test der
  Funktion direkt (da `"`/`\r`/`\n` unter Windows/NTFS keine gültigen
  Dateizeichen sind und ein dateibasierter End-to-End-Test mit dem realen
  Angriffsstring deshalb plattformabhängig gescheitert wäre) plus
  Integrationstest des echten Download-Endpunkts mit einem regulären
  Snapshot-Namen.

### Keine automatisierte Dependency-Schwachstellenprüfung in CI
- **Quelle**: codebase-quality-security-review-2026-09-06
- **Erledigt**: 2026-09-06
- Kein `npm audit`-Job in CI — 34 bekannte Schwachstellen (5 High: sharp/
  libvips, nodemailer CRLF-Injection & SSRF-Bypass, vite/fast-uri) waren
  unbemerkt im Dependency-Baum.
- **Remediation**: `sharp` 0.33→0.35, `nodemailer` 8→10 (Major, API in
  diesem Projekt nur über stabile Grundfunktionen genutzt — `sharp()`,
  `.rotate()`, `.metadata()`, `nodemailer.createTransport()` — keine
  Codeänderung nötig), `@tiptap/*`/`vite`/`fast-uri` Patch-Updates. `npm
  audit` meldet jetzt 0 Vulnerabilities. `npm audit --audit-level=high` als
  neuer Schritt in `.github/workflows/test.yml`, läuft bei jedem Push/PR vor
  der Testsuite. Volle Test-Suiten (Server 194 Tests, Web-App 119 Tests)
  nach dem Upgrade grün.

### Kein Health-Check-Endpoint für Uptime-Monitoring
- **Quelle**: codebase-quality-security-review-2026-09-06
- **Erledigt**: 2026-09-06 (bereits vorhanden, verifiziert)
- Vermuteter offener Punkt aus einer allgemeinen Codebase-Review-Frage. Gegen
  aktuellen Code geprüft: `GET /api/health` existiert bereits
  (`server/routes/system.js`, in `route-table.js` als `PUBLIC_ROUTES`-Eintrag
  ohne Auth erreichbar, liefert `{ ok: true }`), inkl. Test in
  `server/test/router.test.js`. Kein weiterer Handlungsbedarf — vom Nutzer
  bestätigt, dass Uptime Kuma bereits als externer Monitor betrieben wird und
  diesen Endpoint abfragen kann.

### Kein zentrales Error-Handling-Middleware-Pattern
- **Quelle**: codebase-quality-security-review-2026-09-06
- **Erledigt**: 2026-09-06 (bereits vorhanden, verifiziert)
- Vermuteter offener Punkt. Gegen aktuellen Code geprüft: `dispatchRoute()`
  (`server/router.js`) fängt bereits zentral jeden Handler-Fehler ab (500 +
  strukturiertes Log, `log.error('Unbehandelter Fehler', ...)`), ebenso der
  äußere `router()`-Try/Catch für alles außerhalb der API-Dispatch-Kette.
  Einzelne Routen fangen Fehler zusätzlich lokal ab, wo sie spezifischere
  Statuscodes brauchen (z.B. 409 bei Constraint-Verletzung), das zentrale
  Netz greift aber bereits als Fallback. Kein Handlungsbedarf.

### Verschlüsselungsschlüssel für Settings-at-Rest wurde aus JWT_SECRET abgeleitet
- **Quelle**: database-security-audit-2026-09-06
- **Erledigt**: 2026-09-06
- Der AES-256-GCM-Schlüssel für Secrets at Rest (z.B. SMTP-Passwort) wurde
  per HKDF direkt aus `JWT_SECRET` abgeleitet — ein Leak von `JWT_SECRET`
  hätte damit sowohl Session-Fälschung als auch die Entschlüsselung
  gespeicherter Secrets ermöglicht, obwohl beides eigentlich trennbare
  Vertrauensdomänen sind.
- **Remediation**: Neue optionale `SETTINGS_ENC_KEY`-Umgebungsvariable
  (`config.settingsEncKey`, Fallback auf `jwtSecret` für
  Rückwärtskompatibilität mit bestehenden Deployments/verschlüsselten
  Werten). `db/settings.js` leitet den AES-Schlüssel jetzt daraus ab statt
  aus `jwtSecret` direkt. Test in `server/test/settings-enc-key.test.js`.

### Kein expliziertes JSON-Nesting-Depth-Limit
- **Quelle**: api-and-infrastructure-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `readJsonBody` begrenzte die Body-Größe (1 MB), rief aber `JSON.parse()`
  ohne Tiefenlimit auf — innerhalb der 1-MB-Grenze war theoretisch sehr
  tiefe Verschachtelung möglich. Restrisiko wäre rekursive
  Downstream-Verarbeitung ohne eigenes Tiefenlimit gewesen.
- **Remediation**: Günstige Post-Parse-Tiefenprüfung (`exceedsMaxDepth()`,
  Grenze 50) in `readJsonBody()` ergänzt — lehnt übermäßig verschachteltes
  JSON mit 400 ab, bevor es an Downstream-Code weitergereicht wird. Grenze
  von 50 großzügig genug für jeden realistischen Editor-Inhalt (z.B.
  verschachtelte Tiptap-Listen). Tests in `server/test/helpers.test.js`
  (übermäßige Tiefe abgelehnt, realistische Tiefe weiterhin akzeptiert).

### Kein Refresh-Token-Mechanismus — Access-Token diente als eigenes "Refresh"
- **Quelle**: authentication-flow-review-2026-09-06
- **Erledigt**: 2026-09-06 (Kern-Empfehlung bereits durch vorherigen Fix abgedeckt)
- `/api/auth/refresh` signiert einfach ein neues 12h-Access-Token aus den
  Claims des aktuell gültigen Tokens neu — es gibt weiterhin kein separates
  Refresh-Token mit Rotation/Reuse-Detection (bewusster
  Einfachheits-Trade-off, kein Bug für sich). Der konkrete Risiko-Punkt war:
  ein gestohlenes Token hätte eine Passwort-Änderung (Aussperr-Versuch)
  potenziell unbegrenzt über rollierende 12h-Fenster überlebt.
- **Remediation**: Bereits durch den `token_version`-Fix
  ("Passwort-Änderung/-Reset invalidierte keine zuvor ausgestellten JWTs")
  gelöst, ohne separate Änderung nötig: `/api/auth/refresh` steht nicht in
  `PUBLIC_ROUTES`, läuft also durch `authenticate()` im Router — das lehnt
  ein Token mit veralteter `tokenVersion` bereits ab, bevor `req.user`
  gesetzt wird, `/api/auth/refresh` also erreichbar ist. Eine
  Passwort-Änderung beendet damit automatisch auch die Refresh-Fähigkeit
  gestohlener Tokens. Volle Rotation/Reuse-Detection für Refresh-Tokens
  bleibt ein bewusster Trade-off (siehe `## Bewusst zurückgestellt`), kein
  offener Punkt mehr.

### `POST /api/auth/reset-password/confirm` hatte kein dediziertes Rate-Limiting
- **Quelle**: initial-security-analysis-audit-2026-09-06
- **Erledigt**: 2026-09-06
- Anders als `forgot-password` war der Confirm-Schritt nur durch den
  generischen 300/60s-IP-Limiter begrenzt. Praktisches Risiko gering (Token
  ist ein 32-Byte-Zufallswert, Brute-Force rechnerisch unmöglich), aber
  Inkonsistenz gegenüber dem sonst durchgängigen Defense-in-Depth-Muster.
- **Remediation**: Denselben `isRateLimited`/`recordFailedLogin`-Limiter aus
  Konsistenzgründen ergänzt. Test in `server/test/auth.test.js` (11.
  Versuch blockiert).

### Login hatte Timing-Seitenkanal zur Username-Enumeration
- **Quelle**: authentication-flow-review-2026-09-06
- **Erledigt**: 2026-09-06
- `login()` gab bei nicht-existierendem Username sofort `null` zurück und
  übersprang den bcrypt-Vergleich vollständig, während ein existierender
  Username mit falschem Passwort einen vollen `bcrypt.compare` (Cost 12,
  ~100ms+) durchlief — trotz identischer Fehlermeldung ermöglichte die
  messbare Zeitdifferenz Username-Enumeration.
- **Remediation**: Bei nicht gefundenem User-Datensatz läuft jetzt ein
  Dummy-`bcrypt.compare` gegen einen fixen, zur Modul-Ladezeit
  vorberechneten Hash. Test in `server/test/auth.test.js` (misst, dass der
  unbekannte-Username-Pfad tatsächlich >50ms dauert und in derselben
  Größenordnung wie der Falsches-Passwort-Pfad liegt).

### Bestätigungs-Token bei Self-Registration wurde im Klartext gespeichert
- **Quelle**: authentication-flow-review-2026-09-06
- **Erledigt**: 2026-09-06
- Der Self-Registration-Confirm-Token wurde in `pending_registrations.token`
  im Klartext gespeichert — im Gegensatz zu Passwort-Reset-Tokens, die per
  SHA-256 gehasht abgelegt werden. Wirkung begrenzt (Registrierungs-Confirm
  erstellt nur einen Tenant + Erstnutzer für eine vom Angreifer bereits
  kontrollierte Email/Passwort-Kombination), aber Inkonsistenz zum sonst
  stärkeren Muster.
- **Remediation**: `addPending`/`getPending`/`confirmPending` in
  `registry.js` hashen den Token jetzt per SHA-256 vor Speicherung/Lookup.
  Nebenbefund beim Umsetzen: der Operator-"Resend"-Pfad
  (`routes/operator.js`) griff bisher direkt auf `row.token` zu, um ihn
  erneut in eine Bestätigungsmail einzubetten — mit Hashing (Einwegfunktion)
  ist der ursprüngliche Klartext nicht mehr verfügbar. Neue Funktion
  `refreshPendingToken()` erzeugt beim Resend einen frischen Token statt den
  alten wiederzuverwenden (der alte verliert dabei seine Gültigkeit, analog
  zum Passwort-Reset-Flow). Tests in `server/test/register.test.js`
  (Klartext nicht in der DB, `refreshPendingToken` invalidiert den alten
  Token).

### Show-Name wurde nicht vor Nutzung im `Content-Disposition`-Dateinamen bereinigt
- **Quelle**: file-handling-business-logic-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `pdfFilename(showName, blank)` interpolierte `show.name` direkt in einen
  gequoteten `Content-Disposition`-Dateinamen ohne Escaping von `"` und ohne
  Filterung von Steuerzeichen. Ein Show-Name mit eingebettetem Zeilenumbruch
  hätte den PDF-/Netzwerk-Export für diese Show dauerhaft gebrochen (Node
  lehnt `\r`/`\n` in Header-Werten mit `ERR_INVALID_CHAR` ab), ein Name mit
  `"` einen fehlerhaften Dateinamen im Download-Dialog erzeugt.
- **Remediation**: `pdfFilename()` entfernt CR/LF und `"` aus `showName` vor
  Interpolation. Tests in `server/test/pdf-generate.test.js`.

### Fehlende HSTS-/Permissions-Policy-Header auf Anwendungsebene, CSP ohne `frame-ancestors`
- **Quelle**: api-and-infrastructure-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `applySecurityHeaders` setzte nie `Strict-Transport-Security` oder
  `Permissions-Policy` — ein Deployment mit anderem Reverse-Proxy als Caddy
  hätte HSTS komplett ohne App-seitiges Fallback verloren. Die CSP hatte
  außerdem keine `frame-ancestors`-Direktive (funktional bereits durch
  `X-Frame-Options: DENY` abgedeckt, aber manche Scanner bemängeln das
  Fehlen trotzdem).
- **Remediation**: `applySecurityHeaders(res, isDev)` setzt jetzt HSTS
  (`max-age=31536000; includeSubDomains`, nur wenn `!isDev`, um lokale
  HTTP-Entwicklung nicht zu brechen) und eine minimale `Permissions-Policy`
  (Kamera/Mikrofon/Geolocation deaktiviert); `frame-ancestors 'none'` zur CSP
  ergänzt. `style-src 'unsafe-inline'` bewusst unverändert gelassen (Nonce-
  Migration bräuchte Frontend-Build-Änderungen, außerhalb dieses Scopes).
  Tests in `server/test/security-headers.test.js`.

### Circuit-Scan-Upload hatte keine echte Inhalts-/MIME-Verifikation
- **Quelle**: file-handling-business-logic-audit-2026-09-06
- **Erledigt**: 2026-09-06
- Anders als `photos.js` (re-encodiert per `sharp(...).jpeg()`) validierte
  der Circuit-Scan-Pfad nie, ob die hochgeladene Datei tatsächlich ein Bild
  ist — `mimeFromBuffer()` prüft nur 2-4 Magic-Bytes und fällt bei allem
  anderen still auf `image/jpeg` zurück. Garbage-Input wäre unnötig
  base64-kodiert an die Anthropic-Vision-API gesendet worden (verschwendete
  API-Kosten, unklare Fehlermeldung statt sauberem 400).
- **Remediation**: `analyzeCircuitScan()` prüft jetzt per
  `sharp(imageBuffer).metadata()`, ob der Buffer ein dekodierbares Bild ist,
  bevor der API-Call erfolgt — bei Wurf klare Fehlermeldung statt teurem
  Fehlschlag später. Tests in `server/test/circuit-scan.test.js` (echte
  minimale Bilddaten statt bloßer Magic-Bytes, neuer Fall für
  Nicht-Bild-Ablehnung ohne API-Call).

### `deleteFloorplanImage` fehlte der Traversal-Schutz der Schwesterfunktion
- **Quelle**: input-validation-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `deleteFloorplanImage(imagePath)` rief `fs.unlink`/`fs.rmdir` ohne
  `path.resolve` + Prefix-Check auf, anders als `serveFloorplanImage`. Aktuell
  nicht angreifbar (kein Endpunkt lässt `image_path` clientseitig setzen),
  aber Defense-in-Depth-Lücke.
- **Remediation**: Guard aus `serveFloorplanImage` in `deleteFloorplanImage`
  gespiegelt. Test in `server/test/floorplan.test.js` (regulärer Löschpfad
  funktioniert weiter, Traversal-Pfad wird ignoriert statt eine Datei
  außerhalb des Basisverzeichnisses zu löschen).

### Kein PM2-Log-Rotation konfiguriert — unbegrenztes Stdout/Stderr-Wachstum
- **Quelle**: logging-monitoring-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `install.sh` installierte nie `pm2-logrotate` — PM2 hängt standardmäßig
  jede Stdout-/Stderr-Zeile unbegrenzt an, auf einer kleinen Self-Hosted-Box
  ein langsames Disk-Exhaustion-Risiko.
- **Remediation**: `pm2 install pm2-logrotate` (max_size 10M, retain 14,
  compress) zu den PM2-Setup-Schritten in `install.sh` ergänzt, direkt nach
  `pm2 save`. Kein automatisierter Test möglich (Shell-Provisioning-Skript,
  braucht einen echten Server) — per `bash -n` auf Syntaxfehler geprüft.

### Backup/Restore-Operationen waren inkonsistent und ohne Akteur-Identität geloggt
- **Quelle**: logging-monitoring-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `streamBackup`/`restoreBackup` loggten nur bei Fehlschlag, per rohem
  `console.error(...)` (umgeht `logger.js` komplett). Für einen
  erfolgreichen Export/Restore gab es keine Log-Zeile, und keine erfasste,
  *wer* die Aktion ausgelöst hat — `routes/system.js` band `user` von
  `requireAuth`, reichte es aber nie an `backup.js` weiter.
- **Remediation**: `streamBackup(res, username)`/`restoreBackup(req, res,
  username)` nehmen jetzt den Akteur entgegen (von `routes/system.js`
  durchgereicht). `logger('backup')` ersetzt `console.error`: info bei
  Restore-Start und Export-/Restore-Abschluss, error bei Fehlschlag, jeweils
  mit `user`-Feld. Tests in `server/test/backup.test.js` (Log-Zeilen per
  `mock.method(console, 'log')` verifiziert).

### Cross-Tenant-Token-Wiederverwendung (403) war nicht identifizierbar geloggt
- **Quelle**: logging-monitoring-audit-2026-09-06
- **Erledigt**: 2026-09-06
- Bei `user.tenantId !== tenantId` (ein für einen Tenant ausgestelltes JWT
  gegen die Subdomain eines anderen Tenants verwendet) wurde mit 403
  abgelehnt, aber außer dem generischen Access-Log (dessen Closure vor
  Setzen von `req.user` gebaut wird) nichts erfasst — im Log nicht von
  anderen 403s zu unterscheiden.
- **Remediation**: `log.warn('Cross-Tenant-Tokenverwendung', { user,
  tokenTenant, hostTenant, ip })` vor dem 403-Return in `server/router.js`
  ergänzt. Kein dedizierter Test: der Pfad hängt am Multi-Tenant-SaaS-Modus
  (`BASE_DOMAIN` gesetzt), bestehende `router.test.js`-Tests laufen im
  Self-Hosted-Modus ohne Tenant-Kontext — ein echter Testaufbau bräuchte
  eine vollständige zweite Tenant-DB und Host-Header-Routing, unverhältnismäßig
  für eine reine Logging-Ergänzung (Importance 3/10). Bestehende
  Router-Tests bleiben grün (keine Regression).

### Registrierungs-Endpunkte hatten kein dediziertes Rate-Limiting
- **Quelle**: initial-security-analysis-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `POST /api/register` und `POST /api/self-register` lösen jeweils einen
  bcrypt-Hash (Cost 12) und eine ausgehende Mail aus, hatten aber keinen
  dedizierten Attempt-Limiter — nur der generische 300 Req/60s-Limiter
  griff, ein nennenswertes Budget für anhaltende bcrypt-CPU-Last bzw.
  Massen-Auslösen von Bestätigungsmails.
- **Remediation**: `createLoginRateLimiter()` (aus dem Operator-Login-Fix)
  auch für beide Endpunkte angewendet, jeweils mit eigenem Zähler-Store.
  Tests in `server/test/register.test.js` (11. Versuch blockiert).

### JWT-`verify()`-Aufrufe pinnten `algorithms` nicht explizit
- **Quelle**: authentication-flow-review-2026-09-06
- **Erledigt**: 2026-09-06
- `jwt.verify(token, config.jwtSecret)` lief ohne explizite
  `algorithms: ['HS256']`-Option — reine Hardening-Lücke (aktuell kein
  Alg-Confusion-Vektor, da `jwtSecret` ein symmetrischer String ist), aber
  relevant, falls je ein asymmetrischer Schlüsselpfad eingeführt wird.
- **Remediation**: `{ algorithms: ['HS256'] }` an beide verbleibenden
  `jwt.verify()`-Aufrufe (`server/auth.js`, `server/operator.js`) ergänzt
  (der dritte, im Query-String-Fallback, wurde bereits in einem vorherigen
  Fix entfernt). Bestehende Tests (`auth.test.js`, `operator-login.test.js`)
  bestätigen, dass Tokens weiterhin akzeptiert werden.

### `length_cm` (Bar-Länge) wurde vor Validierung in JS-Arithmetik verwendet — konnte Fixture-Positionen korrumpieren
- **Quelle**: input-validation-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `data.length_cm` floss ungeprüft in `scale = newLength / oldLength`, dessen
  Ergebnis als SQL-Parameter an `ROUND(position * ?, 1)` gebunden wurde. Bei
  `length_cm: 0` wurde `scale` zu `0` und **alle** `bar_fixtures.position`
  einer Bar wurden still auf `0` gesetzt.
- **Remediation**: `data.length_cm` in `writeBar()` (`server/db/bars.js`)
  wird jetzt vor Nutzung als endliche positive Zahl validiert
  (`Number.isFinite(...) && ... > 0`) — ein ungültiger Wert fällt auf die
  bisherige Länge zurück statt die Bar-Länge zu ändern oder die
  Rescale-Arithmetik mit `0`/`NaN` zu füttern. Tests in
  `server/test/bars-towers-routes.test.js` (`length_cm: 0`,
  nicht-numerischer String).

### Log-Injection über unbereinigten Snapshot-Namen im Operator-Panel-Log
- **Quelle**: logging-monitoring-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `console.log`/`console.error` interpolierten `body.name` (rohes
  JSON-Request-Feld) direkt als String — `restoreSnapshot()` lehnt `name`
  nur bei `/`, `..` oder fehlendem `.db`-Suffix ab, nie bei `\n`/`\r`. Ein
  Wert mit eingebettetem Zeilenumbruch und gefälschtem
  Timestamp/Level/Scope hätte das strukturierte `logger.js`-Format imitiert
  und wäre als scheinbar echte Log-Zeile im einzigen Audit-Trail des
  Operator-Panels gelandet.
- **Remediation**: `console.log`/`console.error` in `routes/operator.js`
  (Snapshot-Restore, Snapshot-Erstellung, Tenant-Löschung) durch
  `logger('operator')` ersetzt — `name`/`tenant` als strukturierte Felder
  statt String-Interpolation, das bestehende Whitespace-Quoting in
  `logger.js`'s `format()` neutralisiert eingebettete Zeilenumbrüche. Tests
  in `server/test/logger.test.js` (Zeilenumbruch bleibt innerhalb eines
  gequoteten Werts, erzeugt keine zusätzliche Log-Zeile).

### Passwort-Änderung/-Reset invalidierte keine zuvor ausgestellten JWTs
- **Quelle**: authentication-flow-review-2026-09-06
- **Erledigt**: 2026-09-06
- Das JWT-Payload enthielt nur `{ username, tenantId }` mit 12h `expiresIn`,
  kein `tokenVersion`-Claim — `setPasswordHash` erhöhte keinen
  Invalidierungs-Zähler. Nach einer Passwort-Änderung (z.B. um einen
  Angreifer mit gestohlenem Token auszusperren) blieb dessen Token bis zu
  12h weiter gültig.
- **Remediation**: Neue Spalte `users.token_version` (Migration 042,
  Default 0). `signToken()` bettet den aktuellen Wert ins JWT ein,
  `setPasswordHash()` erhöht ihn bei jeder Passwort-Änderung/-Reset,
  `authenticate()` lehnt ein Token mit veralteter `tokenVersion` ab (Tokens
  ohne den Claim, ausgestellt vor dieser Änderung, werden wie Version 0
  behandelt — keine Migration bestehender Sessions nötig, sie laufen
  natürlich innerhalb der 12h aus). Test in `server/test/auth.test.js`
  (altes Token nach Passwort-Änderung abgelehnt, neu ausgestelltes bleibt
  gültig).

### Operator-Panel-Login wurde gar nicht geloggt (weder Erfolg noch Fehlschlag)
- **Quelle**: logging-monitoring-audit-2026-09-06
- **Erledigt**: 2026-09-06
- Anders als der Tenant-Login (`server/routes/auth.js`, loggt jeden
  Erfolg/Fehlschlag/Pending-Fall) hatten `operatorLogin()` und
  `requireOperator()` überhaupt keine Logging-Aufrufe — kein
  fehlgeschlagener/erfolgreicher Operator-Login und kein
  abgelehntes/abgelaufenes Operator-JWT hinterließ eine Spur, bei der
  höchstprivilegierten Credential im System.
- **Remediation**: `logger('operator')`-Aufrufe ergänzt: `routes/operator.js`
  loggt Login-Erfolg (info) und -Fehlschlag (warn) inkl. `clientIp(req)`;
  `requireOperator()` (`server/operator.js`) loggt jede Ablehnung (fehlendes
  Token, ungültiges/abgelaufenes Token, falscher Scope) als warn. Tests in
  `server/test/operator-login.test.js` (Log-Zeilen per `mock.method(console,
  'log')` verifiziert).

### Operator-Login (SaaS-Admin) hatte kein dediziertes Brute-Force-Rate-Limiting
- **Quelle**: initial-security-analysis-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `operatorLogin()` verglich Credentials mit `timingSafeEqual`, aber es wurde
  kein Pro-Route-Attempt-Limiter aufgerufen — nur der generische globale
  Limiter (300 Requests/60s pro IP) griff, ein nennenswertes
  Online-Brute-Force-Budget gegen das einzige statische Operator-Secret, das
  alle Tenants kontrolliert.
- **Remediation**: Den Attempt-Counter aus `routes/auth.js` nach
  `server/login-rate-limit.js` extrahiert (`createLoginRateLimiter()`) und
  sowohl dort als auch neu in `routes/operator.js` verwendet — mit
  **getrenntem** Zähler-Store pro Route, damit Tenant- und Operator-Login
  sich nicht gegenseitig das Rate-Limit-Budget verbrauchen können. Tests in
  `server/test/operator-login.test.js` (11. Versuch blockiert, Blockade
  bleibt bei anschließend korrektem Passwort bestehen, Unabhängigkeit vom
  Tenant-Login-Limiter).

### Query-String-Auth-Fallback akzeptierte volles Session-JWT statt nur zweckgebundener Tokens
- **Quelle**: authorization-implementation-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `authenticate()` probierte als letzten Fallback `jwt.verify(downloadToken,
  config.jwtSecret)` — akzeptierte also das volle 12h-Session-JWT selbst als
  `?token=`-Query-Parameter, generisch für jede API-Route. Anders als die
  zweckgebundenen Download-/Inline-Tokens (60s/15min TTL, begrenzt
  wiederverwendbar) hatte dieser Fallback keine dieser Absicherungen —
  problematisch, da Reverse-Proxy-Logs (Caddy im SaaS-Deployment)
  üblicherweise vollständige URLs inkl. Query-String mitschreiben.
- **Remediation**: Raw-JWT-Zweig in `server/auth.js` entfernt — der
  Query-String-Pfad akzeptiert jetzt nur noch `redeemDownloadToken`/
  `verifyInlineToken`-Ergebnisse. Kein Frontend-Nutzer brauchte den
  entfernten Zweig (alle Aufrufer gehen bereits über `api.downloadUrl()`
  bzw. die zweckgebundenen Tokens, verifiziert per Grep). Tests in
  `server/test/auth.test.js` (Header-JWT weiterhin akzeptiert, Query-JWT
  abgelehnt, beide zweckgebundenen Tokens weiterhin akzeptiert).

### Client-gelieferter `slot_count` unvalidiert als Schleifen-Grenze/DELETE-Schwelle — DoS und stiller Datenverlust
- **Quelle**: business-logic-vulnerabilities-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `slot_count` floss unvalidiert in eine Schleifen-Grenze (`ensureTowerSlots`/
  `ensureTemplateTowerSlots`, ein synchrones INSERT pro Iteration) und eine
  `DELETE ... slot_index > ?`-Schwelle. Sehr großes `slot_count` (z.B. `1e8`)
  hätte den Event-Loop blockiert; negatives/Null-`slot_count` hätte über das
  Fallthrough-Verhalten der DELETE-Klausel alle bestehenden Slots eines
  Towers gelöscht.
- **Remediation**: `clampSlotCount()` in `server/db/towers.js` und
  `server/db/template-towers.js` (Bereich `1..200`, `Number.isFinite`-Check,
  `Math.trunc`) an allen Schreibpfaden (`writeTower`, `restoreTowers`,
  `ensureTowerSlots`, analog für Templates) angewendet. Tests in
  `server/test/bars-towers-routes.test.js` (0, sehr groß, negativ).

### Bulk "Template auf alle Shows anwenden" umging Show-Locks ohne Konflikt-Signal
- **Quelle**: business-logic-vulnerabilities-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `applyTemplateToAllShows` (`server/db/template-apply-to-show.js`) wurde
  nur durch das Template-Lock gegated, nie durch das Lock der einzelnen
  betroffenen Shows — fügte Bars/Towers/Sections still in eine Show ein,
  auch während ein anderer Nutzer sie per Show-Lock aktiv bearbeitete, ohne
  SSE-Refresh für offene Clients.
- **Remediation**: Vor jeder Show-Mutation ein transienter
  `getLock(show.slug)`-Check; gesperrte Shows werden übersprungen und in
  `stats.skippedLockedShows` gemeldet (analog zur bestehenden
  `failedShows`-Isolation). Nach erfolgreicher Anwendung sendet die Funktion
  jetzt `bars-updated`/`towers-updated`/`sections-updated` per SSE an die
  betroffene Show, wie es die Einzel-Apply-Route bereits tut. Test in
  `server/test/template-apply-all.test.js`.

### Undo/Redo-Restore konnte Channel-zu-Slot-Referenzen desynchronisieren (Rigging-Datenkorruption)
- **Quelle**: business-logic-vulnerabilities-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `readFullShowState()` entfernte das Feld `id` aus dem Channel-Snapshot,
  aber Tower-/Bar-Snapshots behielten den `channel_id`-Fremdschlüsselwert
  bei. Beim Restore wies `writeChannels()` jeder Zeile die `id` per Abgleich
  gegen die *aktuelle* DB (Nummer→id) neu zu, nicht per Snapshot-id — wurde
  ein Channel zwischen Snapshot und Restore gelöscht+neu angelegt (neue
  UUID), schrieb `restoreTowers`/`restoreBars` weiterhin die alte,
  verwaiste `channel_id` in `tower_slots`/`bar_fixtures`, und der reale
  Channel behielt einen falschen `mount_ref`.
- **Remediation**: `id` wird jetzt im Channel-Snapshot mitgeführt
  (`server/db/full-state.js`). Neue Funktion `restoreChannels()`
  (`server/db/channels.js`) für den Undo/Redo-Restore-Pfad übernimmt die
  Snapshot-id 1:1 statt sie per Kanalnummer neu zuzuordnen (Fallback auf
  neue UUID für Snapshots ohne `id`, alte Undo-Historie bleibt kompatibel).
  `writeChannels()` (Nummer-basiertes Mapping) bleibt für reguläre
  CSV/EOS-Importe unverändert. Neuer Regressionstest in
  `server/test/undo-redo-integrity.test.js` reproduziert exakt das
  Lösch+Neuanlage-Szenario und prüft, dass Tower-Slot und `mount_ref` nach
  Restore konsistent bleiben.

### X-Forwarded-For-Spoofing hebelt sämtliches IP-basiertes Rate-Limiting aus
- **Quelle**: api-and-infrastructure-audit-2026-09-06
- **Erledigt**: 2026-09-06
- `clientIp()` (`server/helpers.js`) nahm bei `config.trustProxy` den
  **ersten** Eintrag von `X-Forwarded-For` — Reverse-Proxies (Caddy
  eingeschlossen) hängen die echte Client-IP aber an einen bereits
  vorhandenen Header an, statt ihn zu ersetzen. Ein Angreifer konnte mit
  einem gefälschten führenden Eintrag sowohl den globalen Abuse-Limiter als
  auch den Login-Brute-Force-Limiter (beide schlüsseln über `clientIp()`)
  vollständig umgehen.
- **Remediation**: `clientIp()` nimmt jetzt den **letzten** Eintrag von
  `X-Forwarded-For` (den vom nächstgelegenen, vertrauenswürdigen Hop
  angehängten Wert). Kein Caddyfile-Wechsel auf `X-Real-IP` nötig, da der
  Haupt-Reverse-Proxy-Block für die SaaS-App keinen solchen Header setzt.
  Tests in `server/test/helpers.test.js` (3 Fälle: mehrere Hops, einzelner
  Hop, kein Proxy-Header).

### `provide`/`inject` in ShowDetailView.vue ist implizite Kopplung
- **Quelle**: 2026-09-05-software-design-analysis.md, §2
- **Erledigt**: 2026-09-05
- `ShowDetailView.vue` stellt `showTowers`/`showBars` per `provide()` für
  `GassenturmView`/`ZugstangenView` bereit — dokumentiert, aber ein Leser von
  `GassenturmView.vue` allein sah nicht, woher `showTowers` kommt.
- **Remediation**: Kommentar in `GassenturmView.vue`/`ZugstangenView.vue` um
  den expliziten Verweis `ShowDetailView.vue (provide('showTowers'/'showBars', ...))`
  ergänzt.

### Kein Adapter/Seam für externe SDKs (Anthropic, nodemailer)
- **Quelle**: design-patterns-audit-2026-09-01/03 (P-14), solid-principles-audit
  (S-07)
- **Erledigt**: 2026-09-05
- `new Anthropic(...)` und `nodemailer.createTransport()` wurden inline in den
  Funktionen instanziiert, die sie nutzen — kein Injection-Punkt.
- **Remediation**: `analyzeCircuitScan(imageBuffer, knownChannels, client = defaultAnthropicClient())`
  in `server/circuit-scan.js` und `createTransport(cfg, createFn = nodemailer.createTransport)`
  in `server/email.js` (jetzt exportiert). Beide Defaults verhalten sich exakt
  wie vorher, wenn kein Client/keine Factory übergeben wird. Tests in
  `server/test/circuit-scan.test.js` und `server/test/email-transport.test.js`
  nutzen die Injection, um ohne echten API-Call/SMTP-Verbindungsaufbau zu testen.

### Zwei Implementierungen der Hex→RGB/Luminanz-Farbkonvertierung (Server vs. Frontend)
- **Quelle**: readability-naming-audit-2026-09-03 (Finding 10)
- **Erledigt**: 2026-09-05
- Geprüft: die beiden `contrastColor()`-Implementierungen waren NICHT
  identisch — Server nutzte Rec.601-Luminanz (0.299/0.587/0.114), Frontend
  Rec.709 (0.2126/0.7152/0.0722). Das war kein reiner Stil-Unterschied,
  sondern konnte bei Grenzfarben zu unterschiedlicher Textfarbe (schwarz/
  weiß) für dieselbe Filterfarbe zwischen PDF und UI führen.
- **Remediation**: `shared/color.js` mit `contrastColor(hex)` (Rec.709,
  Frontend-Formel übernommen) angelegt. `server/pdf/filter-colors.js`
  re-exportiert von dort (Re-Export nötig, da `towers.js` es weiterhin von
  dort importiert). `web-app/src/utils/filterColors.ts` importiert
  `@shared/color.js`, eigene lokale Implementierung entfernt, Typdeklaration
  in `shared.d.ts` ergänzt. Test in `server/test/shared-color.test.js`.

### Positionale Parameter mit Vertauschungsrisiko (Bar-Fixtures, PDF-Rendering) — teilweise
- **Quelle**: readability-naming-audit-2026-09-03 (Findings 1-3)
- **Status**: 2026-09-05 geprüft — Hauptrisiko bereits behoben, Rest verworfen.
- `writeBarFixture` nutzt bereits ein Options-Objekt für `position`/`notes`/
  `fixtureId`/`side`/`positionText` (das eigentliche Vertauschungsrisiko:
  `notes`/`positionText` sind beide gleich typisierte Freitext-Strings).
  `drawRow(doc, y, usableW, cols, { isHeader, minRowH })` ist ebenfalls
  bereits Options-Objekt, inkl. dem vorgeschlagenen `drawHeaderRow`-Wrapper
  (`server/pdf/layout-primitives.js:94`) — kein Boolean-Trap mehr vorhanden.
- **Verworfen**: die vier verbleibenden PDF-Render-Funktionen
  (`renderHangereiBars`, `drawBarRows`, `drawTowerCards`,
  `renderGassenturmText`) haben weiterhin 7-8 positionale Parameter, aber
  jede hat nur eine einzige Call-Site (`server/pdf.js`) und keine
  Testabdeckung — reales Vertauschungsrisiko ist ohne wiederholte
  Copy-Paste-Aufrufe gering, eine Umstellung hätte interne Helper wie
  `drawPunktzugRow` mitbetroffen (wachsender Umfang) ohne Tests als
  Sicherheitsnetz. Aufwand/Nutzen ungünstig, bewusst nicht umgesetzt.

### Mutation-Boilerplate in Routes ~16x wiederholt (readShow + 404 + withUndoSnapshot + broadcast)
- **Quelle**: code-duplication-audit-2026-09-03 (F1)
- **Erledigt**: 2026-09-05
- `routes/bars.js`, `routes/towers.js`, `routes/sections.js`, `routes/channels.js`
  wiederholten dieselbe Kombination aus Show-Lookup, 404-Guard, Undo-Snapshot-
  Wrapping und Broadcast.
- **Remediation**: `withShowMutation(req, res, slug, eventName, mutate, opts)`
  in `server/helpers.js` — `opts.status`/`opts.responseBody`/
  `opts.broadcastPayload` decken die abweichenden Response-Bodies
  (`{ ok: true }` vs. `{ id }` vs. `{ ok: true, id }`) und Broadcast-Payloads
  (`{ updatedBy }` bei sections/channels) ab, ohne die Aufrufer zu verbiegen.
  `db/undo-stack.js`s `withSnapshot()` reicht jetzt den Rückgabewert von
  `mutate()` durch (vorher verworfen) — einziger Verhaltensunterschied, von
  keinem bestehenden Aufrufer genutzt. `routes/sections.js`s zweiter Zweig
  (`SHOW_SECTION_DEFS`, nutzt `requireAuth` statt `req.user` direkt) bewusst
  nicht umgestellt, um dessen abweichenden Auth-Pfad nicht anzufassen. Neuer
  Test `server/test/bars-towers-routes.test.js` (6 Fälle) plus bestehende
  `undo-redo-integrity.test.js` (deckt den umgebauten `channels.js`-Zweig ab)
  grün.

### `server/routes/templates.js` ist ein Breadth-God-Modul
- **Quelle**: 2026-09-05-software-design-analysis.md, Finding 4a
- **Erledigt**: 2026-09-05
- 386 Zeilen dispatchten HTTP-Routing für 5 Sub-Ressourcen (Templates, Bars,
  Towers, Sections, Floorplan) in einer Datei.
- **Remediation**: Extrahiert nach `routes/template-bars.js`,
  `routes/template-towers.js`, `routes/template-sections.js`,
  `routes/template-floorplan.js`. `templates.js` (jetzt ~185 Zeilen) enthält
  nur noch Kern-CRUD (Liste, Rename/Delete, Channels, Lock, Apply, PDF) und
  dispatcht per Pfad-Vorfilter (Regex-Test) an die vier Sub-Handler — anders
  als im ursprünglichen Remediation-Vorschlag nicht über eigene
  `API_ROUTE_HANDLERS`-Einträge in `route-table.js` (dort ist `/api/templates`
  bereits ein einzelner Präfix-Eintrag; eine Aufteilung dort hätte den
  Präfix-Match verkompliziert), sondern analog zum bestehenden
  `SHOW_ROUTE_HANDLERS`-Innendispatch. Test in
  `server/test/template-routes.test.js` (13 Fälle, inkl. Regression gegen
  Namenskollision wie ein Template namens "bars-2024").

### SMTP-Transport ohne vollständige Timeout-Konfiguration
- **Quelle**: resilience-fault-tolerance-audit-2026-09-03 (1.1)
- **Erledigt**: bereits vor diesem Audit-Zyklus, Commit `161d7d2` — verifiziert
  2026-09-05: `server/email.js` setzt `connectionTimeout`, `greetingTimeout`
  und `socketTimeout` bereits vollständig.
- Wurde vom Recherche-Review fälschlich als teilweise offen gemeldet; gegen
  aktuellen Code verifiziert und korrigiert.

### SSE-Client-Map für Shows wird nie bereinigt
- **Quelle**: resilience-fault-tolerance-audit-2026-09-03 (4.4)
- **Erledigt**: 2026-09-05
- `res.on('close', ...)` löschte nur den inneren Map-Eintrag, nicht den
  äußeren `showId`-Key in `clients` — struktureller Leak über viele Shows
  hinweg, unabhängig vom LRU-Eviction-Punkt beim Tenant-Connection-Pool.
- **Remediation**: `if (map.size === 0) clients.delete(key)` im Close-Handler
  ergänzt (`server/sse.js`). Test in `server/test/sse.test.js` (neuer,
  testonly `_clientMapSize()`-Export zur Leak-Detektion).

### Bulk-Template-Anwendung ohne Per-Item-Fehlerisolation
- **Quelle**: error-handling-resilience-audit-2026-09-03-round2 (Finding 3)
- **Erledigt**: bereits vor diesem Audit-Zyklus, Commit `15cfd20` — verifiziert
  2026-09-05: `applyTemplateToAllShows` hat try/catch pro Show-Transaktion,
  sammelt `failedShows` und gibt eine Teilstatistik statt einer Exception
  zurück.
- Wurde vom Recherche-Review fälschlich als offen gemeldet; gegen aktuellen
  Code verifiziert und korrigiert.

### Frontend-Concurrency-Composables ungetestet (`useResourceLock`, `useShowLock`, `useTokenRefresh`)
- **Quelle**: testing-implementation-audit-2026-09-03 (Finding 4.3, 7/10) —
  ursprünglich als `useLockAwareCall` benannt, dieses Composable existiert
  nicht mehr; das heutige Äquivalent ist `useResourceLock.ts`.
- **Erledigt**: 2026-09-05
- Neue Tests: `useResourceLock.test.ts` (12 Fälle: Akquise/Konflikt/Heartbeat/
  Freigabe), `useShowLock.test.ts` (18 Fälle: zusätzlich Takeover-Flow, SSE-
  Präsenzfilterung), `useTokenRefresh.test.ts` (9 Fälle: Refresh-Schwelle,
  401/Netzwerkfehler, Unmount-Guard). `useTokenRefresh` brauchte echten
  Component-Mount (Vue `onMounted`/`getCurrentInstance`) + `localStorage` —
  dafür `happy-dom` als neue devDependency hinzugefügt, nur per
  `// @vitest-environment happy-dom` in dieser einen Testdatei aktiv.
- **Remediation**: erledigt.

### Auth-Pfad hat keine Testabdeckung
- **Quelle**: testing-implementation-audit-2026-09-03 (Finding 1.2, 10/10)
- **Erledigt**: bereits vor diesem Audit-Zyklus, Commit `161d7d2` — verifiziert
  2026-09-05: `server/test/auth.test.js` deckt Login-Erfolg/-Fehlschlag,
  Enumeration-Schutz, pending-Konto, Rate-Limit (11. Versuch, pro IP getrennt),
  forgot-password und reset-password/confirm ab.
- Wurde vom Recherche-Review fälschlich als offen gemeldet; gegen aktuellen
  Code verifiziert und korrigiert.

### System-Backup/Restore (`server/backup.js`) hat keine Tests
- **Quelle**: testing-implementation-audit-2026-09-03 (Finding 1.3, 8/10)
- **Erledigt**: bereits vor diesem Audit-Zyklus, Commit `161d7d2` — verifiziert
  2026-09-05: `server/test/backup.test.js` prüft, dass `smtp.pass` und
  `password_resets` im exportierten Archiv fehlen, sowie 409 bei
  gleichzeitigem Restore-Versuch.
- Wurde vom Recherche-Review fälschlich als offen gemeldet; gegen aktuellen
  Code verifiziert und korrigiert.

### Drei Frontend-God-Components auflösen (FloorplanEditor/ShowDetailView/NetworkView)
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit),
  Findings #2-#4
- **Erledigt**: 2026-09-05, Commit `a2f3fa1`
- FloorplanEditor.vue 1366→1180 Zeilen (3 neue Composables), ShowDetailView.vue
  950→851 Zeilen (Dialog-Fassade + ShowAufbauTab.vue + Lock-Watcher verschoben),
  NetworkView.vue 881→319 Zeilen (2 Composables + 2 Komponenten extrahiert).

### Security-Header/CORS aus index.js extrahieren
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #7.5
- **Erledigt**: 2026-09-05, Commit `15cfd20`
- `server/security-headers.js` mit `applyCors`/`applySecurityHeaders`.

### Route-Dispatch-Boilerplate kondensieren
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #7.3
- **Erledigt**: 2026-09-05, Commit `15cfd20`
- `isRoute(method, pathname, expectedMethod, regex)` in `helpers.js`,
  angewendet auf die tatsächlich passenden Stellen (ohne Capture-Gruppen) in
  `shows.js`/`templates.js`/`channels.js`.

### `template-apply.js` in zwei Richtungen splitten
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #8
- **Erledigt**: 2026-09-05, Commit `15cfd20`
- `template-apply-to-show.js` (Template→Show) und
  `template-save-from-show.js` (Show→Template).

### DB-Constraint-Verletzung bei Show-Erstellung als 409 statt generischem 500
- **Quelle**: error-handling-resilience-audit-2026-09-03 / round2 (Finding 1/4)
- **Erledigt**: bereits vor diesem Audit-Zyklus, Commit `161d7d2`
  ("fix: Error-Handling/Resilience-Härtung und Testabdeckung nach
  Audit-Zyklus") — verifiziert per Grep: `routes/shows.js` prüft
  `err.code === 'SQLITE_CONSTRAINT_UNIQUE'` und liefert 409.
- Wurde vom Recherche-Review zunächst fälschlich als offen gemeldet;
  gegen aktuellen Code verifiziert und korrigiert.

### Server-weite HTTP-Timeouts (`headersTimeout`/`requestTimeout`)
- **Quelle**: resilience-fault-tolerance-audit-2026-09-03 (1.2)
- **Erledigt**: bereits vor diesem Audit-Zyklus, Commit `161d7d2`
- `server/index.js` setzt `server.headersTimeout = 30_000` und
  `server.requestTimeout = 120_000`. Verifiziert per Grep.

### CI führt Test-Suite nicht aus
- **Quelle**: testing-implementation-audit-2026-09-03 (Finding 1.1, 9/10)
- **Erledigt**: bereits vor diesem Audit-Zyklus, Commit `161d7d2`
  (`.github/workflows/test.yml` erstellt)
- Workflow läuft bei jedem Push/PR auf `main`, führt `npm test -w server`
  und `npm test -w web-app` aus. Wurde vom Recherche-Review zunächst
  fälschlich als offen gemeldet; gegen aktuellen Code verifiziert.

---

## Bewusst zurückgestellt

Punkte, die real sind, aber absichtlich nicht angegangen werden — entweder
weil sie ein bewusster Architektur-Trade-off sind (kein Bug), oder weil eine
Umsetzung erst bei einem konkreten Anlass sinnvoll geprüft werden sollte.
Anders als `## Verworfen` sind das keine geprüften Nicht-Probleme, sondern
aktive Entscheidungen, aktuell nichts zu tun.

### Backup/Restore-Endpunkte nur mit einfacher Auth statt erhöhtem Privileg
- **Quelle**: database-security-audit-2026-09-06
- **Importance**: 3/10
- **Status**: bewusst zurückgestellt, geprüft 2026-09-06
- `/api/backup` und `/api/restore` sind nur mit `requireAuth` geschützt, das
  jeder registrierte Nutzer erfüllt — es gibt keine separate Admin-Rolle.
  Ein kompromittiertes oder böswilliges Nutzerkonto kann damit die komplette
  Datenbank exfiltrieren oder alle Anwendungsdaten überschreiben, nicht nur
  eigene Daten.
- **Grund für Zurückstellung**: Rollen wurden im Projekt bewusst entfernt
  (siehe `server/db/migrations/032-users-drop-role.js`) — eine
  Wiedereinführung nur für Backup/Restore würde dieser bereits getroffenen
  Architekturentscheidung widersprechen. Das flache Berechtigungsmodell ist
  für ein kleines vertrauenswürdiges Team konzipiert; der Quell-Audit selbst
  nennt "als akzeptiertes Risiko dokumentieren" als valide Alternative zur
  Umsetzung.
- **Remediation**: Falls eine stärkere Vertrauensgrenze künftig gewünscht
  ist, Restore auf den Tenant-Owner/Erstregistrierten beschränken statt auf
  jeden authentifizierten Nutzer — bräuchte dafür aber zunächst ein Konzept
  für "wer ist Owner", das aktuell nirgends im Datenmodell existiert.

### JWT wird im Frontend in `localStorage` statt in einem `HttpOnly`-Cookie gespeichert
- **Quelle**: session-cookie-security-audit-2026-09-06
- **Importance**: 2/10
- **Status**: bewusst zurückgestellt, geprüft 2026-09-06
- `web-app/src/api/client.ts` (`getToken`/`setToken`) speichert das
  Session-JWT in `localStorage`. Die App nutzt durchgängig Header-basiertes
  Bearer-Auth ohne jegliche Cookies (bestätigt: kein `Set-Cookie` im
  gesamten Repo) — das macht CSRF strukturell irrelevant, vergrößert aber
  die Angriffsfläche bei einer künftigen XSS-Lücke, da das Token direkt aus
  JS auslesbar ist statt durch `HttpOnly` geschützt zu sein. Ein vorheriges
  XSS-Audit hat bestätigt, dass aktuell kein `v-html`/Injection-Pfad
  existiert.
- **Grund für Zurückstellung**: Eine Umstellung auf `HttpOnly`-Cookies wäre
  ein grundlegender Auth-Architektur-Umbau, kein lokaler Fix — bräuchte
  serverseitigen CSRF-Schutz (aktuell strukturell nicht nötig), eine Lösung
  für SSE/`EventSource` (kann keine Header setzen, aktuell über
  zweckgebundene Query-Tokens gelöst) und würde native/mobile Client-Pfade
  betreffen. Kein aktiver XSS-Vektor bekannt, der das rechtfertigt. Bewusst
  als Defense-in-Depth-Punkt zurückgestellt, nicht als Bug behandelt.
- **Remediation**: Falls je eine XSS-Lücke auftaucht, wäre
  `HttpOnly`-Cookie-basierte Token-Übergabe (mit entsprechendem
  CSRF-Schutz) die robustere Alternative.

### `useShowChannels.ts` kombiniert 5 Konzerne in einem Composable
- **Quelle**: 2026-09-05-software-design-analysis.md, Finding 4c
- **Importance**: 3/10
- **Status**: bewusst zurückgestellt, geprüft 2026-09-05
- Mittlerweile 551 Zeilen (Stand 2026-09-05, war 448 zum Audit-Zeitpunkt):
  Channel-CRUD, CSV-Import/Export, EOS-CSV-Merge, Circuit-Scan-Diffing,
  Undo/Redo-Wiring. Bereits teilweise entkoppelt (delegiert Parsing/Diffing
  an `utils/eos-csv.ts`, `utils/circuitScanDiff.ts`).
- **Grund für Zurückstellung**: EOS-Import (~200 Zeilen) und Circuit-Scan-
  Import (~50 Zeilen) sind tief mit `channels`/`scheduleChannelsSave`/
  `showId`/`t`/`localeReady` verzahnt — eine Extraktion nach
  `useShowChannelImport.ts` müsste diese State-Refs zwischen zwei
  Composables teilen. Nur eine einzige Call-Site (`ShowDetailView.vue`),
  keine dedizierten Tests für die Import-Flows — mechanisches Risiko ohne
  Sicherheitsnetz höher als bei den bereits umgesetzten Punkten dieser
  Session. Explizit als "nicht dringend" markiert; bei Bedarf erneut prüfen.
- **Remediation (optional, unverändert)**: `useShowChannelImport.ts` für CSV/
  EOS/Circuit-Scan-Import-Flows heraustrennen, `useShowChannels.ts` bleibt
  CRUD + Undo.

### Drei-Datei-Kosten für eine neue gesperrte Route
- **Quelle**: 2026-09-05-software-design-analysis.md, §5
- **Importance**: 2/10 (Wartungsaufwand, kein Bug)
- **Status**: bewusst zurückgestellt, geprüft 2026-09-05
- Eine neue Ressource mit Schreib-Lock erfordert Änderungen in `router.js`
  (`SHOW_WRITE_PATH`/`NETWORK_WRITE_PATH`/`TEMPLATE_WRITE_PATH`),
  `route-table.js` UND der jeweiligen `routes/*.js` — drei Stellen für eine
  Konzept-Ergänzung.
- **Grund für Zurückstellung**: `router.js`s Lock-Gate ist der zentrale
  Schreibschutz-Mechanismus (verhindert stilles gegenseitiges Überschreiben
  zwischen Nutzern) mit mehreren sorgfältig kommentierten Exempt-Regeln
  (`LOCK_CHECK_EXEMPT`, `NETWORK_LOCK_EXEMPT`, `TEMPLATE_LOCK_EXEMPT`). Eine
  Vereinheitlichung wäre ein grundlegender Umbau dieses sicherheitsrelevanten
  Gates, kein mechanisches Aufräumen — der Quell-Audit selbst spezifiziert
  keine konkrete Remediation. Risiko einer Lock-Umgehung durch einen Fehler
  hier wiegt schwerer als der Wartungsnutzen (2/10). Bewusst nicht in dieser
  Session angegangen.
- **Remediation**: nicht spezifiziert im Quell-Audit; würde eine
  Vereinheitlichung der Lock-Pfad-Erkennung erfordern (z.B. Lock-Flag direkt
  in der Route-Table-Zeile statt in separaten Konstanten in `router.js`) —
  falls angegangen, mit vollständiger Testabdeckung aller Exempt-Pfade zuerst.

### Synchrones `better-sqlite3` blockiert den Event-Loop
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit vom
  selben Tag, Finding #5)
- **Importance**: 6/10, aber explizit als bewusster Architektur-Trade-off
  markiert, kein Bug
- **Status**: bewusst zurückgestellt, siehe Diskussion 2026-09-05: kein
  First-Pass-Fix, nur bei tatsächlichem Lastproblem angehen.
- Jeder DB-Call blockiert den einzigen Node-Thread; unter SaaS-Mehrmandanten-
  Last serialisiert das alle Requests, nicht nur die eines Mandanten.
- **Remediation**: nur bei belegtem Lastproblem — `worker_threads`-Offload
  oder WAL-Tuning (WAL ist laut Audit bereits aktiv).

### JWT-Secret ohne Rotationsmechanismus
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #7
- **Importance**: 3/10, "low priority given current single-operator/small-tenant model"
- **Status**: bewusst zurückgestellt
- **Remediation**: `JWT_SECRET_PREVIOUS`-Unterstützung für Rotationsfenster,
  falls Rotation je nötig wird.

### LRU-Eviction im Tenant-Connection-Pool kann `MAX_OPEN_TENANT_DBS` überschreiten
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #9
- **Importance**: 4/10, dokumentierter Trade-off, kein Bug
- **Status**: bewusst zurückgestellt
- **Hinweis**: es existiert bereits `server/test/tenants-lru.test.js` — bei
  Bedarf zuerst prüfen, ob der Race (Eviction während laufendem Request)
  darin abgedeckt ist, bevor an der Logik etwas geändert wird.

### Kein API-Framework/OpenAPI-Schema
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #10
- **Importance**: 3/10
- **Status**: bewusst zurückgestellt (architektonische Grundsatzentscheidung,
  kein Bug; "no framework, minimal dependencies"-Philosophie ist im Projekt
  durchgängig sichtbar)

### CSP erlaubt `style-src 'unsafe-inline'`
- **Quelle**: codebase-quality-security-review-2026-09-06
- **Importance**: 3/10
- **Status**: bewusst zurückgestellt, geprüft 2026-09-06
- `applySecurityHeaders` erlaubt `'unsafe-inline'` für Styles.
- **Grund für Zurückstellung**: Mindestens 14 Vue-Komponenten nutzen
  `:style`-Bindings (dynamische Inline-Styles, z.B. für berechnete
  Positionen/Farben im Floorplan/Netzwerk-Editor) — diese landen als
  `style="..."`-Attribut im DOM und fallen unter dieselbe CSP-Direktive wie
  `<style>`-Injection. Ein Entfernen von `'unsafe-inline'` bräuchte entweder
  Nonces (unpraktikabel für dynamisch berechnete Werte) oder eine Umstellung
  aller betroffenen Bindings auf CSS-Klassen mit CSS-Variablen — ein
  nennenswerter Frontend-Umbau ohne aktuell bekannten Style-Injection-Vektor
  (kein `v-html` im Repo, verifiziert per Grep).
- **Remediation**: Bei Bedarf schrittweise auf CSS-Custom-Properties statt
  direkter `:style`-Bindings umstellen, dann `'unsafe-inline'` entfernen.

### CSRF-Schutz nicht explizit vorhanden
- **Quelle**: codebase-quality-security-review-2026-09-06
- **Importance**: 1/10
- **Status**: bewusst zurückgestellt, geprüft 2026-09-06
- Kein CSRF-Token-Mechanismus vorhanden.
- **Grund für Zurückstellung**: Verifiziert per Grep — kein `Set-Cookie` im
  gesamten Repo, Auth läuft durchgängig über Bearer-Token im
  `Authorization`-Header (siehe auch bestehenden Punkt "JWT wird im Frontend
  in `localStorage`..." weiter oben). CSRF setzt browserseitig automatisch
  mitgesendete Credentials (Cookies) voraus — ohne solche ist die Angriffsklasse
  strukturell nicht anwendbar. Kein Fix nötig, solange kein Cookie-basierter
  Auth-Pfad eingeführt wird.

### Kein API-Versionierungsschema
- **Quelle**: api-and-infrastructure-audit-2026-09-06
- **Importance**: 2/10
- **Status**: bewusst zurückgestellt, geprüft 2026-09-06
- Alle Endpunkte liegen unter einem flachen `/api/...`-Namespace ohne
  Versions-Segment, Versions-Header oder Deprecation-Mechanismus. Kein
  aktives Sicherheitsproblem, aber ein Rollout-/Kompatibilitätsrisiko,
  sobald mehrere Client-Versionen (native App + Web-SPA) parallel
  unterstützt werden müssen.
- **Grund für Zurückstellung**: Dieselbe "no framework, minimal
  dependencies"-Philosophie wie beim benachbarten Punkt (kein
  API-Framework/OpenAPI-Schema) — eine Versionierung vorab einzuführen ohne
  einen konkreten Breaking-Change-Anlass wäre spekulative Vorabarbeit ohne
  aktuellen Nutzen. Der Quell-Audit selbst empfiehlt "bei Bedarf", nicht
  präventiv.
- **Remediation**: Bei Bedarf minimalen Versions-Marker (URL-Präfix oder
  Header) einführen, bevor ein Breaking-Change-Vorfall eintritt.

---

## Verworfen

### `withLockConflict`-Wrapper existiert, wird aber nicht überall verwendet
- **Quelle**: code-duplication-audit-2026-09-03 (F5); Wrapper selbst seit
  Commit `3fb36e3`
- **Verworfen**: 2026-09-05 — geprüft und als bewusste Design-Entscheidung
  bestätigt, keine Umsetzung nötig.
- `useShowChannels.ts` (`doPersistChannels`, `persistEosChannels`) und
  `useShowSections.ts` (`doPersistSections`, `persistSectionDefs`) laufen
  fire-and-forget ohne `.catch()` am Aufrufort und behandeln einen
  Nicht-423-Fehler daher lokal (Error-State setzen + loggen) statt ihn
  weiterzuwerfen. `withLockConflict` wirft bei Nicht-423 aber weiter — eine
  Umstellung würde dort unhandled promise rejections erzeugen. `useShowLock.ts`
  verwaltet den Lock-Conflict als regulären Rückgabewert, ebenfalls
  inkompatibel. Kommentar in `withLockConflict.ts` präzisiert, damit dies
  nicht erneut als offener Punkt aufgegriffen wird.

### Show/Template-Datenzugriff dupliziert sich parallel (Towers/Bars/Sections vs. Template-Pendants)
- **Quelle**: architecture-analysis-2026-09-01/03, code-duplication-audit-2026-09-03 (F2/F3/F9/F10)
- **Verworfen**: 2026-09-05 — gegen aktuellen Code geprüft (`db/towers.js` vs.
  `db/template-towers.js`), bewusst nicht umgesetzt.
- Die CRUD-/Upsert-/Slot-Logik ist strukturell ähnlich, aber die Spalten sind
  echt unterschiedlich, nicht nur benannt anders: Show-Tower-Slots pflegen
  zusätzlich `mount_ref` auf der `channels`-Tabelle (Rückverweis Kanal→Turm),
  Template-Tower-Slots haben stattdessen direkte `channel`/`device`/`color`-
  Felder ohne Kanal-Bezug (Templates haben keine echten Kanäle). Eine
  gemeinsame parametrisierte Abstraktion würde zwei semantisch verschiedene
  Dinge künstlich unter ein Dach zwingen — genau die "falsche Abstraktion",
  vor der der Quell-Audit selbst warnt (F3). Der Read-Pfad ist bereits geteilt
  (`db/tower-read-core.js`, von beiden Seiten genutzt) — das ist der Teil, der
  tatsächlich identisch ist. Write/Delete bewusst getrennt gelassen.

### SSE-Reconnect ohne Backoff
- **Quelle**: resilience-fault-tolerance-audit-2026-09-03 (2.1)
- **Verworfen**: bereits vor diesem Audit-Zyklus behoben (Commit `161d7d2`
  bestätigt in error-handling-resilience-round2 als "verified fix" —
  exponentielles Backoff + Jitter vorhanden). Nicht erneut in den Backlog
  aufgenommen, da erledigt und nicht separat verifizierbar ohne den
  ursprünglichen Vergleichspunkt.

### `router.test.js` "false sense of coverage" / reihenfolge-abhängige Tests
- **Quelle**: readability-naming-audit-2026-09-03 (Findings 4-15),
  testing-implementation-audit-2026-09-03 (2.2/2.3)
- **Verworfen**: 2026-09-05 — real, aber niedrigwertig/kosmetisch laut
  eigener Einschätzung des Recherche-Reviews; bewusst nicht aufgenommen, um
  den Backlog auf hochwertige Punkte zu fokussieren. Bei Bedarf erneut
  aufnehmen.

### Vage Test-/Performance-Forderungen ("mehr Komponententests", "Load-Tests")
- **Quelle**: testing-implementation-audit-2026-09-03 (diverse)
- **Verworfen**: 2026-09-05 — zu unspezifisch für einen Backlog-Eintrag
  (kein konkretes Ziel/Datei benennbar). Erst bei einer konkreten
  Test-Lücke wieder aufnehmen.

### `umsetzungsreihenfolge-*.md` (alle Versionen)
- **Quelle**: audits_old/umsetzungsreihenfolge-2026-09-01.md und
  -2026-09-03(-b/-c/-d/-e).md
- **Verworfen**: 2026-09-05 — reine Sequenzierungs-/Tracking-Dokumente
  vorheriger Remediation-Runden ohne eigenständige neue Befunde; ihr
  Inhalt ist vollständig in den oben verarbeiteten Einzel-Audits enthalten.
