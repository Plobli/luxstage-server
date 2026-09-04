// LuxStage/server/db-context.js
// Request-gebundener DB-Kontext für Multi-Tenancy.
//
// Jeder API-Request läuft in einem AsyncLocalStorage-Kontext, der die DB des
// eingeloggten Mandanten trägt. getDb() liest sie dort heraus — so bekommen die
// DB-Module die richtige Verbindung, OHNE dass ihre Signaturen geändert werden.
//
// Außerhalb eines Request-Kontexts (Hintergrund-Jobs, Bootstrap, Single-Tenant)
// fällt getDb() auf die globale dbContainer.db zurück. Dieser Fallback macht die
// Umstellung schrittweise und rückwärtskompatibel.
import { AsyncLocalStorage } from 'node:async_hooks'
import { dbContainer } from './db-init.js'

const storage = new AsyncLocalStorage()

// Führt fn in einem Kontext aus, in dem getDb() die übergebene DB liefert.
// tenantId (optional) bindet den Kontext an einen Mandanten — für Token-Ausstellung.
export function runWithDb(db, fn, tenantId = null) {
  return storage.run({ db, tenantId }, fn)
}

// Die DB des aktuellen Request-Kontexts — oder die globale DB als Fallback.
// Die eigentliche Absicherung gegen "Request ohne aufgelösten Mandanten landet
// versehentlich auf der falschen DB" sitzt bei router.js: im SaaS-Betrieb
// erreicht ein Request ohne aufgelösten Mandanten handleApi() gar nicht erst
// (Ausnahme: die wenigen Endpunkte, die nachweislich keinen DB-Kontext
// brauchen). Dieser Fallback bleibt bewusst bestehen — Tests und Tools rufen
// DB-Module regelmäßig außerhalb eines Request-Kontexts auf.
export function getDb() {
  const store = storage.getStore()
  return store?.db ?? dbContainer.db
}

// Der Mandant des aktuellen Kontexts — oder null (öffentlich/Single-Tenant).
export function getTenantId() {
  return storage.getStore()?.tenantId ?? null
}

// Ob gerade ein Request-Kontext aktiv ist (v. a. für Tests/Diagnose).
export function hasDbContext() {
  return storage.getStore() !== undefined
}
