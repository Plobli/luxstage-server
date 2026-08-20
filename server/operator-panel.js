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

function fmtDate(ms) { return new Date(ms).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' }) }
function fmtExpiry(ms) {
  const diff = ms - Date.now()
  if (diff <= 0) return 'abgelaufen'
  const h = Math.floor(diff / 3600000)
  if (h >= 1) return `in ${h} h`
  return `in ${Math.max(1, Math.floor(diff / 60000))} min`
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
    const status = t.suspended ? '<span class="tag sus">gesperrt</span>' : '<span class="tag ok">aktiv</span>'
    tr.innerHTML = `
      <td><strong>${t.tenantId}</strong></td>
      <td class="mut">${t.email}</td>
      <td class="mut">${fmtDate(t.createdAt)}</td>
      <td>${t.shows ?? '–'}</td>
      <td>${t.users ?? '–'}</td>
      <td>${status}</td>
      <td><div class="row-actions">
        <button class="ghost" data-act="backups" data-id="${t.tenantId}">Backups</button>
        <button class="ghost" data-act="toggle" data-id="${t.tenantId}" data-sus="${t.suspended}">${t.suspended ? 'Entsperren' : 'Sperren'}</button>
        <button class="danger" data-act="delete" data-id="${t.tenantId}">Löschen</button>
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
    tr.innerHTML = `
      <td><strong>${p.tenantId}</strong></td>
      <td class="mut">${p.email}</td>
      <td class="mut">${fmtDate(p.createdAt)}</td>
      <td class="${expired ? '' : 'mut'}">${fmtExpiry(p.expiresAt)}</td>
      <td><div class="row-actions">
        <button class="ghost" data-pact="resend" data-id="${p.tenantId}">Erneut senden</button>
        <button class="danger" data-pact="delete" data-id="${p.tenantId}">Löschen</button>
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
      <td><div class="row-actions">
        <button class="ghost" data-bk="restore" data-name="${s.name}">Wiederherstellen</button>
        <button class="ghost" data-bk="download" data-name="${s.name}">Download</button>
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
    if (btn.dataset.bk === 'restore') {
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
