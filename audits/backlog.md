# Findings-Backlog (Ermessensfragen)

Für Fragen ohne deterministischen Maßstab — siehe `audits/README.md`. Ein
Review trägt hier neue Punkte ein oder aktualisiert den Status bestehender;
es schreibt nie einen neuen Gesamtbericht. Punkte bleiben nach Erledigung
stehen (mit Datum/Commit), damit die Historie nachvollziehbar ist.

Format pro Eintrag: Titel, Quelle (welcher Audit/Review), Importance (1-10,
subjektiv — dient nur der Priorisierung untereinander, kein absoluter Wert),
Status, Beschreibung, Remediation.

---

## Offen

### `server/routes/templates.js` ist ein Breadth-God-Modul
- **Quelle**: 2026-09-05-software-design-analysis.md, Finding 4a
- **Importance**: 5/10
- **Status**: offen
- 386 Zeilen, dispatcht HTTP-Routing für 5 Sub-Ressourcen (Templates, Bars,
  Towers, Sections, Floorplan) in einer Datei — jede Sub-Logik ist dünn
  (delegiert sofort an `db/*`), aber die Datei mischt zu viele Sub-Ressourcen.
- **Remediation**: Mechanische Extraktion nach `routes/template-bars.js`,
  `routes/template-towers.js`, `routes/template-sections.js`,
  `routes/template-floorplan.js` — analog zum bestehenden Muster
  `routes/towers.js`/`routes/bars.js`. Jeweils als eigener Eintrag in
  `API_ROUTE_HANDLERS` (`route-table.js`) registrieren.

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

---

## Erledigt

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

---

## Verworfen

(noch keine Einträge)
