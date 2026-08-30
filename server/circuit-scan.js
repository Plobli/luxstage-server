/**
 * circuit-scan.js — liest eine Kreisliste (Vordruck mit Handschrift oder
 * komplett handschriftlich, ohne Vordruck) per Claude Vision aus.
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

const MODEL = 'claude-sonnet-5'

const ScanResultSchema = z.object({
  rows: z.array(z.object({
    channel: z.string(),
    address: z.string().optional(),
    device: z.string().optional(),
    position: z.string().optional(),
    color: z.string().optional(),
    notes: z.string().optional(),
  })),
})

function mimeFromBuffer(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  if (buf.slice(0, 4).toString('ascii') === 'RIFF') return 'image/webp'
  return 'image/jpeg'
}

// knownChannels: [{ channel, address, device, position }] — aus der aktuellen
// Show, dient Claude als Kontext/Anker beim Lesen der vorgedruckten Spalten.
export async function analyzeCircuitScan(imageBuffer, knownChannels) {
  const client = new Anthropic(
    process.env.ANTHROPIC_WORKSPACE_ID
      ? { defaultHeaders: { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } }
      : undefined
  )
  const mediaType = mimeFromBuffer(imageBuffer)
  const imageData = imageBuffer.toString('base64')

  const knownList = knownChannels
    .map(ch => `${ch.channel}: ${ch.address || '–'} / ${ch.device || '–'} / ${ch.position || '–'}`)
    .join('\n')

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
        {
          type: 'text',
          text: [
            'Das Bild zeigt eine Kreisliste für eine Bühnenbeleuchtung — entweder einen teils vorgedruckten Vordruck',
            '(Kanalnummer/Adresse/Gerät gedruckt, Filter/Notizen handschriftlich ergänzt) oder eine komplett',
            'handschriftliche Liste ohne Vordruck. Beide Fälle sind möglich, erkenne selbst welcher vorliegt.',
            'Typische Spalten/Angaben pro Zeile: Kanalnummer (Ch), Adresse (DMX-Adresse), Gerät (Scheinwerfertyp),',
            'Position (Bühnenposition — oft als Gruppenüberschrift über mehreren Zeilen statt pro Zeile), Filter/Farbe, Notizen.',
            'Nicht jede Angabe muss vorhanden sein — manche Zeilen haben z.B. keine Adresse oder keine Position.',
            '',
            'Bereits bekannte Kanäle dieser Show (Kanal: Adresse / Gerät / Position), als Lesehilfe bei vorgedrucktem',
            'oder unklarem Text — nicht blind übernehmen, wenn das Bild klar etwas anderes zeigt:',
            knownList || '(keine)',
            '',
            'Gib in "rows" für JEDE erkennbare, ausgefüllte Zeile ein Objekt zurück: { channel, address, device, position, color, notes }.',
            '- channel: Kanalnummer (Pflicht, alles andere optional).',
            '- position: falls als Gruppenüberschrift über mehreren Zeilen steht, für jede zugehörige Zeile übernehmen.',
            '- color: Filter-/Farbangabe, notes: Notizen/Kommentare.',
            '- Feld weglassen statt zu raten, wenn nichts Lesbares vorhanden ist.',
            'Leere Zeilen (z.B. unausgefüllte Vordruck-Zeilen) ignorieren. Handschrift kann unsauber sein — im Zweifel plausibelste Lesart wählen.',
          ].join('\n'),
        },
      ],
    }],
    output_config: { format: zodOutputFormat(ScanResultSchema) },
  })

  if (!response.parsed_output) throw new Error('Kreisliste konnte nicht ausgewertet werden')
  return response.parsed_output
}
