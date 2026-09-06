import { api } from './client'

/** GET /api/smtp (server/routes/smtp.js) — im SaaS-Modus nur `{ managed: true }`
 *  (SMTP wird zentral verwaltet), sonst die volle Konfiguration mit maskiertem Passwort. */
export type SmtpConfigResponse =
  | { managed: true }
  | { host: string, port: string, secure: boolean, user: string, pass: string, from: string }

export interface SmtpConfigInput {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  /** leer = unverändert lassen (server/routes/smtp.js:24). */
  pass: string;
  from: string;
}

export function getSmtpConfig(): Promise<SmtpConfigResponse> { return api.get('/api/smtp') }
export function saveSmtpConfig(cfg: SmtpConfigInput): Promise<{ ok: true }> { return api.post('/api/smtp', cfg) }
export function testSmtpConfig(to: string): Promise<{ ok: true }> { return api.post('/api/smtp/test', { to }) }
