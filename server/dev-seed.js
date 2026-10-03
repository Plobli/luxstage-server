// LuxStage/server/dev-seed.js
// Legt lokal einen Test-Mandanten an (idempotent): <DEV_TENANT>.localhost.
// Aufruf: npm run dev:seed -w server  (liest .env: ADMIN_EMAIL, ADMIN_PASSWORD, DEV_TENANT)
import bcrypt from 'bcrypt'
import { createTenant, tenantExists } from './tenants.js'
import { getRegistry } from './registry.js'
import { runWithDb } from './db-context.js'
import { createConfirmedUser } from './db/users.js'
import { isValidEmail } from '../shared/constants.js'

const tenantId = (process.env.DEV_TENANT || 'lokal').toLowerCase()
const email = (process.env.ADMIN_EMAIL || '').trim()
const password = process.env.ADMIN_PASSWORD

if (!isValidEmail(email) || !password) {
  console.error('FEHLER: ADMIN_EMAIL (gültig) und ADMIN_PASSWORD in .env setzen.')
  process.exit(1)
}

if (tenantExists(tenantId)) {
  console.log(`Mandant "${tenantId}" existiert bereits.`)
  process.exit(0)
}

const tdb = createTenant(tenantId)
runWithDb(tdb, () => createConfirmedUser(email, bcrypt.hashSync(password, 12), email), tenantId)
getRegistry().prepare('INSERT INTO tenants (tenant_id, email, created_at) VALUES (?, ?, ?)').run(tenantId, email.toLowerCase(), Date.now())
console.log(`Mandant "${tenantId}" angelegt: http://localhost:5173`)
process.exit(0)
