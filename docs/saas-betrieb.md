# LuxStage SaaS — Betrieb

Anleitung zum Betrieb von LuxStage als SaaS (gehostet, Mandanten via Subdomain).
Für Self-Hosted (ein Kunde, eine Instanz) gilt weiterhin `docker-compose.yml` +
`README.md`.

## Überblick

- **Jeder Mandant** bekommt eine Subdomain: `team-x.luxstage.app`.
- **Betreiber-Panel** läuft auf `admin.luxstage.app`.
- **Registrierung** ist Self-Service mit E-Mail-Bestätigung (Doppel-Opt-In).
- **Eine Instanz** bedient alle Mandanten; jeder Mandant hat eine eigene,
  isolierte SQLite-Datei unter `data/tenants/<id>/`.

Der Server leitet den Mandanten aus dem `Host`-Header ab. Der einzige echte
Zusatzaufwand gegenüber Self-Hosted ist **Wildcard-DNS + Wildcard-TLS**.

## Voraussetzungen

- Ein Server (VPS genügt: 4–8 GB RAM, z. B. Hetzner CX22).
- Docker + Docker Compose.
- Eine Domain (`luxstage.app`) mit Zugriff auf die DNS-Verwaltung.
- Ein DNS-Anbieter mit API (für automatische Wildcard-Zertifikate), z. B.
  Cloudflare, Hetzner DNS, deSEC.
- Ein SMTP-Zugang für Bestätigungs-Mails.

## 1. DNS

Zwei Records, beide auf die Server-IP:

```
A     luxstage.app         → <SERVER_IP>     (Root: öffentliche Seite / Registrierung)
A     *.luxstage.app       → <SERVER_IP>     (Wildcard: alle Mandanten + admin)
```

Der Wildcard deckt `team-x`, `admin`, `www` usw. ab. Kein Record pro Mandant nötig.

## 2. Umgebungsvariablen

`.env.saas.example` nach `.env` kopieren und ausfüllen. Pflicht:

| Variable | Zweck |
|---|---|
| `JWT_SECRET` | ≥ 32 Zeichen (`openssl rand -hex 32`) |
| `BASE_DOMAIN` | `luxstage.app` — aktiviert Subdomain-Modus |
| `APP_URL` | `https://luxstage.app` — für Mail-Links |
| `CORS_ORIGINS` | eigene Domain(s) |
| `SMTP_*` | Versand der Bestätigungs-Mails |
| `OPERATOR_PASSWORD` | aktiviert das Betreiber-Panel |

Ohne `OPERATOR_PASSWORD` bleibt das Panel deaktiviert. Ohne SMTP wird keine
Bestätigungsmail versendet — Registrierung schlägt dann faktisch fehl.

## 3. TLS / Reverse Proxy (Caddy)

Caddy terminiert HTTPS und braucht für `*.luxstage.app` ein **Wildcard-Zertifikat**.
Wildcards erfordern die **DNS-Challenge** (nicht HTTP), daher braucht Caddy einen
API-Token des DNS-Anbieters. Beispiel mit Cloudflare:

```caddyfile
# Caddyfile
*.luxstage.app, luxstage.app {
	tls {
		dns cloudflare {env.CF_API_TOKEN}
	}
	reverse_proxy luxstage-saas:3000 {
		# WICHTIG: Original-Host durchreichen. Der Server leitet den Mandanten
		# aus dem Host-Header ab — ohne diese Zeile sähe er "luxstage-saas:3000".
		header_up Host {host}
	}
}
```

- `luxstage-saas:3000` ist der `container_name` aus `docker-compose.saas.yml`
  (gemeinsames Netzwerk `caddy`).
- `header_up Host {host}` ist **zwingend**: Caddy überschreibt den `Host`-Header
  sonst mit dem Upstream-Namen, und die Subdomain-Auflösung schlägt fehl.
- `{env.CF_API_TOKEN}` liefert der Caddy-Container per Umgebungsvariable.
- Caddy braucht ein Image mit DNS-Plugin (z. B. via `xcaddy` → `caddy-dns/cloudflare`).

Der Wildcard deckt automatisch Mandanten **und** `admin.luxstage.app` ab — keine
Extra-Konfiguration je Mandant.

> Hinweis: Der Server selbst kennt kein HTTPS/Zertifikat. TLS endet bei Caddy,
> intern spricht Caddy per HTTP mit dem Container. Der durchgereichte `Host`-Header
> ist die Quelle der Mandanten-Auflösung.

### Alternative: On-Demand-TLS

