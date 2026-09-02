#!/usr/bin/env bash
set -e

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
step() { echo -e "  →  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  Fehler: $1"; exit 1; }

# ── TTY-Check + Root-Check ────────────────────────────────────────────────────
if [ ! -t 0 ] || [ "$(id -u)" -ne 0 ]; then
  echo ""
  echo "  LuxStage installieren — bitte diese zwei Befehle ausführen:"
  echo ""
  echo "    curl -fsSL https://raw.githubusercontent.com/Plobli/LuxStage/main/install.sh -o /tmp/luxstage-install.sh"
  echo "    sudo bash /tmp/luxstage-install.sh"
  echo ""
  exit 1
fi

# ── Konstanten ────────────────────────────────────────────────────────────────
GITHUB_REPO="Plobli/LuxStage"

# ── Preflight ─────────────────────────────────────────────────────────────────
step "Prüfe Voraussetzungen..."
curl -sf --max-time 5 https://github.com > /dev/null || fail "Kein Internetzugang."
ok "Voraussetzungen erfüllt"

# ── Nutzereingaben ────────────────────────────────────────────────────────────
read -rp "Systemnutzer für LuxStage [luxstage]: " SERVICE_USER
SERVICE_USER="${SERVICE_USER:-luxstage}"
[[ $SERVICE_USER =~ ^[a-z_][a-z0-9_-]*$ ]] || fail "Ungültiger Nutzername (nur Kleinbuchstaben, Ziffern, - und _)."

read -rp "Hostname [luxstage]: " HOSTNAME
HOSTNAME="${HOSTNAME:-luxstage}"
[[ $HOSTNAME =~ ^[a-zA-Z0-9._-]+$ ]] || fail "Ungültiger Hostname."

