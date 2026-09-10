# LuxStage SaaS — Deployment auf dem CX43 (geteilter Server)

Konkreter Fahrplan für den bestehenden Hetzner CX43 (`188.245.171.222`), auf dem
schon Caddy + ~15 Dienste laufen. Mandanten laufen unter `<team>.luxstage.app`,
Betreiber-Panel unter `admin.luxstage.app`.

Reihenfolge bewusst: LuxStage-SaaS zuerst **ohne** Domain starten (gefahrlos),
den riskanten Caddy-Umbau zuletzt und mit Rollback.

## Vorbedingungen (erledigt)

- [x] Swap 4 GB aktiv (`swapon --show`)
- [x] DNS: `luxstage.app` + `*.luxstage.app` → `188.245.171.222` (mit `dig` verifiziert)
- [x] SMTP-Dienst eingerichtet (Netcup-Mailserver, `hello@luxstage.app`)

## Reservierte Subdomains

`thema`, `appreview`, `docs` (bestehende feste Subdomains) sowie generische
(`www`, `app`, `api`, `admin`, …) und Marketing/Mail-Namen (`mail`, `mx`, `cdn`,
`status`, …) sind im Code gesperrt (`RESERVED` in `tenant-resolve.js`) — kein
Mandant kann sie registrieren. `thema.luxstage.app` (aktueller Single-Tenant-
LuxStage) läuft unberührt weiter.

---

## Schritt 0 — GHCR-Login (einmalig)

Das Image ist privat. Server einmal an der GitHub Container Registry anmelden:
```sh
# GitHub → Settings → Developer settings → Personal access token (classic)
# Scope: read:packages
echo "<TOKEN>" | docker login ghcr.io -u Plobli --password-stdin
```

## Schritt 1 — Stack in Dockge anlegen

Kein Repo-Clone nötig — das Image kommt aus GHCR, es wird nur die Compose-Datei
gebraucht. In Dockge einen neuen Stack `luxstage-saas` anlegen und den Inhalt von
`docker-compose.saas.server.yml` (aus dem Repo) einfügen.

## Schritt 2 — .env im Dockge-Stack setzen

Im Dockge-Stack die Umgebungsvariablen hinterlegen (Vorlage: `.env.saas.example`):

```
JWT_SECRET=<openssl rand -hex 32>
BASE_DOMAIN=luxstage.app
APP_URL=https://luxstage.app
CORS_ORIGINS=https://luxstage.app
SMTP_HOST=<vom SMTP-Dienst>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<vom SMTP-Dienst>
SMTP_PASS=<vom SMTP-Dienst>
SMTP_FROM=LuxStage <noreply@luxstage.app>
OPERATOR_USER=operator
OPERATOR_PASSWORD=<starkes Passwort>
```

> Hinweis: `APP_URL` ist die Root-Domain. Root (`luxstage.app`) zeigt normal auf
> die Marketing-Website (`luxstage-website`), aber Caddy reicht die Pfade
> `/register`, `/register/confirm`, `/api/register*` pfadbasiert an
> `luxstage-saas` durch (kein eigener `api.`-Host — der wäre für Nutzer
> sichtbar und unüblich für eine Weboberfläche). Der Mandant existiert beim
> Confirm noch nicht, seine eigene Subdomain würde 404 liefern, daher läuft
> die Bestätigungsseite auf Root.

## Schritt 3 — LuxStage-SaaS starten (noch ohne Domain)

Stack in Dockge deployen (zieht das Image aus GHCR, startet den Container).
Erwartung im Log: `LuxStage Server … läuft auf Port 3000` + `[backup] Täglicher … Job aktiv`.

Kein `ports:`-Mapping — der Container ist noch nicht von außen erreichbar. Das ist
gewollt: erst Caddy macht ihn erreichbar. Beim Deploy entsteht das Netzwerk
`luxstage-saas-net`.

Interner Funktionstest (aus einem Container im selben Netz):
```sh
docker run --rm --network luxstage-saas-net curlimages/curl \
  -s -o /dev/null -w '%{http_code}\n' http://luxstage-saas:3000/api/health
# erwartet: 200
```

## Schritt 4 — Caddy ins LuxStage-Netz hängen

Erst jetzt (nach Schritt 3) existiert das Netz `luxstage-saas-net`:
```sh
docker network connect luxstage-saas-net caddy
docker inspect caddy --format '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}} {{end}}'
# luxstage-saas-net muss jetzt gelistet sein
```

