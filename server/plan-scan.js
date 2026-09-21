/**
 * plan-scan.js — liest einen mehrseitigen Einleuchtplan (PDF) per Claude
 * Vision aus. Struktur variiert pro Plan (Tabellen mit Positions-Headern,
 * Kanalbereiche, Freitext-Abschnitte) — anders als circuit-scan.js, das
 * einzelne Kreislisten-Fotos mit stabilerem Zeilenformat liest.
 *
 * Zweistufig statt einem Call: ein Vision-Call mit mehreren Bildern UND
 * strukturierter Ausgabe (output_config/Zod) blieb beim Testen mit einem
 * echten 7-seitigen Plan konsistent über mehrere Minuten hängen, während
 * derselbe Vision-Call mit freiem Text-Output in ~4s durchlief und ein
 * text-only Structured-Output-Call ebenfalls schnell war — offenbar eine
 * Eigenheit von Claudes Structured-Output-Feature bei mehreren Bildern.
 * Schritt 1 (Vision, alle Seiten, freies Markdown) + Schritt 2 (text-only,
 * Zod-Schema) umgeht das zuverlässig, kostet aber einen zweiten Call.
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

// Schritt 1: Vision-Call über alle Seiten, Ausgabe als freier Text in einem
// festen, leicht weiterverarbeitbaren Markdown-Format — kein output_config,
// das ist der Teil, der mit mehreren Bildern zuverlässig schnell bleibt.
async function extractPlanText(imageBlocks, knownList, client) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
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
            'Gib die Kanalliste als Markdown-Tabelle unter der Überschrift "## Kanäle" zurück, mit genau',
            'diesen Spalten in dieser Reihenfolge: Kanal | Adresse | Gerät | Position | Farbe | Notizen.',
            '- Wenn eine Zeile einen Kanalbereich zeigt (z.B. "137-148" oder "201-207") statt einer',
            '  einzelnen Nummer: für JEDEN Kanal in diesem Bereich eine eigene Tabellenzeile mit denselben',
            '  übrigen Angaben erzeugen — keine Bereichs-Strings in der Tabelle.',
            '- Wenn eine Positionsangabe als Gruppenüberschrift über mehreren Tabellenzeilen steht',
            '  (nicht pro Zeile wiederholt), für jede zugehörige Zeile in der Spalte "Position" übernehmen.',
            '- Leere/nicht ausgefüllte Zeilen ohne erkennbaren Inhalt weglassen.',
            '- Kanal ist Pflicht, alle anderen Spalten leer lassen statt zu raten, wenn nichts Lesbares',
            '  vorhanden ist.',
            '',
            'Bereits bekannte Kanäle dieser Show (Kanal: Adresse / Gerät / Position), als Lesehilfe bei',
            'unklarem Text — nicht blind übernehmen, wenn das Bild klar etwas anderes zeigt:',
            knownList || '(keine)',
            '',
            'Gib danach unter der Überschrift "## Freitext" alle Abschnitte zurück, die NICHT Teil der',
            'tabellarischen Kanalliste sind — z.B. Hängeplan-Notizen, Zug-Angaben (Züge/Bars mit Maßen),',
            'Portalbrücken-/Portal-Maße, Truss-Höhen, allgemeine Hinweise zum Aufbau oder zur Show. Als',
            'zusammenhängendes Markdown, mit den Original-Überschriften aus dem Plan als Unterüberschriften.',
            'Den Abschnitt "## Freitext" weglassen, wenn es keinen solchen Freitext gibt.',
          ].join('\n'),
        },
      ],
    }],
  }, { timeout: 90_000 })

  const text = response.content?.filter(c => c.type === 'text').map(c => c.text).join('\n')
  if (!text) {
    log.error('Vision-Call lieferte keinen Text', { stop_reason: response.stop_reason })
    throw new Error('Einleuchtplan konnte nicht ausgewertet werden')
  }
  return text
}

// Schritt 2: text-only Call, strukturiert das Markdown aus Schritt 1 ins
// Zod-Schema — kein Bildinhalt mehr, dadurch schnell.
async function structurePlanText(planText, client) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: [
        'Wandle den folgenden, aus einem Einleuchtplan extrahierten Text in strukturierte Daten um.',
        '"## Kanäle" ist eine Markdown-Tabelle mit Spalten Kanal | Adresse | Gerät | Position | Farbe | Notizen',
        '— eine Zeile pro Kanal wird zu einem Objekt in "rows". "## Freitext" (falls vorhanden) wird',
        'unverändert als "freitext" übernommen.',
        '',
        planText,
      ].join('\n'),
    }],
    output_config: { format: zodOutputFormat(PlanScanResultSchema) },
  }, { timeout: 60_000 })

  if (!response.parsed_output) {
    log.error('parsed_output fehlt (Schritt 2)', {
      stop_reason: response.stop_reason,
      content_types: response.content?.map(c => c.type).join(','),
    })
    throw new Error('Einleuchtplan konnte nicht ausgewertet werden')
  }
  return response.parsed_output
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

  const planText = await extractPlanText(imageBlocks, knownList, client)
  return structurePlanText(planText, client)
}
