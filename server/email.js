import nodemailer from 'nodemailer'
import { config } from './config.js'
import { getDb } from './db-context.js'
import { getSecretSetting } from './db/settings.js'

function getSmtpCfg() {
  // SaaS-Modus (BASE_DOMAIN gesetzt): immer die zentrale ENV-Config des Betreibers.
  // Mandanten können SMTP nicht übersteuern — alle Mails gehen zentral raus.
  if (config.baseDomain) return config.smtp

  // Self-Hosted: pro-Instanz-Config aus der DB, sonst ENV-Fallback.
  try {
    const rows = getDb().prepare("SELECT key, value FROM settings WHERE key LIKE 'smtp.%'").all()
    if (!rows.length) return config.smtp
    const cfg = { host: '', port: 587, secure: false, user: '', pass: '', from: config.smtp.from }
    for (const { key, value } of rows) {
      const k = key.replace('smtp.', '')
      if (k === 'pass') continue
      if (k === 'secure') cfg.secure = value === 'true'
      else if (k === 'port') cfg.port = parseInt(value) || 587
      else cfg[k] = value
    }
    cfg.pass = getSecretSetting('smtp.pass')
    return cfg
  } catch {
    return config.smtp
  }
}

/**
 * Ist ein Mailversand überhaupt möglich? Ohne Host gibt es keinen Transport.
 * Öffentlich abfragbar über /api/status — verrät nur ja/nein, keine Zugangsdaten.
 */
export function isSmtpConfigured() {
  return !!getSmtpCfg()?.host
}

function createTransport(cfg) {
  if (!cfg?.host) return null
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    // Container-Netzwerke haben oft kein funktionierendes IPv6, DNS liefert
    // aber häufig AAAA zuerst — ohne Zwang auf IPv4 hängt die Verbindung
    // bis zum Timeout (kein Happy-Eyeballs-Fallback in Nodemailer).
    family: 4,
    connectionTimeout: 10_000, // Verbindungsaufbau
    greetingTimeout: 10_000,   // SMTP-Greeting nach Connect
    socketTimeout: 20_000,     // Inaktivität während der Übertragung
  })
}

async function sendMail(to, subject, text) {
  const cfg = getSmtpCfg()
  const transport = createTransport(cfg)
  if (!transport) {
    console.warn('[email] SMTP nicht konfiguriert – Email nicht gesendet:', subject)
    return
  }
  await transport.sendMail({ from: cfg.from, to, subject, text })
}

export async function sendWelcomeEmail(email, username, initialPassword) {
  await sendMail(
    email,
    'Willkommen bei LuxStage',
    `Hallo,\n\ndein LuxStage-Account wurde erstellt.\n\nE-Mail: ${username}\nPasswort: ${initialPassword}\n\nZum Anmelden: ${config.appUrl}\n\nBitte melde dich an und ändere dein Passwort beim ersten Login.\n\nLuxStage`
  )
}

export async function sendConfirmEmail(email, tenantId, confirmUrl) {
  await sendMail(
    email,
    'LuxStage – Registrierung bestätigen',
    `Hallo,\n\ndu hast das Team "${tenantId}" bei LuxStage registriert.\n\nBitte bestätige deine E-Mail-Adresse über diesen Link:\n${confirmUrl}\n\nDer Link ist 24 Stunden gültig. Wenn du dich nicht registriert hast, ignoriere diese Mail.\n\nLuxStage`
  )
}

export async function sendPasswordResetLink(email, username, resetUrl) {
  await sendMail(
    email,
    'LuxStage – Passwort zurücksetzen',
    `Hallo ${username},\n\ndu hast angefragt, dein LuxStage-Passwort zurückzusetzen.\n\nÜber diesen Link kannst du ein neues Passwort vergeben:\n${resetUrl}\n\nDer Link ist 1 Stunde gültig. Wenn du das nicht warst, ignoriere diese Mail — dein Passwort bleibt unverändert.\n\nLuxStage`
  )
}

export async function sendPendingRegistrationEmail(email) {
  await sendMail(
    email,
    'LuxStage – Registrierung eingegangen',
    `Hallo,\n\ndeine Registrierung bei LuxStage ist eingegangen. Ein Teammitglied muss deinen Zugang noch freischalten, bevor du dich anmelden kannst.\n\nLuxStage`
  )
}

export async function sendApprovalRequestEmail(toEmails, newUserEmail) {
  await Promise.all(toEmails.map(to => sendMail(
    to,
    'LuxStage – Neue Registrierung wartet auf Freischaltung',
    `Hallo,\n\n${newUserEmail} hat sich bei eurem LuxStage-Team registriert und wartet auf Freischaltung.\n\nZum Freischalten: ${config.appUrl} → Einstellungen → Benutzer.\n\nLuxStage`
  )))
}

export async function sendTestEmail(to, cfg) {
  const transport = createTransport(cfg)
  if (!transport) throw new Error('SMTP nicht konfiguriert')
  await transport.sendMail({
    from: cfg.from,
    to,
    subject: 'LuxStage – Test-Mail',
    text: `Die SMTP-Konfiguration funktioniert. Zum Anmelden: ${config.appUrl}`,
  })
}
