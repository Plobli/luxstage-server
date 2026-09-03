import path from 'node:path'
import fs from 'node:fs'
import { addChannelPhoto, deletePhotoChannels, deletePhotoDescription, readAllPhotoChannels, readChannelPhotos, readPhotoDescriptions, removeChannelPhoto, reorderChannelPhotos, setPhotoChannels, writePhotoDescription } from '../db/photos.js'
import * as photosLib from '../photos.js'
import { requireAuth } from '../auth.js'
import { readBodyBuffer, readJsonBody, json, notFound, uploadErrorStatus } from '../helpers.js'

const SHOW_PHOTOS        = /^\/api\/shows\/([^/]+)\/photos$/
const SHOW_PHOTO_FILE    = /^\/api\/shows\/([^/]+)\/photos\/(.+)$/
const SHOW_PHOTO_ORDER   = /^\/api\/shows\/([^/]+)\/photo-order$/
const SHOW_PHOTO_CAPS    = /^\/api\/shows\/([^/]+)\/photo-captions$/
const SHOW_PHOTO_CAP     = /^\/api\/shows\/([^/]+)\/photo-captions\/(.+)$/
const SHOW_PHOTO_CHANNELS_ALL = /^\/api\/shows\/([^/]+)\/photo-channels$/
const SHOW_PHOTO_CHANNELS = /^\/api\/shows\/([^/]+)\/photos\/([^/]+)\/channels$/
const CHAN_PHOTOS         = /^\/api\/shows\/([^/]+)\/channels\/([^/]+)\/photos$/
const CHAN_PHOTO_REORDER  = /^\/api\/shows\/([^/]+)\/channels\/([^/]+)\/photos\/reorder$/
const CHAN_PHOTO_FILE     = /^\/api\/shows\/([^/]+)\/channels\/([^/]+)\/photos\/(.+)$/

export async function photoRoutes(req, res, pathname, params) {
  const { method } = req
  let m

  if (m = SHOW_PHOTOS.exec(pathname)) {
    const id = m[1]
    if (method === 'GET') {
      return json(res, 200, await photosLib.listPhotos(id))
    }
    if (method === 'POST') {
      const ct = req.headers['content-type'] || ''
      if (!ct.startsWith('multipart/form-data')) return json(res, 400, { error: 'Ungültiger Upload' })
      let upload
      try {
        upload = await photosLib.parseMultipart(req)
        const saved = await Promise.all(upload.files.map(file => photosLib.savePhoto(id, file.filename, file.path)))
        return json(res, 201, { saved })
      } catch (error) {
        return json(res, uploadErrorStatus(error.message), { error: error.message || 'Foto-Upload fehlgeschlagen' })
      } finally {
        await upload?.cleanup()
      }
    }
  }

  if (m = SHOW_PHOTO_ORDER.exec(pathname)) {
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const id = m[1]
      const body = await readJsonBody(req, res); if (body === null) return
      await photosLib.savePhotoOrder(id, body.order)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_PHOTO_CAPS.exec(pathname)) {
    if (method === 'GET') {
      return json(res, 200, readPhotoDescriptions(m[1]))
    }
  }

  if (m = SHOW_PHOTO_CAP.exec(pathname)) {
    if (method === 'PUT') {
      const id = m[1]
      const filename = decodeURIComponent(m[2])
      if (filename !== path.basename(filename) || filename.includes('..')) {
        return json(res, 400, { error: 'Ungültiger Dateiname' })
      }
      const body = await readJsonBody(req, res); if (body === null) return
      const { caption } = body
      writePhotoDescription(id, filename, caption ?? '')
      return json(res, 200, { ok: true })
    }
  }

  if (m = CHAN_PHOTO_REORDER.exec(pathname)) {
    if (method === 'PUT') {
      const channelId = m[2]
      const body = await readJsonBody(req, res); if (body === null) return
      const { photos: filenames } = body
      if (!Array.isArray(filenames)) return json(res, 400, { error: 'Photos muss ein Array sein' })
      reorderChannelPhotos(channelId, filenames)
      return json(res, 200, { ok: true })
    }
  }

  if (m = CHAN_PHOTOS.exec(pathname)) {
    const channelId = m[2]
    if (method === 'GET') {
      return json(res, 200, { photos: readChannelPhotos(channelId) })
    }
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      const { filename } = body
      if (!filename || filename !== path.basename(filename) || filename.includes('..')) {
        return json(res, 400, { error: 'Ungültiger Dateiname' })
      }
      addChannelPhoto(channelId, filename)
      return json(res, 201, { ok: true })
    }
  }

  if (m = CHAN_PHOTO_FILE.exec(pathname)) {
    if (method === 'DELETE') {
      const channelId = m[2]
      const filename = path.basename(decodeURIComponent(m[3]))
      removeChannelPhoto(channelId, filename)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_PHOTO_CHANNELS_ALL.exec(pathname)) {
    if (method === 'GET') {
      return json(res, 200, readAllPhotoChannels(m[1]))
    }
  }

  if (m = SHOW_PHOTO_CHANNELS.exec(pathname)) {
    const id = m[1]
    const filename = path.basename(decodeURIComponent(m[2]))
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelIds } = body
      if (!Array.isArray(channelIds)) return json(res, 400, { error: 'channelIds muss ein Array sein' })
      setPhotoChannels(id, filename, channelIds)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_PHOTO_FILE.exec(pathname)) {
    const slug = m[1]
    const filename = path.basename(decodeURIComponent(m[2]))
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      await photosLib.deletePhoto(slug, filename)
      deletePhotoDescription(slug, filename)
      deletePhotoChannels(slug, filename)
      return json(res, 200, { ok: true })
    }
    if (method === 'GET') {
      const thumb = params.thumb === '1'
      const filePath = thumb
        ? photosLib.getPhotoThumbPath(slug, filename)
        : photosLib.getPhotoPath(slug, filename)
      try {
        let resolvedPath = filePath
        if (thumb) {
          try { await fs.promises.access(filePath) } catch {
            resolvedPath = photosLib.getPhotoPath(slug, filename)
            photosLib.ensureThumbs(slug).catch(() => {})
          }
        }
        const stat = await fs.promises.stat(resolvedPath)
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=86400',
          'Referrer-Policy': 'no-referrer',
        })
        fs.createReadStream(resolvedPath).pipe(res)
      } catch { return notFound(res) }
      return
    }
  }

  return null
}