## Schritt 5 — Caddy-Konfiguration: On-Demand-TLS statt INWX-Wildcard

Kein DNS-Plugin, kein INWX-API-Zugang nötig: statt eines Wildcard-Zertifikats
per DNS-Challenge holt Caddy für jede Mandanten-Subdomain automatisch ein
eigenes Zertifikat per HTTP/TLS-ALPN-Challenge (On-Demand-TLS), sobald sie das
erste Mal aufgerufen wird. Dafür fragt Caddy vorher den bereits vorhandenen
`ask`-Endpoint (`/api/tls-check`), der nur bekannte Domains (Root, `admin.`,
existierende Mandanten) mit 200 bestätigt — verhindert, dass Fremd-Hostnamen
Caddy zu Zertifikatsanfragen zwingen. `caddy:2.8-alpine` (Standard-Image)
reicht, kein Image-Wechsel nötig.

**5a. Globalen `on_demand_tls`-Block ergänzen** (im obersten `{ admin off }`-Block):
```caddyfile
{
    admin off

    on_demand_tls {
        ask http://luxstage-saas:3000/api/tls-check
    }
}
```

**5b. Root-Domain um Pfad-Matcher für Registrierung ergänzen**, restlicher
Traffic bleibt bei der Marketing-Website. Betreiber-Panel bekommt einen festen
Block wie `thema.`/`docs.` (normales ACME-Zertifikat):
```caddyfile
# LuxStage Website + SaaS-Registrierung (nur /register* geht an luxstage-saas)
luxstage.app {
    import common_headers

    @saas_register path /register /register/* /api/register /api/register/* /assets/* /favicon.png
    handle @saas_register {
        reverse_proxy luxstage-saas:3000 {
            header_up Host {host}
        }
    }

    handle {
        reverse_proxy luxstage-website:80 {
            header_up X-Forwarded-Proto {scheme}
            header_up X-Forwarded-Host {host}
            header_up X-Real-IP {remote_host}
        }
    }
}

# LuxStage SaaS — Betreiber-Panel (fest, normales ACME-Zertifikat)
# /api/* geht an den Hauptserver (einziger SQLite-Writer, registry.db),
# alles andere (HTML/JS) an den eigenständigen Panel-Service — dessen
# Image kann unabhängig aktualisiert werden, ohne luxstage-saas neuzustarten.
admin.luxstage.app {
    import common_headers
    @api path /api/*
    handle @api {
        reverse_proxy luxstage-saas:3000 {
            header_up Host {host}
        }
    }
    handle {
        reverse_proxy luxstage-operator-panel:3001 {
            header_up Host {host}
        }
    }
}
```

> Kein eigener `api.<baseDomain>`-Host: eine Nutzer-sichtbare `api.`-Subdomain
> ist unüblich (dort erwartet man reine REST-Endpunkte, keine Weboberfläche).
> Registrierung läuft stattdessen über Pfade auf der Root-Domain selbst.
> `/assets/*` und `/favicon.png` müssen mit durchgereicht werden, sonst lädt
> die Vue-SPA auf `/register` unvollständig (fehlende JS/CSS/Favicon). Die
> Marketing-Website nutzt aktuell kein `/assets/`-Verzeichnis — bei künftigen
> Website-Änderungen prüfen, ob das noch kollisionsfrei ist.
> `/login`, `/forgot-password` etc. laufen bewusst NICHT auf Root — nur pro
> Mandant auf `<team>.luxstage.app` (siehe `PUBLIC_SPA_PATHS` in `router.js`).

**5c. Mandanten-Subdomains** — Wildcard-Matcher, aber On-Demand statt DNS-Challenge:
```caddyfile
# LuxStage SaaS — Mandanten-Subdomains (team.luxstage.app), On-Demand-TLS
*.luxstage.app {
    import common_headers
    tls {
        on_demand
    }
    reverse_proxy luxstage-saas:3000 {
        header_up Host {host}
    }
}
```

> `header_up Host {host}` ist ZWINGEND — der Server leitet den Mandanten aus dem
> Host-Header ab. `admin.`/`api.` matchen als spezifischere Blöcke vor dem
> `*.luxstage.app`-Wildcard.

