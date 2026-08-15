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
  // Rollen: admin (alles), techniker (shows lesen/schreiben, keine templates/backup/update)
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
}
