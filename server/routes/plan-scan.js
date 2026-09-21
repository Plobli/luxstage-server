import fs from 'node:fs'
import * as photosLib from '../photos.js'
import { readChannels } from '../db/channels.js'
import { analyzePlanScan, isPdfBuffer } from '../plan-scan.js'
import { requireAuth } from '../auth.js'
import { json, uploadErrorStatus } from '../helpers.js'
import { pdf } from 'pdf-to-img'

const SHOW_PLAN_SCAN = /^\/api\/shows\/([^/]+)\/plan-scan$/
// Deutlich über realistischen Einleuchtplänen (Beispiel-PDF: 7 Seiten), aber
// weit unter dem Anthropic-API-Limit (~100 Bilder/Request) — verhindert, dass
// ein sehr langes PDF unnötig komplett gerendert/gepuffert wird, bevor die
// API ohnehin ablehnt (200 Seiten ≈ 70MB PNG + 93MB Base64 im Node-Prozess).
const MAX_PLAN_SCAN_PAGES = 30

export async function planScanRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_PLAN_SCAN.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const ct = req.headers['content-type'] || ''
      if (!ct.startsWith('multipart/form-data')) return json(res, 400, { error: 'Ungültiger Upload' })
      let upload
      try {
        upload = await photosLib.parseMultipart(req)
        const file = upload.files[0]
        if (!file) return json(res, 400, { error: 'Keine PDF-Datei gefunden' })
        const pdfBuffer = await fs.promises.readFile(file.path)
        if (!isPdfBuffer(pdfBuffer)) return json(res, 400, { error: 'Datei ist kein gültiges PDF' })

        const pageBuffers = []
        const doc = await pdf(pdfBuffer, { scale: 2 })
        for await (const pageBuffer of doc) {
          if (pageBuffers.length >= MAX_PLAN_SCAN_PAGES) {
            return json(res, 400, { error: `PDF hat zu viele Seiten (max. ${MAX_PLAN_SCAN_PAGES}).` })
          }
          pageBuffers.push(pageBuffer)
        }
        if (pageBuffers.length === 0) return json(res, 400, { error: 'PDF enthält keine Seiten' })

        const knownChannels = readChannels(slug).map(({ channel, address, device, position }) => ({ channel, address, device, position }))
        const result = await analyzePlanScan(pageBuffers, knownChannels)
        return json(res, 200, result)
      } catch (error) {
        // Provider-seitiger Fehler (Rate-Limit/Überlastung/5xx bei Claude) ist kein
        // Client-Fehler — uploadErrorStatus() würde das sonst pauschal als 400 einordnen.
        if (error.status === 429 || error.status >= 500) {
          return json(res, 503, { error: 'Einleuchtplan kann gerade nicht ausgewertet werden. Bitte in Kürze erneut versuchen.' })
        }
        return json(res, uploadErrorStatus(error.message), { error: error.message || 'Einleuchtplan konnte nicht ausgewertet werden' })
      } finally {
        await upload?.cleanup()
      }
    }
  }

  return null
}
