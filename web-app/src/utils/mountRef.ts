// mount_ref auf Kanälen kodiert, an welcher Tower-/Bar-Stelle ein Kanal montiert ist
// (server/db/bars.js writeBarFixture, server/db/towers.js assignSlot). Wird als String
// (JSON) aus der API geliefert, kann aber lokal bereits als Objekt vorliegen — daher der
// try/catch statt eines reinen JSON.parse.

export function parseMountRef(raw: string | object | null | undefined): any | null {
  if (!raw) return null
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
}