read -rp "Externe Domain (optional, z. B. https://luxstage.example.com): " EXTERNAL_DOMAIN
EXTERNAL_DOMAIN="${EXTERNAL_DOMAIN:-}"
if [[ -n "$EXTERNAL_DOMAIN" ]]; then
  [[ $EXTERNAL_DOMAIN =~ ^https?:// ]] || fail "Domain muss mit http:// oder https:// beginnen."
fi

# Die E-Mail-Adresse ist zugleich der Login-Name — die Web-App erwartet überall
# E-Mail-Adressen (Benutzerverwaltung, Registrierung, Passwort-Reset).
ADMIN_EMAIL=""
for i in 1 2 3; do
  read -rp "Admin-E-Mail (dient als Login): " ADMIN_EMAIL
  if [[ "$ADMIN_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    ok "E-Mail gespeichert"
    break
  fi
  echo "  Keine gültige E-Mail-Adresse."
  ADMIN_EMAIL=""
  [[ $i -eq 3 ]] && fail "Zu viele Fehlversuche."
done

MIN_PW_LEN=8
set +e
ADMIN_PASSWORD=""
for i in 1 2 3; do
  read -rsp "Admin-Passwort (mind. ${MIN_PW_LEN} Zeichen): " PW1; echo
  read -rsp "Admin-Passwort bestätigen: " PW2; echo
  if [[ -z "$PW1" ]]; then
    echo "  Passwort darf nicht leer sein."
  elif [[ ${#PW1} -lt $MIN_PW_LEN ]]; then
    echo "  Passwort zu kurz (mind. ${MIN_PW_LEN} Zeichen)."
    PW1=""; PW2=""
  elif [[ "$PW1" != "$PW2" ]]; then
    echo "  Passwörter stimmen nicht überein."
    PW1=""; PW2=""
  else
    ADMIN_PASSWORD="$PW1"
    PW1=""; PW2=""
    ok "Passwort gespeichert"
    break
  fi
  [[ $i -eq 3 ]] && { echo -e "  ${RED}✗${RESET}  Fehler: Zu viele Fehlversuche."; exit 1; }
done
set -e
PW1=""; PW2=""

JWT_SECRET=$(openssl rand -hex 32)

SERVICE_HOME="/home/$SERVICE_USER"
INSTALL_DIR="$SERVICE_HOME/LuxStage"
DATA_DIR="$INSTALL_DIR/data"

echo ""
echo "  Systemnutzer: $SERVICE_USER"
echo "  Hostname:     $HOSTNAME"
echo "  Externe Domain: ${EXTERNAL_DOMAIN:-–}"
echo "  Verzeichnis:  $INSTALL_DIR"
echo ""

# ── Paketlisten aktualisieren ─────────────────────────────────────────────────
step "Aktualisiere Paketlisten..."
apt-get update -qq
ok "Paketlisten aktualisiert"

# ── Systemnutzer anlegen ──────────────────────────────────────────────────────
step "Lege Systemnutzer '$SERVICE_USER' an..."
if id "$SERVICE_USER" &>/dev/null; then
  ok "Nutzer '$SERVICE_USER' existiert bereits"
else
  useradd --create-home --shell /bin/bash "$SERVICE_USER"
  chmod 755 "$SERVICE_HOME"
  ok "Nutzer '$SERVICE_USER' angelegt"
fi

# ── Build-Tools für native Node-Module (bcrypt, sharp) ───────────────────────
step "Installiere Build-Tools..."
apt-get install -y build-essential python3 unzip
ok "Build-Tools installiert"

# ── Caddy installieren ────────────────────────────────────────────────────────
step "Installiere Caddy..."
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
apt-get update -qq
apt-get install -y caddy
ok "Caddy installiert"

# ── avahi-daemon installieren (für *.local) ───────────────────────────────────
step "Installiere avahi-daemon..."
apt-get install -y avahi-daemon
systemctl enable avahi-daemon
systemctl start avahi-daemon
ok "avahi-daemon installiert und gestartet"

# ── Hostname setzen ───────────────────────────────────────────────────────────
step "Setze Hostname '$HOSTNAME'..."
OLD_HOSTNAME=$(hostname)
hostnamectl set-hostname "$HOSTNAME"
sed -i "s/\b${OLD_HOSTNAME}\b/$HOSTNAME/g" /etc/hosts
ok "Hostname gesetzt"

# ── Hilfs-Script für Service-User-Schritte ───────────────────────────────────
# Alle Schritte die als $SERVICE_USER laufen müssen in ein echtes Script,
# damit $HOME korrekt auf /home/$SERVICE_USER zeigt und kein Quoting-Problem entsteht.
USERSCRIPT=$(mktemp /tmp/luxstage-user.XXXXXX.sh)
chmod 755 "$USERSCRIPT"

cat > "$USERSCRIPT" << SCRIPT
#!/usr/bin/env bash
set -e

cd "\$HOME"
NVM_DIR="\$HOME/.nvm"
INSTALL_DIR="$INSTALL_DIR"
GITHUB_REPO="$GITHUB_REPO"

# nvm + Node.js 22
if [ ! -d "\$NVM_DIR" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "\$NVM_DIR/nvm.sh"
nvm install 22 --no-progress
nvm use 22
nvm alias default 22
echo "node_ok:\$(node -v)"

# PM2
npm install -g pm2 --silent
echo "pm2_ok"

# Download Latest Release
echo "  →  Lade aktuellste Release herunter..."
LATEST_RELEASE_URL=\$(curl -s https://api.github.com/repos/Plobli/LuxStage/releases/latest | grep -o '"browser_download_url": "[^"]*luxstage-release.zip[^"]*"' | cut -d'"' -f4)
if [ -z "\$LATEST_RELEASE_URL" ]; then
  echo "Fehler: Release-Download-URL nicht gefunden"
  exit 1
fi
curl -fsSL "\$LATEST_RELEASE_URL" -o /tmp/luxstage-release.zip
unzip -q /tmp/luxstage-release.zip -d "\$INSTALL_DIR"
rm -f /tmp/luxstage-release.zip
echo "repo_ok"

# Server-Abhängigkeiten
echo "  →  Installiere Server-Abhängigkeiten..."
cd "\$INSTALL_DIR/server"
npm install --silent
echo "server_ok"

echo "setup_ok"
SCRIPT

# ── Alle User-Schritte als Service-User ausführen ────────────────────────────
step "Installiere nvm, Node.js 22, PM2 und Repository für '$SERVICE_USER'..."
sudo -i -u "$SERVICE_USER" bash "$USERSCRIPT"
ok "Node.js, PM2, Repository und Web-App bereit"

rm -f "$USERSCRIPT"

# ── Data-Verzeichnis ──────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
ok "Datenverzeichnis bereit: $DATA_DIR"

# ── Nutzer in DB anlegen ──────────────────────────────────────────────────────
step "Lege Nutzer in Datenbank an..."
BOOTSTRAP_ENV=$(mktemp /tmp/luxstage-bootstrap.XXXXXX.env)
chmod 600 "$BOOTSTRAP_ENV"
trap 'rm -f "$USERSCRIPT" "$BOOTSTRAP_ENV"' EXIT
{
  printf 'ADMIN_EMAIL=%q\n' "$ADMIN_EMAIL"
  printf 'ADMIN_PASSWORD=%q\n' "$ADMIN_PASSWORD"
  printf 'JWT_SECRET=%q\n' "$JWT_SECRET"
  printf 'DATA_PATH=%q\n' "$DATA_DIR"
} > "$BOOTSTRAP_ENV"
chown "$SERVICE_USER:$SERVICE_USER" "$BOOTSTRAP_ENV"
sudo -i -u "$SERVICE_USER" bash -c '
  set -a
  . "$1"
  set +a
  . "$HOME/.nvm/nvm.sh"
  node "$2"
' -- "$BOOTSTRAP_ENV" "$INSTALL_DIR/server/bootstrap.js"
rm -f "$BOOTSTRAP_ENV"
trap - EXIT
ok "Nutzer angelegt"

# ── CORS_ORIGINS zusammenstellen ─────────────────────────────────────────────
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
CORS_ORIGINS_VALUE="http://$HOSTNAME.local"
[ -n "$SERVER_IP" ] && CORS_ORIGINS_VALUE="$CORS_ORIGINS_VALUE,http://$SERVER_IP"
[ -n "$EXTERNAL_DOMAIN" ] && CORS_ORIGINS_VALUE="$CORS_ORIGINS_VALUE,$EXTERNAL_DOMAIN"

# ── PM2 Ecosystem-Datei ───────────────────────────────────────────────────────
step "Erstelle PM2-Konfiguration..."
cat > "$INSTALL_DIR/ecosystem.config.cjs" << EOF
module.exports = {
  apps: [{
    name: 'luxstage',
    script: 'index.js',
    cwd: '$INSTALL_DIR/server',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: '$JWT_SECRET',
      DATA_PATH: '$DATA_DIR',
      CORS_ORIGINS: '$CORS_ORIGINS_VALUE',
    }
  }]
}
EOF
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/ecosystem.config.cjs"
chmod 600 "$INSTALL_DIR/ecosystem.config.cjs"
ok "PM2-Konfiguration erstellt"

# ── PM2 starten und autostart einrichten ─────────────────────────────────────
step "Starte LuxStage mit PM2..."

sudo -i -u "$SERVICE_USER" bash -c '. $HOME/.nvm/nvm.sh && pm2 start '"'$INSTALL_DIR/ecosystem.config.cjs'"' && pm2 save'
sudo -i -u "$SERVICE_USER" bash -c 'chmod 600 "$HOME/.pm2/dump.pm2" 2>/dev/null || true'

PM2_STARTUP=$(sudo -i -u "$SERVICE_USER" bash -c ". \$HOME/.nvm/nvm.sh && pm2 startup systemd -u $SERVICE_USER --hp $SERVICE_HOME" | grep "sudo env" || true)
[ -n "$PM2_STARTUP" ] && eval "$PM2_STARTUP"
ok "LuxStage läuft und startet automatisch beim Booten"

# ── Caddy konfigurieren ───────────────────────────────────────────────────────
step "Konfiguriere Caddy..."
{
  echo "http://$HOSTNAME.local {"
  echo "    reverse_proxy localhost:3000"
  echo "}"
  if [ -n "$EXTERNAL_DOMAIN" ]; then
    DOMAIN_HOST="${EXTERNAL_DOMAIN#*://}"
    echo ""
    echo "$DOMAIN_HOST {"
    echo "    reverse_proxy localhost:3000"
    echo "}"
  fi
} | tee /etc/caddy/Caddyfile > /dev/null
systemctl restart caddy
ok "Caddy konfiguriert"

# ── Fertig ────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}✓  LuxStage wurde erfolgreich installiert.${RESET}"
echo ""
echo "     Erreichbar unter:  http://$HOSTNAME.local"
[ -n "$EXTERNAL_DOMAIN" ] && echo "                        $EXTERNAL_DOMAIN"
[ -n "$SERVER_IP" ]       && echo "                        http://$SERVER_IP"
echo "     Login:             $ADMIN_EMAIL"
echo ""
echo "  Weitere Nutzer legst du nach der Anmeldung unter"
echo "  Einstellungen → Benutzer an."
echo ""
echo "  Hinweis: Neustart empfohlen damit der neue Hostname aktiv wird:"
echo "           sudo reboot"
echo ""
