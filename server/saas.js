// LuxStage/server/saas.js
// Bündelt die Mandanten-Module (LuxStage läuft ausschließlich als SaaS).
import { config } from './config.js'
import * as tenantResolve from './tenant-resolve.js'
import * as tenants from './tenants.js'
import * as registry from './registry.js'
import * as dbContext from './db-context.js'
import * as teamStatus from './team-status.js'
import { operatorRoutes } from './routes/operator.js'
import { registerRoutes } from './routes/register.js'
import { tenantDeleteRoutes } from './routes/tenant-delete.js'
import { feedbackRoutes } from './routes/feedback.js'

const mod = {
  resolveTenantId: tenantResolve.resolveTenantId,
  isOperatorHost: tenantResolve.isOperatorHost,
  isRootHost: tenantResolve.isRootHost,
  tenantBaseUrl: tenantResolve.tenantBaseUrl,
  getTenantId: dbContext.getTenantId,
  openTenantDb: tenants.openTenantDb,
  tenantExists: tenants.tenantExists,
  markTenantInUse: tenants.markTenantInUse,
  releaseTenantInUse: tenants.releaseTenantInUse,
  isSuspended: registry.isSuspended,
  getTenant: registry.getTenant,
  setOwnerUsername: registry.setOwnerUsername,
  // Ohne aktive Abrechnung läuft kein Team ab.
  computeTeamStatus: (tenant, nowMs) => config.billingEnabled
    ? teamStatus.computeTeamStatus(tenant, nowMs)
    : { state: 'active', accessUntil: null },
  teamAccessDenial: teamStatus.teamAccessDenial,
  runWithDb: dbContext.runWithDb,
  operatorRoutes,
  registerRoutes,
  tenantDeleteRoutes,
  feedbackRoutes,
}

export function getSaas() {
  return mod
}
