export function groupByPosition(channels) {
  const map = new Map()
  for (const ch of channels) {
    const pos = ch.position || 'Sonstiges'
    if (!map.has(pos)) map.set(pos, [])
    map.get(pos).push(ch)
  }
  return map
}

export function fmt(dateStr) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return dateStr }
}

// Liest Breite/Höhe aus einem JPEG- oder PNG-Buffer.
export function readImageSize(buf) {
  try {
    // PNG: Signatur 0x89 PNG, Dimensionen in IHDR-Chunk ab Byte 16
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      const w = buf.readUInt32BE(16)
      const h = buf.readUInt32BE(20)
      return { w, h }
    }
    // JPEG: SOF-Marker suchen
    let i = 2
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) return { w: 0, h: 0 }
      const marker = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) }
      }
      i += 2 + len
    }
  } catch {}
  return { w: 0, h: 0 }
}
