// LuxStage/server/routes/operator.js
// Betreiber-Panel-API (nur auf admin.<baseDomain>, hinter requireOperator).
//   POST   /api/operator/login              -> Betreiber-Token
//   GET    /api/operator/tenants            -> Mandantenliste + Kennzahlen
//   GET    /api/operator/tenants/:id        -> Detail
//   POST   /api/operator/tenants/:id/suspend   { suspended: bool }
//   DELETE /api/operator/tenants/:id        -> Mandant komplett löschen (DSGVO)
//   GET    /api/operator/pending            -> offene Registrierungen
//   POST   /api/operator/pending/:id/resend -> Bestätigungsmail erneut senden
//   DELETE /api/operator/pending/:id        -> offene Registrierung verwerfen
import { json, readJsonBody } from '../helpers.js'
import { operatorLogin, requireOperator, operatorEnabled } from '../operator.js'
import { openTenantDb, deleteTenant, tenantExists } from '../tenants.js'
import { runWithDb } from '../db-context.js'
import {
  listTenants, getTenant, setSuspended, removeTenant, listPending,
  getPendingByTenant, refreshPendingExpiry, removePendingByTenant,
} from '../registry.js'
import {
  createSnapshot, listSnapshots, restoreSnapshot, snapshotPath, deleteBackups,
} from '../tenant-backup.js'
import { config } from '../config.js'
import { sendConfirmEmail } from '../email.js'
import { CONFIRM_TTL_MS } from './register.js'
import fs from 'node:fs'

// Kennzahlen eines Mandanten aus seiner DB lesen (Shows, Nutzer).
function tenantStats(tenantId) {
  if (!tenantExists(tenantId)) return { shows: null, users: null }
  const db = openTenantDb(tenantId)
  return runWithDb(db, () => ({
    shows: db.prepare('SELECT count(*) c FROM shows').get().c,
    users: db.prepare('SELECT count(*) c FROM users').get().c,
  }), tenantId)
}

export async function operatorRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'POST' && pathname === '/api/operator/login') {
    if (!operatorEnabled()) return json(res, 404, { error: 'Betreiber-Panel nicht aktiviert' })
    const body = await readJsonBody(req, res); if (body === null) return
    const result = operatorLogin(String(body.username || ''), String(body.password || ''))
    if (!result) return json(res, 401, { error: 'Ungültige Betreiber-Anmeldedaten' })
    return json(res, 200, result)
  }

  // Ab hier: alles geschützt.
  if (!requireOperator(req, res)) return

  if (method === 'GET' && pathname === '/api/operator/tenants') {
    const tenants = listTenants().map(t => ({
      tenantId: t.tenant_id,
      email: t.email,
      createdAt: t.created_at,
      suspended: t.suspended === 1,
      ...tenantStats(t.tenant_id),
    }))
    return json(res, 200, { tenants })
  }

  const detail = pathname.match(/^\/api\/operator\/tenants\/([a-z0-9-]+)$/)
  if (detail) {
    const id = detail[1]
    const t = getTenant(id)
    if (!t) return json(res, 404, { error: 'Mandant nicht gefunden' })

    if (method === 'GET') {
      return json(res, 200, {
        tenantId: t.tenant_id, email: t.email, createdAt: t.created_at,
        suspended: t.suspended === 1, ...tenantStats(id),
      })
    }
    if (method === 'DELETE') {
      removeTenant(id)      // aus Verzeichnis
      deleteTenant(id)      // DB-Dateien löschen
      deleteBackups(id)     // Snapshots löschen
      console.log(`[operator] Mandant gelöscht: ${id}`)
      return json(res, 200, { ok: true })
    }
  }

  // ── Backups pro Mandant ──────────────────────────────────────────────────
  const backups = pathname.match(/^\/api\/operator\/tenants\/([a-z0-9-]+)\/backups$/)
  if (backups) {
    const id = backups[1]
    if (!getTenant(id)) return json(res, 404, { error: 'Mandant nicht gefunden' })
    if (method === 'GET') {
      return json(res, 200, { snapshots: listSnapshots(id) })
    }
    if (method === 'POST') { // manuellen Snapshot erstellen
      const name = await createSnapshot(id)
      console.log(`[operator] Snapshot erstellt: ${id}/${name}`)
      return json(res, 201, { ok: true, name })
    }
  }

  const restore = pathname.match(/^\/api\/operator\/tenants\/([a-z0-9-]+)\/backups\/restore$/)
  if (restore && method === 'POST') {
    const id = restore[1]
    if (!getTenant(id)) return json(res, 404, { error: 'Mandant nicht gefunden' })
    const body = await readJsonBody(req, res); if (body === null) return
    try {
      await restoreSnapshot(id, String(body.name || ''))
      console.log(`[operator] Snapshot wiederhergestellt: ${id}/${body.name}`)
      return json(res, 200, { ok: true })
    } catch (err) {
      return json(res, 400, { error: err.message })
    }
  }

  const download = pathname.match(/^\/api\/operator\/tenants\/([a-z0-9-]+)\/backups\/([^/]+)\/download$/)
  if (download && method === 'GET') {
    const id = download[1]
    const name = decodeURIComponent(download[2])
    const p = snapshotPath(id, name)
    if (!p) return json(res, 404, { error: 'Snapshot nicht gefunden' })
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${id}-${name}"`,
    })
    fs.createReadStream(p).pipe(res)
    return
  }

  const suspend = pathname.match(/^\/api\/operator\/tenants\/([a-z0-9-]+)\/suspend$/)
  if (suspend && method === 'POST') {
    const id = suspend[1]
    if (!getTenant(id)) return json(res, 404, { error: 'Mandant nicht gefunden' })
    const body = await readJsonBody(req, res); if (body === null) return
    const changed = setSuspended(id, !!body.suspended)
    console.log(`[operator] Mandant ${id} ${body.suspended ? 'gesperrt' : 'entsperrt'}`)
    return json(res, 200, { ok: true, changed })
  }

  if (method === 'GET' && pathname === '/api/operator/pending') {
    const pending = listPending().map(p => ({
      tenantId: p.tenant_id, email: p.email, createdAt: p.created_at, expiresAt: p.expires_at,
    }))
    return json(res, 200, { pending })
  }

  const resend = pathname.match(/^\/api\/operator\/pending\/([a-z0-9-]+)\/resend$/)
  if (resend && method === 'POST') {
    const id = resend[1]
    const row = getPendingByTenant(id)
    if (!row) return json(res, 404, { error: 'Offene Registrierung nicht gefunden' })
    refreshPendingExpiry(id, CONFIRM_TTL_MS)
    const confirmUrl = `${config.appUrl}/register/confirm?token=${row.token}`
    try {
      await sendConfirmEmail(row.email, id, confirmUrl)
    } catch (err) {
      return json(res, 502, { error: 'Mailversand fehlgeschlagen: ' + err.message })
    }
    console.log(`[operator] Bestätigungsmail erneut gesendet: ${id}`)
    return json(res, 200, { ok: true })
  }

  const pendingDetail = pathname.match(/^\/api\/operator\/pending\/([a-z0-9-]+)$/)
  if (pendingDetail && method === 'DELETE') {
    const id = pendingDetail[1]
    const changed = removePendingByTenant(id)
    if (!changed) return json(res, 404, { error: 'Offene Registrierung nicht gefunden' })
    console.log(`[operator] Offene Registrierung gelöscht: ${id}`)
    return json(res, 200, { ok: true })
  }

  return null
}
