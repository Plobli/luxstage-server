// Gemeinsame Farbkonvertierung für Server (PDF) und Web-App (Filter-Badges).
// Server importiert relativ, Web-App über den Vite-Alias '@shared/color.js'.

/** Wählt Schwarz oder Weiß als lesbaren Text auf einer #rrggbb-Hintergrundfarbe. */
export function contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return l > 0.5 ? '#000000' : '#ffffff'
}
