// LuxStage/server/saas.js
// Kapselt die SaaS-Funktionalität und lädt sie NUR im SaaS-Modus (BASE_DOMAIN gesetzt).
// Dadurch enthält das Self-Hosted-Image die SaaS-Module gar nicht erst (bedingter
// dynamischer Import — die Dateien dürfen im schlanken Image fehlen, ohne Crash).
import { config } from './config.js'

export const saasEnabled = !!config.baseDomain

// Dynamisch geladene SaaS-Handler (nur im SaaS-Modus befüllt).
let mod = null

// Lädt die SaaS-Module einmalig. Nur aufrufen, wenn saasEnabled true ist.
async function load() {
  if (mod) return mod
  const [tenantResolve, tenants, registry, dbContext, operatorRoutes, registerRoutes] = await Promise.all([
    import('./tenant-resolve.js'),
    import('./tenants.js'),
    import('./registry.js'),
    import('./db-context.js'),
    import('./routes/operator.js'),
    import('./routes/register.js'),
  ])
  mod = {
    resolveTenantId: tenantResolve.resolveTenantId,
    isOperatorHost: tenantResolve.isOperatorHost,
    isRootHost: tenantResolve.isRootHost,
    openTenantDb: tenants.openTenantDb,
    tenantExists: tenants.tenantExists,
    markTenantInUse: tenants.markTenantInUse,
    releaseTenantInUse: tenants.releaseTenantInUse,
    isSuspended: registry.isSuspended,
    runWithDb: dbContext.runWithDb,
    operatorRoutes: operatorRoutes.operatorRoutes,
    registerRoutes: registerRoutes.registerRoutes,
  }
  return mod
}

// Beim Start vorladen, damit die Handler synchron verfügbar sind.
export const saasReady = saasEnabled ? load() : Promise.resolve(null)

export function getSaas() {
  return mod
}
