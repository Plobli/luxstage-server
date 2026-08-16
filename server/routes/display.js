import { readJsonBody, json } from '../helpers.js'
import { getSetting, setSetting } from '../db/settings.js'

const VALID_UNITS = ['m', 'cm', 'mm']
const VALID_PHOTOS_PER_PAGE = [1, 2, 4, 6, 8, 9, 12]
const DEFAULT_PHOTOS_PER_PAGE = 4

function getUnit() {
  return getSetting('display.measure_unit') ?? 'm'
}

// Serverseitig gespeichert, damit die Einstellung nicht am Browser klebt und
// der PDF-Export sie ebenfalls lesen kann.
function getPhotosPerPage() {
  const n = parseInt(getSetting('display.photos_per_page') ?? '', 10)
  return VALID_PHOTOS_PER_PAGE.includes(n) ? n : DEFAULT_PHOTOS_PER_PAGE
}

export async function displayRoutes(req, res, pathname) {
  const { method } = req

  if (pathname === '/api/settings/display') {
    if (method === 'GET') {
      return json(res, 200, { measure_unit: getUnit(), photos_per_page: getPhotosPerPage() })
    }
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return

      if (body.measure_unit !== undefined) {
        if (!VALID_UNITS.includes(body.measure_unit)) return json(res, 400, { error: 'Ungültige Einheit' })
        setSetting('display.measure_unit', body.measure_unit)
      }

      if (body.photos_per_page !== undefined) {
        const n = parseInt(body.photos_per_page, 10)
        if (!VALID_PHOTOS_PER_PAGE.includes(n)) return json(res, 400, { error: 'Ungültiger Wert für Fotos pro Seite' })
        setSetting('display.photos_per_page', String(n))
      }

      return json(res, 200, { ok: true })
    }
  }

  return null
}

export { getUnit as getDisplayUnit, getPhotosPerPage }
