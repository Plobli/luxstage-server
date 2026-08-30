import * as db from '../db.js'
import * as photos from '../photos.js'
import * as floorplan from '../floorplan.js'
import { notFound } from '../helpers.js'
import { generatePDF } from '../pdf.js'
import { getDisplayUnit, getPhotosPerPage } from './display.js'

const SHOW_PDF = /^\/api\/shows\/([^/]+)\/pdf$/

export async function pdfRoutes(req, res, pathname, params) {
  const { method } = req
  let m

  if (method === 'GET' && (m = SHOW_PDF.exec(pathname))) {
    const slug = m[1]
    const blank = params?.blank === '1'
    const show = db.readShow(slug)
    if (!show) return notFound(res)
    const unit = getDisplayUnit()
    const channels = db.readChannels(slug)
    const sectionsMap = db.readShowSections(slug)
    const templateSections = db.readShowSectionDefs(slug)
    const photoFilenames = await photos.listPhotos(slug)
    const captionsMap = db.readPhotoDescriptions(slug)
    const photoEntries = photoFilenames.map(f => ({
      path: photos.getPhotoPath(slug, f),
      caption: captionsMap[f]?.caption ?? '',
    }))
    const towers = db.readTowers(slug)
    const bars = db.readBars(slug)
    const floorplanRow = db.getShowFloorplan(show.id)
    let imagePath = null
    let canvasData = floorplanRow?.canvas_data ?? null
    if (floorplanRow?.image_path) {
      imagePath = floorplan.resolveFloorplanImagePath(floorplanRow.image_path)
    } else if (show.template) {
      const tpl = db.getTemplateByName(show.template)
      if (tpl) {
        const fp = db.getTemplateFloorplan(tpl.id)
        if (fp?.image_path) imagePath = floorplan.resolveFloorplanImagePath(fp.image_path)
        if (!canvasData && fp?.canvas_data) canvasData = fp.canvas_data
      }
    }
    await generatePDF(show, channels, sectionsMap, templateSections, photoEntries, res, {
      canvasData,
      imagePath,
      towers,
      bars,
    }, unit, getPhotosPerPage(), { blank })
    return
  }

  return null
}
