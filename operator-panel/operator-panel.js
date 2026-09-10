const TOKEN_KEY = 'luxstage_operator_token'
const $ = s => document.querySelector(s)
let token = localStorage.getItem(TOKEN_KEY)

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) { logout(); throw new Error('Nicht angemeldet') }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'HTTP ' + res.status) }
  return res.status === 204 ? null : res.json()
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function fmtDate(ms) { return new Date(ms).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' }) }
function fmtExpiry(ms) {
  const diff = ms - Date.now()
  if (diff <= 0) return 'abgelaufen'
  const h = Math.floor(diff / 3600000)
  if (h >= 1) return `in ${h} h`
  return `in ${Math.max(1, Math.floor(diff / 60000))} min`
}

const SNAPSHOT_STALE_MS = 48 * 3600000 // Schwelle passend zum täglichen Auto-Backup-Job

// Konsistenzprüfungs-Ergebnisse bleiben bis zum nächsten Check/Reload sichtbar.
const checkResults = new Map() // tenantId -> { ok, issues }

function healthBadge(h) {
  if (!h || !h.reachable) return '<span class="tag sus">nicht erreichbar</span>'
  if (h.lastSnapshotAgeMs === null) return '<span class="tag sus">kein Backup</span>'
  if (h.lastSnapshotAgeMs > SNAPSHOT_STALE_MS) return '<span class="tag sus">Backup veraltet</span>'
  return '<span class="tag ok">gesund</span>'
}

function checkBadge(tenantId) {
  const r = checkResults.get(tenantId)
  if (!r) return '<span class="mut">–</span>'
  if (r.ok) return '<span class="tag ok">ok</span>'
  return `<span class="tag sus" title="${escapeHtml(r.issues.join('; '))}">${r.issues.length} Problem(e)</span>`
}

function show(view) {
  $('#loginView').classList.toggle('hidden', view !== 'login')
  $('#dashView').classList.toggle('hidden', view !== 'dash')
}

function logout() { token = null; localStorage.removeItem(TOKEN_KEY); show('login') }

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault()
  $('#loginErr').classList.add('hidden')
  try {
    const { token: t } = await api('POST', '/api/operator/login', { username: $('#u').value, password: $('#p').value })
    token = t; localStorage.setItem(TOKEN_KEY, t)
    await refresh(); show('dash')
  } catch (err) {
    $('#loginErr').textContent = err.message; $('#loginErr').classList.remove('hidden')
  }
})

$('#logoutBtn').addEventListener('click', logout)

async function loadTenants() {
  const { tenants } = await api('GET', '/api/operator/tenants')
  $('#count').textContent = tenants.length + ' Mandant(en)'
  $('#empty').classList.toggle('hidden', tenants.length > 0)
  const tbody = $('#tbody'); tbody.innerHTML = ''
  for (const t of tenants) {
    const tr = document.createElement('tr')
    const status = t.suspended ? '<span class="tag sus">gesperrt</span>' : healthBadge(t.health)
    const id = escapeHtml(t.tenantId)
    const h = t.health || {}
    const lastActivity = h.lastActivityAt
      ? `${fmtDate(h.lastActivityAt)}${h.lastActivityBy ? ' · ' + escapeHtml(h.lastActivityBy) : ''}`
      : '–'
    const dbSize = typeof h.dbSizeBytes === 'number' ? fmtSize(h.dbSizeBytes) : '–'
    tr.innerHTML = `
      <td><strong>${id}</strong></td>
      <td class="mut">${escapeHtml(t.email)}</td>
      <td class="mut">${fmtDate(t.createdAt)}</td>
      <td>${t.shows ?? '–'}</td>
      <td>${t.users ?? '–'}</td>
      <td class="mut">${lastActivity}</td>
      <td class="mut">${dbSize}</td>
      <td>${status}</td>
      <td data-check-cell="${id}">${checkBadge(t.tenantId)}</td>
      <td><div class="row-actions">
        <button class="ghost" data-act="backups" data-id="${id}">Backups</button>
        <button class="ghost" data-act="check" data-id="${id}">Konsistenz prüfen</button>
        <button class="ghost" data-act="toggle" data-id="${id}" data-sus="${t.suspended}">${t.suspended ? 'Entsperren' : 'Sperren'}</button>
        <button class="danger" data-act="delete" data-id="${id}">Löschen</button>
      </div></td>`
    tbody.appendChild(tr)
  }
}

async function loadPending() {
  const { pending } = await api('GET', '/api/operator/pending')
  $('#pendingCount').textContent = pending.length + ' offen'
  $('#pendingEmpty').classList.toggle('hidden', pending.length > 0)
  const body = $('#pendingBody'); body.innerHTML = ''
  for (const p of pending) {
    const tr = document.createElement('tr')
    const expired = p.expiresAt <= Date.now()
    const id = escapeHtml(p.tenantId)
    tr.innerHTML = `
      <td><strong>${id}</strong></td>
      <td class="mut">${escapeHtml(p.email)}</td>
      <td class="mut">${fmtDate(p.createdAt)}</td>
      <td class="${expired ? '' : 'mut'}">${fmtExpiry(p.expiresAt)}</td>
      <td><div class="row-actions">
        <button class="ghost" data-pact="resend" data-id="${id}">Erneut senden</button>
        <button class="danger" data-pact="delete" data-id="${id}">Löschen</button>
      </div></td>`
    body.appendChild(tr)
  }
}

