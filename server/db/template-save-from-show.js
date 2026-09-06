import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'
import { ensureTemplateTowerSlots } from './template-towers.js'

// Richtung "Show → Template": speichert ausgewählte Show-Bars/-Towers als
// Template-Einträge. Für die umgekehrte Richtung (Template → Show) siehe
// template-apply-to-show.js.

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
      // Map sofort ergänzen: zwei Show-Bars mit demselben (Override-)Namen
      // innerhalb desselben Aufrufs sollen zusammengeführt werden statt
      // eines unerreichbaren Duplikats (siehe Backlog-Finding).
      tplBarByName.set(barName, { id: tplBarId })
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
      // Map sofort ergänzen: zwei Show-Towers mit demselben (Override-)Namen
      // innerhalb desselben Aufrufs sollen zusammengeführt werden statt
      // eines unerreichbaren Duplikats (siehe Backlog-Finding).
      tplTowerByName.set(towerName, { id: tplTowerId })
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
