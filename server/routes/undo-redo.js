// server/routes/undo-redo.js
// Gemeinsame Undo/Redo-Antwortlogik für Show- und Netzwerk-Routen: beide
// Domains hatten dieselbe fünfstufige Sequenz (Eintrag holen → 400 wenn
// keiner da → Hash verifizieren, 409 bei Mismatch → Zustand tauschen →
// konsumierten Eintrag entfernen → Gegen-Stack füllen) zweimal dupliziert.
import { json } from '../helpers.js'

/**
 * @param res          HTTP-Response
 * @param direction    'undo' | 'redo' — steuert nur die Fehlertexte
 * @param getEntry     () => Operation/Redo-Eintrag oder null
 * @param computeHash  (state) => string
 * @param readState    () => aktueller Zustand (vor der Änderung)
 * @param writeState   (targetState) => void
 * @param consumeEntry (entry) => void — entfernt den geholten Eintrag (No-op,
 *                     falls getEntry ihn beim Holen schon entfernt hat, wie popRedo)
 * @param pushOpposite (currentState) => void — legt auf den Gegen-Stack
 * @param broadcast    () => void — optional, z.B. SSE-Events nach Show-Undo/Redo
 */
export function handleUndoRedo(res, direction, {
  getEntry, computeHash, readState, writeState, consumeEntry, pushOpposite, broadcast,
}) {
  const entry = getEntry()
  if (!entry) {
    return json(res, 400, { error: direction === 'undo' ? 'Nichts zum Rückgängigmachen' : 'Nichts zum Wiederholen' })
  }

  const targetState = JSON.parse(entry.snapshot)
  if (computeHash(targetState) !== entry.hash) {
    return json(res, 409, {
      error: `Snapshot-Hash stimmt nicht überein — ${direction === 'undo' ? 'Undo' : 'Redo'} abgebrochen`,
    })
  }

  const currentState = readState()
  writeState(targetState)
  consumeEntry(entry)
  pushOpposite(currentState)
  broadcast?.()
  return json(res, 200, { ok: true })
}
