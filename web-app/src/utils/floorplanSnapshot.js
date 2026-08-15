// Helle Fallback-Werte für CSS-Variablen im Snapshot (Theme-unabhängig)
const SNAPSHOT_CSS_VARS = {
  '--color-card': '#ffffff',
  '--color-card-foreground': '#0a0a0a',
  '--color-foreground': '#0a0a0a',
  '--color-muted-foreground': '#6b7280',
  '--color-accent': '#dc3740',
  '--color-accent-foreground': '#ffffff',
  '--color-ring': '#dc3740',
  '--color-background': '#ffffff',
  '--color-border': '#e5e7eb',
  '--text-xs': '10px',
  '--text-sm': '12px',
  '--text-base': '14px',
  '--text-xl': '18px',
}

export function resolveCssVarsInSvg(svgEl) {
  const resolve = (val) => {
    if (!val) return val
    return val.replace(/var\(([^),]+)(?:,[^)]+)?\)/g, (_, name) => {
      return SNAPSHOT_CSS_VARS[name.trim()] ?? '#000000'
    })
  }
  svgEl.querySelectorAll('*').forEach(el => {
    for (const attr of ['fill', 'stroke', 'color']) {
      const v = el.getAttribute(attr)
      if (v && v.includes('var(')) el.setAttribute(attr, resolve(v))
    }
    if (el.style?.fill?.includes('var(')) el.style.fill = resolve(el.style.fill)
    if (el.style?.stroke?.includes('var(')) el.style.stroke = resolve(el.style.stroke)
    const fs = el.getAttribute('font-size')
    if (fs && fs.includes('var(')) el.setAttribute('font-size', resolve(fs))
  })
}

const SNAPSHOT_OVERFLOW = 120 // CSS-px Rand für overflow-visible Elemente am Stage-Rand

export async function captureFloorplanSnapshot(svgEl, stageSize, bgImage) {
  if (!svgEl) return null
  const SCALE = 3
  const OV = SNAPSHOT_OVERFLOW
  const w = stageSize.width
  const h = stageSize.height
  const canvas = document.createElement('canvas')
  canvas.width = (w + OV * 2) * SCALE
  canvas.height = (h + OV * 2) * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w + OV * 2, h + OV * 2)
  if (bgImage) ctx.drawImage(bgImage, OV, OV, w, h)
  await new Promise(resolve => {
    const svg = svgEl.cloneNode(true)
    const bgImgNode = svg.querySelector('#bg-image')
    if (bgImgNode) bgImgNode.remove()
    resolveCssVarsInSvg(svg)
    svg.setAttribute('width', String(w + OV * 2))
    svg.setAttribute('height', String(h + OV * 2))
    svg.setAttribute('viewBox', `${-OV} ${-OV} ${w + OV * 2} ${h + OV * 2}`)
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = '* { font-family: Arial, Helvetica, sans-serif !important; }'
    svg.insertBefore(styleEl, svg.firstChild)
    let svgStr = new XMLSerializer().serializeToString(svg)
    if (!svgStr.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      svgStr = svgStr.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    }
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w + OV * 2, h + OV * 2)
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve() }
    img.src = url
  })
  return await new Promise(res => canvas.toBlob(blob => {
    if (!blob) return res(null)
    const reader = new FileReader()
    reader.onload = () => res(reader.result)
    reader.readAsDataURL(blob)
  }, 'image/jpeg', 0.92))
}

export function exportFloorplanPNG(svgEl, stageSize, bgImage, filename = 'grundriss.png') {
  const canvas = document.createElement('canvas')
  canvas.width = stageSize.width * 2
  canvas.height = stageSize.height * 2
  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)
  if (bgImage) ctx.drawImage(bgImage, 0, 0, stageSize.width, stageSize.height)

  const svg = svgEl.cloneNode(true)
  const bgImgNode = svg.querySelector('#bg-image')
  if (bgImgNode) bgImgNode.remove()
  resolveCssVarsInSvg(svg)
  svg.setAttribute('width', stageSize.width)
  svg.setAttribute('height', stageSize.height)
  // BUG: anders als captureFloorplanSnapshot() oben fehlt hier der
  // <style>font-family Arial...</style>-Block. Ohne ihn übernimmt der Browser
  // beim SVG->Canvas-Rendering die System-Serifenschrift statt der sans-serif
  // Schrift der WebApp, darum ist der PNG-Export immer Serif. Fix: denselben
  // styleEl-Block wie in captureFloorplanSnapshot() vor svg.firstChild einfügen.
  let svgStr = new XMLSerializer().serializeToString(svg)
  if (!svgStr.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgStr = svgStr.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = filename
    a.click()
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
}
