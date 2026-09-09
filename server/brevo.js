// LuxStage/server/brevo.js
// Newsletter-Double-Opt-in bei Brevo für Mandanten, die bei der Registrierung
// zugestimmt haben. Nutzt Brevo's DOI-Endpoint (v3/contacts/doubleOptinConfirmation) —
// Brevo verschickt selbst eine eigene Bestätigungsmail für den Newsletter,
// getrennt von der LuxStage-Registrierungsbestätigung; der Consent-Nachweis
// (Zeitstempel + Klick) liegt damit vollständig bei Brevo. Kein SDK — ein
// einzelner REST-Call genügt, ein Abhängigkeits-Overhead lohnt sich nicht.
import { config } from './config.js'
import { logger } from './logger.js'

const log = logger('brevo')

export function isBrevoConfigured() {
  return !!config.brevo.apiKey && !!config.brevo.listId && !!config.brevo.doiTemplateId && !!config.brevo.doiRedirectUrl
}

// Best-effort: ein Fehler bei Brevo darf die Registrierung nie blockieren.
export async function startNewsletterDoubleOptin(email) {
  if (!isBrevoConfigured()) {
    log.warn('Brevo DOI nicht konfiguriert – Newsletter-Anmeldung übersprungen', { email })
    return
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: {
        'api-key': config.brevo.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email,
        includeListIds: [config.brevo.listId],
        templateId: config.brevo.doiTemplateId,
        redirectionUrl: config.brevo.doiRedirectUrl,
      }),
    })
    if (!res.ok && res.status !== 400) {
      const text = await res.text().catch(() => '')
      log.error('Brevo-DOI-Start fehlgeschlagen', { email, status: res.status, body: text })
    }
  } catch (err) {
    log.error('Brevo-Request fehlgeschlagen', { email, fehler: err.message })
  }
}
