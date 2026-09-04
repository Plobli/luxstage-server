import { readJsonBody, json } from '../helpers.js'
import { setSetting, getDisplayUnit, isValidDisplayUnit, getPhotosPerPage, isValidPhotosPerPage } from '../db/settings.js'

export async function displayRoutes(req, res, pathname) {
  const { method } = req

  if (pathname === '/api/settings/display') {
    if (method === 'GET') {
      return json(res, 200, { measure_unit: getDisplayUnit(), photos_per_page: getPhotosPerPage() })
    }
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return

      if (body.measure_unit !== undefined) {
        if (!isValidDisplayUnit(body.measure_unit)) return json(res, 400, { error: 'Ungültige Einheit' })
        setSetting('display.measure_unit', body.measure_unit)
      }

      if (body.photos_per_page !== undefined) {
        const n = parseInt(body.photos_per_page, 10)
        if (!isValidPhotosPerPage(n)) return json(res, 400, { error: 'Ungültiger Wert für Fotos pro Seite' })
        setSetting('display.photos_per_page', String(n))
      }

      return json(res, 200, { ok: true })
    }
  }

  return null
}
