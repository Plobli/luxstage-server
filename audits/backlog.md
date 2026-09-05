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

### `useShowChannels.ts` kombiniert 5 Konzerne in einem Composable
- **Quelle**: 2026-09-05-software-design-analysis.md, Finding 4c
- **Importance**: 3/10
- **Status**: offen
- 448 Zeilen: Channel-CRUD, CSV-Import/Export, EOS-CSV-Merge,
  Circuit-Scan-Diffing, Undo/Redo-Wiring. Bereits teilweise entkoppelt
  (delegiert Parsing/Diffing an `utils/eos-csv.ts`,
  `utils/circuitScanDiff.ts`).
- **Remediation (optional)**: `useShowChannelImport.ts` für CSV/EOS/
  Circuit-Scan-Import-Flows heraustrennen, `useShowChannels.ts` bleibt
  CRUD + Undo. Nicht dringend.

### Drei-Datei-Kosten für eine neue gesperrte Route
- **Quelle**: 2026-09-05-software-design-analysis.md, §5
- **Importance**: 2/10 (Wartungsaufwand, kein Bug)
- **Status**: offen
- Eine neue Ressource mit Schreib-Lock erfordert Änderungen in `router.js`
  (`SHOW_WRITE_PATH`/`NETWORK_WRITE_PATH`/`TEMPLATE_WRITE_PATH`),
  `route-table.js` UND der jeweiligen `routes/*.js` — drei Stellen für eine
  Konzept-Ergänzung.
- **Remediation**: nicht spezifiziert im Quell-Audit; würde eine
  Vereinheitlichung der Lock-Pfad-Erkennung erfordern (z.B. Lock-Flag direkt
  in der Route-Table-Zeile statt in separaten Konstanten in `router.js`).

### `provide`/`inject` in ShowDetailView.vue ist implizite Kopplung
- **Quelle**: 2026-09-05-software-design-analysis.md, §2
- **Importance**: 2/10 (Lesbarkeit, keine Korrektheitsfrage)
- **Status**: offen
- `ShowDetailView.vue` stellt `showTowers`/`showBars` per `provide()` für
  `GassenturmView`/`ZugstangenView` bereit — dokumentiert, aber ein Leser von
  `GassenturmView.vue` allein sieht nicht, woher `showTowers` kommt.
- **Remediation**: keine zwingend nötig; falls gewünscht, Kommentar-Verweis
  in `GassenturmView.vue` auf die `provide()`-Stelle ergänzen.

### Synchrones `better-sqlite3` blockiert den Event-Loop
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit vom
  selben Tag, Finding #5)
- **Importance**: 6/10, aber explizit als bewusster Architektur-Trade-off
  markiert, kein Bug
- **Status**: offen — **bewusst zurückgestellt**, siehe Diskussion
  2026-09-05: kein First-Pass-Fix, nur bei tatsächlichem Lastproblem angehen.
- Jeder DB-Call blockiert den einzigen Node-Thread; unter SaaS-Mehrmandanten-
  Last serialisiert das alle Requests, nicht nur die eines Mandanten.
- **Remediation**: nur bei belegtem Lastproblem — `worker_threads`-Offload
  oder WAL-Tuning (WAL ist laut Audit bereits aktiv).

### JWT-Secret ohne Rotationsmechanismus
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #7
- **Importance**: 3/10, "low priority given current single-operator/small-tenant model"
- **Status**: offen — bewusst zurückgestellt
- **Remediation**: `JWT_SECRET_PREVIOUS`-Unterstützung für Rotationsfenster,
  falls Rotation je nötig wird.

### LRU-Eviction im Tenant-Connection-Pool kann `MAX_OPEN_TENANT_DBS` überschreiten
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #9
- **Importance**: 4/10, dokumentierter Trade-off, kein Bug
- **Status**: offen — bewusst zurückgestellt
- **Hinweis**: es existiert bereits `server/test/tenants-lru.test.js` — bei
  Bedarf zuerst prüfen, ob der Race (Eviction während laufendem Request)
  darin abgedeckt ist, bevor an der Logik etwas geändert wird.

