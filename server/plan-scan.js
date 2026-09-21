/**
 * plan-scan.js — liest einen mehrseitigen Einleuchtplan (PDF) per Claude
 * Vision aus. Struktur variiert pro Plan (Tabellen mit Positions-Headern,
 * Kanalbereiche, Freitext-Abschnitte) — anders als circuit-scan.js, das
 * einzelne Kreislisten-Fotos mit stabilerem Zeilenformat liest.
 *
 * output_config.effort: 'low' ist entscheidend — ohne das brauchte das
 * Modell bei einem dichten, mehrseitigen Plan (hunderte Kanäle über 7
 * Bilder) sein internes Reasoning so stark, dass thinking_tokens allein
 * das gesamte max_tokens-Budget aufbrauchten (stop_reason 'max_tokens',
 * kein sichtbarer Text/parsed_output, Requests hingen mehrere Minuten).
 * Mit effort:'low' läuft derselbe Call in unter einer Minute durch
 * (verifiziert gegen die echte API mit dem 7-seitigen Beispielplan).
 */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { defaultAnthropicClient } from './circuit-scan.js'
import { logger } from './logger.js'

const log = logger('plan-scan')
const MODEL = 'claude-sonnet-5'

const PlanScanResultSchema = z.object({
  rows: z.array(z.object({
    channel: z.string(),
    address: z.string().optional(),
    device: z.string().optional(),
    position: z.string().optional(),
    color: z.string().optional(),
    notes: z.string().optional(),
  })),
  freitext: z.string().optional(),
})

export function isPdfBuffer(buf) {
  return buf.slice(0, 5).toString('ascii') === '%PDF-'
}

// knownChannels: [{ channel, address, device, position }] — aus der aktuellen
// Show, dient Claude als Kontext/Anker beim Lesen unklarer Angaben.
export async function analyzePlanScan(pageBuffers, knownChannels, client = defaultAnthropicClient()) {
  if (!Array.isArray(pageBuffers) || pageBuffers.length === 0) {
    throw new Error('Keine PDF-Seiten zum Auswerten')
  }

  const knownList = knownChannels
    .map(ch => `${ch.channel}: ${ch.address || '–'} / ${ch.device || '–'} / ${ch.position || '–'}`)
    .join('\n')

  const imageBlocks = pageBuffers.map(buf => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: buf.toString('base64') },
  }))

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: [
            'Die Bilder zeigen die Seiten eines Einleuchtplans für eine Bühnenbeleuchtung (Theaterproduktion).',
            'Die grobe Struktur ist bei jedem Plan ähnlich, aber nie identisch: mehrere Tabellen mit',
            'Kanalzeilen, gruppiert unter Bereichs-Überschriften (z.B. "Versatz Bühne hinten rechts",',
            '"Portal Lks", "Saaltruss"), dazwischen Freitext-Abschnitte (Hängeplan-Notizen, Zug-Angaben,',
            'Portalbrücken-Maße, Truss-Höhen). Erkenne die Struktur selbst, sie ist nicht vorgegeben.',
            '',
            'KANALLISTE (in "rows"):',
            'Typische Spalten/Angaben pro Zeile: Kanalnummer (Ch), Adresse (DMX-Adresse), Gerät',
            '(Scheinwerfertyp), Position (Bühnenposition — oft als Gruppenüberschrift über mehreren Zeilen',
            'statt pro Zeile), Filter/Farbe, Notizen (freier Beschreibungstext zur Zeile).',
            'Nicht jede Angabe muss vorhanden sein.',
            '',
            '- Wenn eine Zeile einen Kanalbereich zeigt (z.B. "137-148" oder "201-207") statt einer',
            '  einzelnen Nummer: für JEDEN Kanal in diesem Bereich eine eigene Zeile mit denselben',
            '  übrigen Angaben erzeugen — keine Bereichs-Strings im Ergebnis.',
            '- Wenn eine Positionsangabe als Gruppenüberschrift über mehreren Tabellenzeilen steht',
            '  (nicht pro Zeile wiederholt), für jede zugehörige Zeile übernehmen.',
            '- Leere/nicht ausgefüllte Zeilen ohne erkennbaren Inhalt ignorieren.',
            '- channel: Pflicht, alles andere optional. Feld weglassen statt zu raten, wenn nichts',
            '  Lesbares vorhanden ist.',
            '',
            'Bereits bekannte Kanäle dieser Show (Kanal: Adresse / Gerät / Position), als Lesehilfe bei',
            'unklarem Text — nicht blind übernehmen, wenn das Bild klar etwas anderes zeigt:',
            knownList || '(keine)',
            '',
            'FREITEXT (in "freitext"):',
            'Sammle alle Abschnitte, die NICHT Teil der tabellarischen Kanalliste sind — z.B.',
            'Hängeplan-Notizen, Zug-Angaben (Züge/Bars mit Maßen), Portalbrücken-/Portal-Maße,',
            'Truss-Höhen, allgemeine Hinweise zum Aufbau oder zur Show. Als zusammenhängendes',
            'Markdown zurückgeben, mit den Original-Überschriften aus dem Plan als Markdown-Überschriften.',
            'Weglassen, wenn es keinen solchen Freitext gibt.',
          ].join('\n'),
        },
      ],
    }],
    output_config: {
      effort: 'low',
      format: zodOutputFormat(PlanScanResultSchema),
    },
  }, { timeout: 90_000 })

  if (!response.parsed_output) {
    // Generische Client-Fehlermeldung verrät nicht, ob Claude am Token-Limit
    // abgebrochen hat, sich inhaltlich verweigert hat, oder die Ausgabe aus
    // einem anderen Grund nicht ins Schema passte — ohne dieses Log ist der
    // eigentliche Grund nur über einen Debugger sichtbar.
    log.error('parsed_output fehlt', {
      stop_reason: response.stop_reason,
      content_types: response.content?.map(c => c.type).join(','),
    })
    throw new Error('Einleuchtplan konnte nicht ausgewertet werden')
  }
  return response.parsed_output
}