Auf einem bestehenden Caddy-Host ohne DNS-Plugin kann Caddy Zertifikate auch
pro bekannter Mandanten-Domain bei der ersten Anfrage ausstellen. LuxStage stellt
dafür den eingeschränkten `GET /api/tls-check`-Endpoint bereit. Diese Variante
verwendet keinen Wildcard-Zertifikatsblock und ist als konkrete Anleitung in
`docs/deploy-cx43.md` beschrieben. Pro Deployment genau **eine** TLS-Variante
konfigurieren: Wildcard per DNS-Challenge oder On-Demand-TLS.

## 4. Start

```sh
docker compose -f docker-compose.saas.yml up -d
```

Der SaaS-Entrypoint startet den Server **ohne** Bootstrap — es gibt keinen
vorangelegten Nutzer. Der erste Admin eines Mandanten entsteht ausschließlich
durch dessen Registrierung.

Healthcheck: `GET /api/health` (öffentlich, `200`).

## 5. Betreiber-Panel

`https://admin.luxstage.app` → Login mit `OPERATOR_USER` / `OPERATOR_PASSWORD`.

Funktionen:
- Alle Mandanten auflisten (E-Mail, Registrierdatum, Shows-/Nutzerzahl).
- Mandant **sperren/entsperren** (gesperrte können sich nicht einloggen).
- Mandant **löschen** (entfernt DB-Dateien vollständig — DSGVO).
- Offene (unbestätigte) Registrierungen einsehen.

Das Panel ist ein eigener Sicherheitsbereich mit eigenem Token (`scope: operator`);
ein Mandanten-Login gilt dort nicht.

## 6. Registrierungs-Fluss (zur Referenz)

1. Nutzer öffnet `luxstage.app/register`, wählt Team-Kürzel + E-Mail + Passwort.
2. Server legt eine **pending**-Registrierung an, verschickt Bestätigungslink an die E-Mail.
3. Klick auf den Link (`<team>.luxstage.app/register/confirm?token=…`) legt die
   Mandanten-DB an und schreibt den ersten Admin.
4. Login auf `<team>.luxstage.app`.

Pending-Einträge verfallen nach 24 h und werden stündlich aufgeräumt.

## 7. Backups

Alle Daten liegen im Volume `luxstage-saas-data` (`/app/data`):

```
data/
  registry.db              # Mandantenverzeichnis + pending
  luxstage.db              # globale DB (im SaaS-Modus ungenutzt)
  tenants/<id>/luxstage.db # je Mandant eine DB
```

Backup = das Verzeichnis sichern (SQLite: Dateien konsistent kopieren, z. B. per
`sqlite3 .backup` oder Volume-Snapshot bei ruhendem Container). Off-site empfohlen —
es sind fremde Kundendaten.

## 8. Skalierung

LuxStage läuft als **ein** Prozess pro Instanz. Vertikal skalieren (mehr CPU/RAM),
nicht horizontal.

Grund: Ein Teil des Laufzeit-Zustands liegt im Prozessspeicher und nicht in der
Datenbank — SSE-Verbindungen und Präsenz (`server/sse.js`), Download-/Inline-Token
(`server/auth.js`), das globale Rate-Limit (`server/rate-limit.js`), die
Login-Fehlversuche (`server/routes/auth.js`) und die History-Snapshot-Hashes
(`server/history.js`). Ein zweiter Prozess hätte davon eine eigene Kopie: Nutzer
an derselben Show sähen einander nicht mehr, und ein Download-Token wäre nur bei
dem Prozess einlösbar, der es ausgestellt hat.

Dazu kommt SQLite: zwei schreibende Prozesse auf derselben Datei beschädigen sie.
`server/index.js` erzwingt das per PID-Lockfile und bricht einen zweiten Start ab.

Wenn ein Prozess nicht mehr reicht: Mandanten auf mehrere Instanzen aufteilen
(Sharding über die Subdomain), nicht dieselbe Instanz duplizieren — die
Datenhaltung ist ohnehin schon pro Mandant getrennt.

Aktuelle Grenzen im Prozess: maximal 50 gleichzeitig offene Mandanten-Verbindungen
(`MAX_OPEN_TENANT_DBS` in `server/tenants.js`, LRU-Verdrängung; ein verdrängter
Mandant öffnet beim nächsten Request in Millisekunden neu).

## 9. Kostenrahmen (Start)

- VPS: ~10 €/Monat
- Domain: ~15 €/Jahr
- Caddy, Let's Encrypt, DNS-API: 0 €
- SMTP: je nach Anbieter (kleine Volumina oft kostenlos)