### Kein API-Framework/OpenAPI-Schema
- **Quelle**: 2026-09-05-software-design-analysis.md (Ursprungs-Audit), Finding #10
- **Importance**: 3/10
- **Status**: offen — bewusst zurückgestellt (architektonische Grundsatzentscheidung,
  kein Bug; "no framework, minimal dependencies"-Philosophie ist im Projekt
  durchgängig sichtbar)

### Mutation-Boilerplate in Routes ~16x wiederholt (readShow + 404 + withUndoSnapshot + broadcast)
- **Quelle**: code-duplication-audit-2026-09-03 (F1)
- **Importance**: 3/10
- **Status**: offen
- `routes/bars.js`, `routes/towers.js`, `routes/sections.js`, `routes/channels.js`
  wiederholen dieselbe Kombination aus Show-Lookup, 404-Guard, Undo-Snapshot-
  Wrapping und Broadcast. Nicht durch `max-lines`/jscpd erkennbar, da jede
  Instanz kurz und in unterschiedlichen Funktionen eingebettet ist.
- **Remediation**: `withShowMutation(req, res, slug, eventName, mutate)`-Helper
  in `server/helpers.js`.

### Kein Adapter/Seam für externe SDKs (Anthropic, nodemailer)
- **Quelle**: design-patterns-audit-2026-09-01/03 (P-14), solid-principles-audit
  (S-07) — im 09-03-Re-Audit explizit als "unverändert offen" bestätigt
- **Importance**: 3/10
- **Status**: offen
- `new Anthropic(...)` und `nodemailer.createTransport()` werden inline in den
  Funktionen instanziiert, die sie nutzen — kein Injection-Punkt, dadurch
  schwer isoliert testbar und ein SDK-Breaking-Change fällt erst zur Laufzeit auf.
- **Remediation**: optionaler `client = defaultClient()`-Parameter als
  Injection-Punkt, kein DI-Container nötig.

### Positionale Parameter mit Vertauschungsrisiko (Bar-Fixtures, PDF-Rendering)
- **Quelle**: readability-naming-audit-2026-09-03 (Findings 1-3)
- **Importance**: 3/10
- **Status**: offen
- `writeBarFixture(barId, channelId, position, notes, fixtureId, side, positionText)`
  — `notes`/`positionText` sind beides Freitext-Strings mit gleichem Default;
  eine vertauschte Reihenfolge kompiliert, produziert aber einen
  Daten-Korruptions-Bug ohne Typ-/Test-Schutz. Vier PDF-Render-Funktionen
  (`renderHangereiBars`, `drawBarRows`, `drawTowerCards`,
  `renderGassenturmText`) teilen 7-8 positionale Parameter in gleicher
  Reihenfolge; `drawRow(doc, y, usableW, cols, isHeader, minRowH)` hat einen
  bare-boolean-Parameter (Boolean-Trap) an 6 Call-Sites.
- **Remediation**: auf Options-Objekte umstellen; für `drawRow` einen
  benannten `drawHeaderRow`-Wrapper ergänzen.

### Zwei Implementierungen der Hex→RGB/Luminanz-Farbkonvertierung (Server vs. Frontend)
- **Quelle**: readability-naming-audit-2026-09-03 (Finding 10)
- **Importance**: 2/10
- **Status**: offen — vor Umsetzung erst prüfen, ob `pdf/filter-colors.js` und
  `utils/filterColors.ts` tatsächlich 1:1 identisch sind (Audit konnte das
  nicht abschließend verifizieren)
- Gleicher Algorithmus einmal serverseitig, einmal clientseitig — trotz
  `shared/`, das genau das verhindern soll. Kein jscpd-Treffer, da
  sprachübergreifend (.js vs. .ts) mit abweichender Formatierung.
- **Remediation**: nach `shared/color.js` verschieben (`hexToRgb`/
  `relativeLuminance`).

---

## Erledigt

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

## Verworfen

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
