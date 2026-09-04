import * as photos from '../photos.js'
import * as floorplan from '../floorplan.js'
import { notFound } from '../helpers.js'
import { generatePDF, pdfFilename } from '../pdf.js'
import { getDisplayUnit, getPhotosPerPage } from '../db/settings.js'
import { readShow } from '../db/shows.js'
import { readChannels } from '../db/channels.js'
import { readShowSections, readShowSectionDefs } from '../db/sections.js'
import { readPhotoDescriptions } from '../db/photos.js'
import { readTowers } from '../db/towers.js'
import { readBars } from '../db/bars.js'
import { getShowFloorplan, getTemplateFloorplan } from '../db/floorplan.js'
import { getTemplateByName } from '../db/templates.js'

const SHOW_PDF = /^\/api\/shows\/([^/]+)\/pdf$/

export async function pdfRoutes(req, res, pathname, params) {
  const { method } = req
  let m

  if (method === 'GET' && (m = SHOW_PDF.exec(pathname))) {
    const slug = m[1]
    const blank = params?.blank === '1'
    const show = readShow(slug)
    if (!show) return notFound(res)
    const unit = getDisplayUnit()
    const channels = readChannels(slug)
    const sectionsMap = readShowSections(slug)
    const templateSections = readShowSectionDefs(slug)
    const photoFilenames = await photos.listPhotos(slug)
    const captionsMap = readPhotoDescriptions(slug)
    const photoEntries = photoFilenames.map(f => ({
      path: photos.getPhotoPath(slug, f),
      caption: captionsMap[f]?.caption ?? '',
    }))
    const towers = readTowers(slug)
    const bars = readBars(slug)
    const floorplanRow = getShowFloorplan(show.id)
    let imagePath = null
    let canvasData = floorplanRow?.canvas_data ?? null
    if (floorplanRow?.image_path) {
      imagePath = floorplan.resolveFloorplanImagePath(floorplanRow.image_path)
    } else if (show.template) {
      const tpl = getTemplateByName(show.template)
      if (tpl) {
        const fp = getTemplateFloorplan(tpl.id)
        if (fp?.image_path) imagePath = floorplan.resolveFloorplanImagePath(fp.image_path)
        if (!canvasData && fp?.canvas_data) canvasData = fp.canvas_data
      }
    }
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdfFilename(show.name, blank)}"`,
      'Referrer-Policy': 'no-referrer',
    })
    await generatePDF(
      {
        show, channels, sectionsMap, templateSections, photoEntries,
        floorplan: { canvasData, imagePath, towers, bars },
      },
      res,
      { unit, photosPerPage: getPhotosPerPage(), blank },
    )
    return
  }

  return null
}