async function loadVersion() {
  try {
    const { version } = await api('GET', '/api/operator/version')
    $('#version').textContent = 'v' + version
  } catch { /* nicht kritisch fürs Panel */ }
}

async function refresh() { await Promise.all([loadTenants(), loadPending(), loadVersion()]) }

// ── Backup-Dialog ────────────────────────────────────────────────────────────
let bkCurrentTenant = null

function fmtSize(b) {
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

async function openBackups(id) {
  bkCurrentTenant = id
  $('#bkTenant').textContent = id
  $('#backupOverlay').classList.remove('hidden')
  await loadBackups()
}

async function loadBackups() {
  const { snapshots } = await api('GET', `/api/operator/tenants/${bkCurrentTenant}/backups`)
  $('#bkEmpty').classList.toggle('hidden', snapshots.length > 0)
  const body = $('#bkBody'); body.innerHTML = ''
  for (const s of snapshots) {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td class="mut">${new Date(s.createdAt).toLocaleString('de-DE')}</td>
      <td class="mut">${fmtSize(s.size)}</td>
      <td class="mut" data-bk-verify="${escapeHtml(s.name)}"></td>
      <td><div class="row-actions">
        <button class="ghost" data-bk="verify" data-name="${escapeHtml(s.name)}">Prüfen</button>
        <button class="ghost" data-bk="restore" data-name="${escapeHtml(s.name)}">Wiederherstellen</button>
        <button class="ghost" data-bk="download" data-name="${escapeHtml(s.name)}">Download</button>
      </div></td>`
    body.appendChild(tr)
  }
}

$('#bkClose').addEventListener('click', () => $('#backupOverlay').classList.add('hidden'))
$('#bkCreate').addEventListener('click', async () => {
  try { await api('POST', `/api/operator/tenants/${bkCurrentTenant}/backups`); await loadBackups() }
  catch (err) { alert(err.message) }
})
$('#bkBody').addEventListener('click', async e => {
  const btn = e.target.closest('button'); if (!btn) return
  const name = btn.dataset.name
  try {
    if (btn.dataset.bk === 'verify') {
      const result = await api('POST', `/api/operator/tenants/${bkCurrentTenant}/backups/${encodeURIComponent(name)}/verify`)
      const cell = document.querySelector(`[data-bk-verify="${CSS.escape(name)}"]`)
      if (cell) cell.textContent = result.ok ? 'ok' : (result.error || `${result.issues?.length ?? 0} Problem(e)`)
    } else if (btn.dataset.bk === 'restore') {
      if (!confirm(`Snapshot "${name}" wiederherstellen? Der aktuelle Stand von "${bkCurrentTenant}" wird überschrieben.`)) return
      await api('POST', `/api/operator/tenants/${bkCurrentTenant}/backups/restore`, { name })
      alert('Wiederhergestellt.')
    } else if (btn.dataset.bk === 'download') {
      // Download mit Auth-Header: als Blob holen und speichern.
      const res = await fetch(`/api/operator/tenants/${bkCurrentTenant}/backups/${encodeURIComponent(name)}/download`, {
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error('Download fehlgeschlagen')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `${bkCurrentTenant}-${name}`; a.click()
      URL.revokeObjectURL(a.href)
    }
  } catch (err) { alert(err.message) }
})

$('#tbody').addEventListener('click', async e => {
  const btn = e.target.closest('button'); if (!btn) return
  const id = btn.dataset.id
  try {
    if (btn.dataset.act === 'backups') {
      await openBackups(id); return
    }
    if (btn.dataset.act === 'check') {
      const result = await api('POST', `/api/operator/tenants/${id}/check`)
      checkResults.set(id, result)
      const cell = document.querySelector(`[data-check-cell="${CSS.escape(id)}"]`)
      if (cell) cell.innerHTML = checkBadge(id)
      return
    }
    if (btn.dataset.act === 'toggle') {
      const suspend = btn.dataset.sus !== 'true'
      await api('POST', `/api/operator/tenants/${id}/suspend`, { suspended: suspend })
    } else if (btn.dataset.act === 'delete') {
      if (!confirm(`Mandant "${id}" endgültig löschen? Alle Daten werden entfernt.`)) return
      await api('DELETE', `/api/operator/tenants/${id}`)
    }
    await refresh()
  } catch (err) { alert(err.message) }
})

$('#pendingBody').addEventListener('click', async e => {
  const btn = e.target.closest('button'); if (!btn) return
  const id = btn.dataset.id
  try {
    if (btn.dataset.pact === 'resend') {
      await api('POST', `/api/operator/pending/${id}/resend`)
    } else if (btn.dataset.pact === 'delete') {
      if (!confirm(`Offene Registrierung "${id}" löschen?`)) return
      await api('DELETE', `/api/operator/pending/${id}`)
    }
    await loadPending()
  } catch (err) { alert(err.message) }
})

// Auto-Login, falls Token vorhanden
if (token) {
  refresh().then(() => show('dash')).catch(() => show('login'))
} else {
  show('login')
}