**5d. Übernehmen:** Caddyfile im Stack-Verzeichnis bearbeiten, `caddy validate`
gegen die Datei laufen lassen, dann Container neu starten (kein `caddy reload`
möglich, da `admin off` die lokale Admin-API deaktiviert):
```sh
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
docker restart caddy
docker logs caddy --tail 30    # auf "certificate obtained successfully" achten
```

**5e. Rollback (falls etwas hängt):** Backup der vorherigen Caddyfile
(`Caddyfile.bak-<timestamp>`) zurückkopieren, `docker restart caddy`. Bestehende
Zertifikate liegen im Caddy-Volume — alte Domains sind sofort wieder da.

## Schritt 6 — Betreiber-Panel & Registrierung testen

```sh
# Panel erreichbar?
curl -s -o /dev/null -w '%{http_code}\n' https://admin.luxstage.app/
# Registrierung (echte Mail an eine Adresse, die du prüfen kannst)
curl -s -X POST https://luxstage.app/api/register \
  -H 'Content-Type: application/json' \
  -d '{"teamId":"testteam","email":"DEINE@mail.de","password":"testpasswort1"}'
```

Dann: Bestätigungsmail abrufen → Link klicken (führt auf
`luxstage.app/register/confirm`, zeigt "Team aktiviert") → über den Link
"Zur Anmeldung" auf `testteam.luxstage.app` mit E-Mail + Passwort einloggen.
Danach `testteam` im Panel wieder löschen.

Hinweis: der Bestätigungslink ist Single-Use — beim Neuladen der
`/register/confirm`-Seite nach erfolgreicher Bestätigung erscheint "Link
ungültig oder abgelaufen", obwohl der Mandant bereits angelegt wurde. Das ist
beabsichtigt (verhindert doppeltes Anlegen desselben Mandanten), aber
irreführend beim zufälligen Neuladen.

Login läuft immer über die bei der Registrierung angegebene **E-Mail-Adresse**
(nicht "admin") + Passwort.

## Schritt 7 — Aufräumen / Go-Live

- Test-Mandant im Betreiber-Panel löschen.
- `feature/saas` ist bereits vollständig in `main` enthalten (kein Merge
  nötig) — Branch kann gelöscht werden.
- Erste echte Kunden einladen.

## Updates einspielen

Server (`luxstage-saas`) und Betreiber-Panel (`luxstage-operator-panel`) haben
getrennte Build-Trigger — ein Update am einen baut/deployt nie unnötig den
anderen.

**Server-Update** (Version-Tag, wie bisher):

1. Lokal: Version in `package.json` erhöhen, committen, Tag pushen (Schema `v2026.6.X`):
   ```sh
   git tag v2026.6.X && git push origin v2026.6.X
   ```
2. GitHub Actions (`saas-image.yml`) baut `ghcr.io/plobli/luxstage-saas:<version>`
   (auch `:latest`).
3. Auf dem Server: im Arcade-Stack **luxstage-saas** Force-Pull + Recreate.
   Schema-Migrationen laufen beim Start automatisch (idempotent).

**Panel-Update** (kein Tag nötig):

1. Lokal: Änderungen unter `operator-panel/` committen und nach `main` pushen.
2. GitHub Actions (`operator-panel-image.yml`) baut automatisch bei jedem
   main-Push mit Änderungen unter `operator-panel/` und pusht
   `ghcr.io/plobli/luxstage-operator-panel:latest` (plus Short-SHA-Tag).
3. Auf dem Server: im Arcade-Stack **luxstage-operator-panel** Force-Pull +
   Recreate. `docker compose up -d --force-recreate luxstage-operator-panel`
   erzwingt das auch dann, wenn Arcades "Neu deployen" allein den Container
   nicht mit dem neu gepullten `:latest`-Image neu erstellt (bekanntes
   Docker-Compose-Verhalten bei gleichbleibendem Tag-Namen).

Mandanten-Verbindungen bleiben von einem Panel-Redeploy unberührt.

## Betrieb

- **Backups:** täglicher Auto-Snapshot je Mandant unter `/app/data/backups/<id>/`
  (im Volume `luxstage-saas-data`). Restore/Download über das Betreiber-Panel.
- **Ressourcen:** Container ist auf 768 MB / 1.5 CPU gedeckelt — kann die anderen
  Dienste nicht überrennen.
- **Monitoring:** `admin.luxstage.app` zeigt Mandanten + offene Registrierungen;
  optional in uptime-kuma einen Check auf `https://luxstage.app/api/health`.
