// LuxStage/server/team-owner.js
// Inhaber eines Teams (Abrechnung, Inhaber übertragen, Team löschen). Alle anderen Nutzer sind Mitglieder.
// Der Inhaber steht in der Registry (owner_username). Fehlt der Eintrag (Bestand), gilt der Nutzer,
// dessen E-Mail der Registrierungs-E-Mail des Teams entspricht; er wird beim ersten Zugriff gespeichert.
// Läuft im DB-Kontext eines Requests.
import { getSaas } from './saas.js'
import { getTenantId } from './db-context.js'
import { findUserByEmail, listUsers } from './db/users.js'

export function resolveOwner() {
  const saas = getSaas()
  const tenantId = getTenantId()
  const tenant = tenantId && saas.getTenant(tenantId)
  if (!tenant) return null
  const active = listUsers().filter(u => !u.pending)
  if (tenant.owner_username && active.some(u => u.username === tenant.owner_username)) return tenant.owner_username
  const byEmail = findUserByEmail(tenant.email)
  if (byEmail && active.some(u => u.username === byEmail)) {
    saas.setOwnerUsername(tenantId, byEmail)
    return byEmail
  }
  return null
}

export function isOwner(username) {
  return resolveOwner() === username
}

// Überträgt die Inhaberschaft an einen bestehenden, freigeschalteten Nutzer.
export function transferOwnership(toUsername) {
  const saas = getSaas()
  const target = listUsers().find(u => u.username === toUsername && !u.pending)
  if (!target) return false
  saas.setOwnerUsername(getTenantId(), toUsername)
  return true
}
