import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { ensureTemplateTowerSlots } from './template-towers.js'
import { sectionTypeHasRows } from '../../shared/constants.js'

// Kopiert Template-Bereiche/-Bars/-Towers in eine Show — fügt nur fehlende
// Einträge hinzu (nach Titel/Name), überschreibt nichts Bestehendes. Von drei
// Stellen genutzt: applyTemplateToShow() (einzelne Show, ggf. mit Auswahl),
// applyTemplateToAllShows() (alle Shows dieses Templates) und
// db/shows.js::createShow() (Sections beim Anlegen einer Show aus Template).
// Gibt die Anzahl neu eingefügter Einträge zurück (für Statistik-Zwecke).
export function applySections(tpl, show, idSet) {
  const tDefs = getDb().prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
  const selectedDefs = idSet ? tDefs.filter(d => idSet.has(d.id)) : tDefs
  if (!selectedDefs.length) return 0
  const defIds = selectedDefs.map(d => d.id)
  const ph = defIds.map(() => '?').join(',')
  const tRowsAll   = getDb().prepare(`SELECT * FROM template_section_kv_rows WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const tFieldsAll = getDb().prepare(`SELECT * FROM template_section_fields WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const tRowsBySection   = Map.groupBy(tRowsAll, r => r.section_id)
  const tFieldsBySection = Map.groupBy(tFieldsAll, f => f.section_id)

  const existingDefs = getDb().prepare('SELECT title FROM section_defs WHERE show_id = ?').all(show.id)
  const existingTitles = new Set(existingDefs.map(d => d.title))
  let sortBase = existingDefs.length

  const insertDef     = getDb().prepare('INSERT INTO section_defs (id, show_id, title, type, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertKvRow   = getDb().prepare('INSERT INTO section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertField   = getDb().prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertContent = getDb().prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')

  let added = 0
  for (const tDef of selectedDefs) {
    if (existingTitles.has(tDef.title)) continue
    const newDefId = randomUUID()
    insertDef.run(newDefId, show.id, tDef.title, tDef.type, tDef.icon ?? '', sortBase++)
    if (sectionTypeHasRows(tDef.type)) {
      for (const tRow of (tRowsBySection.get(tDef.id) ?? [])) {
        insertKvRow.run(randomUUID(), newDefId, tRow.label, tRow.value, tRow.sort_order)
      }
    } else {
      for (const tField of (tFieldsBySection.get(tDef.id) ?? [])) {
        insertField.run(randomUUID(), newDefId, tField.key, tField.label, tField.unit, tField.sort_order)
      }
      insertContent.run(newDefId, show.id, tDef.type === 'fields' ? '{}' : '')
    }
    added++
  }
  return added
}

export function applyBars(tpl, show, idSet, withChannels) {
  const tBars = getDb().prepare('SELECT * FROM template_bars WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
  const existingBars = getDb().prepare('SELECT * FROM bars WHERE show_id = ?').all(show.id)
  const existingByName = new Map(existingBars.map(b => [b.name, b]))
  let sortBase = existingBars.length
  let added = 0

  for (const tb of tBars) {
    if (idSet && !idSet.has(tb.id)) continue
    if (!existingByName.has(tb.name)) {
      const newBarId = randomUUID()
      getDb().prepare(
        'INSERT INTO bars (id, show_id, name, zug_nr, length_cm, sort_order, bar_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(newBarId, show.id, tb.name, tb.zug_nr, tb.length_cm, sortBase++, tb.bar_type ?? 'zugstange', Date.now())
      existingByName.set(tb.name, { id: newBarId })
      added++
    }
    if (withChannels) {
      const bar = existingByName.get(tb.name)
      // Fixtures des Ziel-Bars vor dem Einfügen leeren: sonst verdoppeln sich
      // Fixtures bei jeder erneuten Anwendung auf einen bereits vorhandenen Bar
      // (analog zur Bereinigung in applyBarsToTemplate).
      getDb().prepare('DELETE FROM bar_fixtures WHERE bar_id = ?').run(bar.id)
      const fixtures = getDb().prepare('SELECT * FROM template_bar_fixtures WHERE bar_id = ?').all(tb.id)
      for (const fx of fixtures) {
        getDb().prepare(`
          INSERT INTO bar_fixtures (id, bar_id, channel_id, position, notes, side, position_text)
          SELECT ?, ?, c.id, ?, ?, ?, ?
          FROM channels c
          WHERE c.show_id = ? AND c.channel = ?
        `).run(randomUUID(), bar.id, fx.position, fx.notes ?? '', fx.side ?? 'out', fx.position_text ?? '', show.id, fx.channel ?? '')
      }
    }
  }
  return added
}

export function applyTowers(tpl, show, idSet, withChannels) {
  const tTowers = getDb().prepare('SELECT * FROM template_towers WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
  const existingTowers = getDb().prepare('SELECT * FROM towers WHERE show_id = ?').all(show.id)
  const existingByName = new Map(existingTowers.map(t => [t.name, t]))
  let sortBase = existingTowers.length
  let added = 0

  for (const tt of tTowers) {
    if (idSet && !idSet.has(tt.id)) continue
    if (!existingByName.has(tt.name)) {
      const newTowerId = randomUUID()
      getDb().prepare(
        'INSERT INTO towers (id, show_id, name, side, stage_area, slot_count, sort_order, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(newTowerId, show.id, tt.name, tt.side, tt.stage_area, tt.slot_count, sortBase++, '', Date.now())
      for (let i = 1; i <= tt.slot_count; i++) {
        getDb().prepare(
          'INSERT OR IGNORE INTO tower_slots (id, tower_id, slot_index, channel_id) VALUES (?, ?, ?, NULL)'
        ).run(randomUUID(), newTowerId, i)
      }
      existingByName.set(tt.name, { id: newTowerId })
      added++
    }
    if (withChannels) {
      const tower = existingByName.get(tt.name)
      const tSlots = getDb().prepare('SELECT * FROM template_tower_slots WHERE tower_id = ?').all(tt.id)
      for (const ts of tSlots) {
        if (!ts.channel) continue
        const ch = getDb().prepare('SELECT id FROM channels WHERE show_id = ? AND channel = ?').get(show.id, ts.channel)
        if (ch) {
          getDb().prepare(
            'UPDATE tower_slots SET channel_id = ? WHERE tower_id = ? AND slot_index = ? AND channel_id IS NULL'
          ).run(ch.id, tower.id, ts.slot_index)
        }
      }
    }
  }
  return added
}

// Wendet Template-Bars, Template-Towers oder Template-Bereiche (Sections) auf
// eine einzelne Show an.
// withChannels: true → Fixtures/Slot-Belegungen aus Template werden mit übernommen und per Kanalnummer den Show-Kanälen zugeordnet.
// withChannels: false → nur leere Bars/Towers ohne Fixtures/Kanäle werden angelegt (ohne Wirkung bei scope 'sections').
// Die Funktion fügt nur fehlende Einträge hinzu (nach Name/Position/Titel).
export function applyTemplateToShow(templateName, showSlug, scope, withChannels, selectedIds = null) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  if (!tpl) throw new Error('Bühnen-Template nicht gefunden')
  const show = getDb().prepare('SELECT * FROM shows WHERE slug = ?').get(showSlug)
  if (!show) throw new Error('Show nicht gefunden')
  const idSet = selectedIds ? new Set(selectedIds) : null

  const tx = getDb().transaction(() => {
    if (scope === 'sections') return applySections(tpl, show, idSet)
    if (scope === 'bars')     return applyBars(tpl, show, idSet, withChannels)
    if (scope === 'towers')   return applyTowers(tpl, show, idSet, withChannels)
  })
  tx()
}

function applyBarsToTemplate(tpl, show, idSet, fields, overrideName, withChannels) {
  const showBars = getDb().prepare('SELECT * FROM bars WHERE show_id = ? ORDER BY sort_order').all(show.id)
  const selectedBars = showBars.filter(b => idSet.has(b.id))
  const existingTplBars = getDb().prepare('SELECT * FROM template_bars WHERE template_id = ?').all(tpl.id)
  const tplBarByName = new Map(existingTplBars.map(b => [b.name, b]))
  const currentCount = existingTplBars.length

  let idx = 0
  for (const bar of selectedBars) {
    let tplBarId
    const barName = overrideName ?? bar.name
    if (tplBarByName.has(barName)) {
      tplBarId = tplBarByName.get(barName).id
      getDb().prepare(
        'UPDATE template_bars SET name=?, zug_nr=?, length_cm=?, sort_order=?, bar_type=? WHERE id=?'
      ).run(barName, bar.zug_nr ?? '', bar.length_cm ?? 600, currentCount + idx, bar.bar_type ?? 'zugstange', tplBarId)
    } else {
      tplBarId = randomUUID()
      getDb().prepare(
        'INSERT INTO template_bars (id, template_id, name, zug_nr, length_cm, sort_order, bar_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(tplBarId, tpl.id, barName, bar.zug_nr ?? '', bar.length_cm ?? 600, currentCount + idx, bar.bar_type ?? 'zugstange')
    }
    idx++

    if (withChannels) {
      getDb().prepare('DELETE FROM template_bar_fixtures WHERE bar_id = ?').run(tplBarId)
      const fixtures = getDb().prepare(`
        SELECT bf.*, c.channel, c.device, c.color
        FROM bar_fixtures bf LEFT JOIN channels c ON c.id = bf.channel_id
        WHERE bf.bar_id = ?
      `).all(bar.id)
      for (const fx of fixtures) {
        getDb().prepare(
          'INSERT INTO template_bar_fixtures (id, bar_id, position, channel, device, color, notes, side, position_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          randomUUID(), tplBarId,
          fields.position !== false ? fx.position : 0,
          fields.channel !== false ? (fx.channel ?? null) : null,
          fields.device  !== false ? (fx.device  ?? null) : null,
          fields.color   !== false ? (fx.color   ?? null) : null,
          fields.notes   !== false ? (fx.notes   ?? '')   : '',
          fx.side ?? 'out',
          fx.position_text ?? ''
        )
      }
    }
  }
}

function applyTowersToTemplate(tpl, show, idSet, fields, overrideName, withChannels) {
  const showTowers = getDb().prepare('SELECT * FROM towers WHERE show_id = ? ORDER BY sort_order').all(show.id)
  const selectedTowers = showTowers.filter(t => idSet.has(t.id))
  const existingTplTowers = getDb().prepare('SELECT * FROM template_towers WHERE template_id = ?').all(tpl.id)
  const tplTowerByName = new Map(existingTplTowers.map(t => [t.name, t]))
  const currentCount = existingTplTowers.length

  let idx = 0
  for (const tower of selectedTowers) {
    let tplTowerId
    const towerName = overrideName ?? tower.name
    if (tplTowerByName.has(towerName)) {
      tplTowerId = tplTowerByName.get(towerName).id
      getDb().prepare(
        'UPDATE template_towers SET name=?, side=?, stage_area=?, slot_count=?, sort_order=? WHERE id=?'
      ).run(towerName, tower.side ?? '', tower.stage_area ?? '', tower.slot_count, currentCount + idx, tplTowerId)
    } else {
      tplTowerId = randomUUID()
      getDb().prepare(
        'INSERT INTO template_towers (id, template_id, name, side, stage_area, slot_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(tplTowerId, tpl.id, towerName, tower.side ?? '', tower.stage_area ?? '', tower.slot_count, currentCount + idx)
    }
    idx++

    ensureTemplateTowerSlots(tplTowerId, tower.slot_count)

    if (withChannels) {
      const slots = getDb().prepare('SELECT ts.*, c.channel, c.device, c.color FROM tower_slots ts LEFT JOIN channels c ON c.id = ts.channel_id WHERE ts.tower_id = ?').all(tower.id)
      for (const slot of slots) {
        getDb().prepare(
          'UPDATE template_tower_slots SET channel=?, device=?, color=? WHERE tower_id=? AND slot_index=?'
        ).run(
          fields.channel !== false ? (slot.channel ?? null) : null,
          fields.device  !== false ? (slot.device  ?? null) : null,
          fields.color   !== false ? (slot.color   ?? null) : null,
          tplTowerId, slot.slot_index
        )
      }
    }
  }
}

// Speichert ausgewählte Show-Bars oder Show-Towers als Template-Einträge.
// fields: { channel, device, color, notes, position } — welche Felder übernommen werden
// Bestehende Template-Einträge gleichen Namens werden überschrieben.
export function saveShowItemsToTemplate(templateName, showSlug, scope, barOrTowerIds, fields = {}, overrideName = null) {
  const withChannels = !!(fields.channel || fields.device || fields.color || fields.notes || fields.position)
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  if (!tpl) throw new Error('Bühnen-Template nicht gefunden')
  const show = getDb().prepare('SELECT * FROM shows WHERE slug = ?').get(showSlug)
  if (!show) throw new Error('Show nicht gefunden')
  const idSet = new Set(barOrTowerIds)

  const tx = getDb().transaction(() => {
    if (scope === 'bars')   return applyBarsToTemplate(tpl, show, idSet, fields, overrideName, withChannels)
    if (scope === 'towers') return applyTowersToTemplate(tpl, show, idSet, fields, overrideName, withChannels)
  })
  tx()
}

// Wendet Template-Bars, Template-Towers oder Sections-Struktur auf alle Shows mit diesem Template an.
// scope: 'bars' | 'towers' | 'sections' — bestehende Einträge werden nicht überschrieben.
// Nutzt dieselben applySections/applyBars/applyTowers wie applyTemplateToShow()
// (statt derselben "fehlende Einträge nach Name/Titel ergänzen"-Logik ein
// drittes Mal zu implementieren) — pro Show ohne Auswahl (idSet=null) und
// ohne Kanal-Übernahme (withChannels=false), wie es dieser Bulk-Pfad schon
// immer gemacht hat.
export async function applyTemplateToAllShows(templateName, scope) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  if (!tpl) throw new Error('Bühnen-Template nicht gefunden')

  const shows = getDb().prepare('SELECT * FROM shows WHERE template = ? AND archived = 0').all(templateName)
  const stats = { shows: shows.length, barsAdded: 0, towersAdded: 0, sectionsAdded: 0, failedShows: [] }

  // Eine Transaktion pro Show statt einer einzigen über alle Shows hinweg
  // (analog zu history.js' Bulkhead-Muster): better-sqlite3 ist synchron, ohne
  // die sleep(0)-Pause zwischen den Shows würde ein Lauf über viele Shows den
  // einzigen Node-Thread am Stück blockieren — kein SSE-Heartbeat, kein Login,
  // kein Upload solange. Verliert die Alles-oder-Nichts-Semantik über alle
  // Shows hinweg (ein Fehler bei Show 50 lässt 1-49 bereits übernommen), das
  // ist hier akzeptabel: jede Show-Anwendung ist unabhängig und idempotent
  // (bereits vorhandene Bars/Towers/Sections werden übersprungen, ein erneuter
  // Lauf holt fehlgeschlagene Shows einfach nach) — vorausgesetzt, ein Fehler
  // bei einer Show bricht nicht den ganzen Lauf ab, sondern überspringt nur
  // diese eine (wie beim history.js-Vorbild: Fehlerisolierung pro Einheit).
  for (const show of shows) {
    const applyToOneShow = getDb().transaction(() => {
      if (scope === 'bars')     stats.barsAdded     += applyBars(tpl, show, null, false)
      if (scope === 'towers')   stats.towersAdded   += applyTowers(tpl, show, null, false)
      if (scope === 'sections') stats.sectionsAdded += applySections(tpl, show, null)
    })
    try {
      applyToOneShow()
    } catch (err) {
      console.error(`[template-apply] Show ${show.slug} übersprungen:`, err.message)
      stats.failedShows.push({ slug: show.slug, error: err.message })
      await sleep(0)
      continue
    }
    await sleep(0)
  }
  return stats
}
