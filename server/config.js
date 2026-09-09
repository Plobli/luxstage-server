import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FEHLER: JWT_SECRET fehlt oder zu kurz (min. 32 Zeichen). Server wird beendet.')
  process.exit(1)
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  dataPath: process.env.DATA_PATH || path.join(__dirname, '..', 'data'),
  jwtSecret,
  // Eigenes Secret für die Settings-at-Rest-Verschlüsselung (db/settings.js),
  // damit ein JWT_SECRET-Leak nicht automatisch auch gespeicherte Secrets
  // (z.B. SMTP-Passwort) entschlüsselbar macht. Fallback auf jwtSecret hält
  // bestehende Deployments ohne diese neue Variable funktionsfähig — wer
  // Schlüsseltrennung will, setzt SETTINGS_ENC_KEY explizit.
  settingsEncKey: process.env.SETTINGS_ENC_KEY || jwtSecret,
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  trustProxy: process.env.TRUST_PROXY === 'true',
  // SaaS: Basis-Domain, unter der Mandanten als Subdomain laufen (z. B. luxstage.app
  // für team-a.luxstage.app). Leer = Single-Tenant/Self-Hosted (keine Subdomain-Auflösung).
  baseDomain: process.env.BASE_DOMAIN || '',
  // Betreiber-Panel (admin.<baseDomain>): eigener Zugang, getrennt von Mandanten-Admins.
  // Ohne gesetztes Passwort ist das Panel deaktiviert (kein vorangelegter Zugang).
  operator: {
    user: process.env.OPERATOR_USER || 'operator',
    password: process.env.OPERATOR_PASSWORD || '',
  },
  lockTimeout: 10 * 60 * 1000, // 10 Minuten in ms
  photoMaxWidth: 1500,
  photoQuality: 70,
  photoThumbWidth: 400,
  photoThumbQuality: 60,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'LuxStage <noreply@luxstage.local>',
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    listId: parseInt(process.env.BREVO_LIST_ID || '0') || 0,
    // Double-Opt-in: eigene Brevo-E-Mail-Vorlage für die Newsletter-Bestätigung,
    // getrennt von der LuxStage-Registrierungsbestätigung.
    doiTemplateId: parseInt(process.env.BREVO_DOI_TEMPLATE_ID || '0') || 0,
    doiRedirectUrl: process.env.BREVO_DOI_REDIRECT_URL || '',
  },
}
