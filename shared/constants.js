// Gemeinsame Konstanten für Server und Web-App.
// Server importiert relativ, Web-App über den Vite-Alias '@shared/constants.js'.

/** Mindestlänge eines Passworts — Prüflogik und Locale-Texte leiten sich hiervon ab. */
export const PASSWORD_MIN_LENGTH = 8

/** Bewusst permissiv — endgültig entscheidet die Zustellbarkeit der Bestätigungsmail. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmail = value => EMAIL_RE.test(String(value ?? '').trim())

/** Typen, die eine `rows`-Liste führen — beim Anlegen mit `[]` zu initialisieren. */
export const SECTION_TYPES_WITH_ROWS = ['kv-table']

/** `fields` ist der Altbestand von `kv-table`; beide zählen als derselbe
 *  Tabellentyp, von dem es je Vorlage nur einen geben darf. */
export const SECTION_TABLE_TYPES = ['kv-table', 'fields']

export const sectionTypeHasRows = type => SECTION_TYPES_WITH_ROWS.includes(type)
export const isSectionTableType = type => SECTION_TABLE_TYPES.includes(type)

// Physikalisch sinnlos: zwei Netzwerkdosen oder zwei Geräte direkt
// miteinander verkabelt (ein Switch darf mit allem verbunden werden, auch
// mit einem zweiten Switch). Server (routes/network.js) setzt das
// verbindlich durch, das Frontend (NetworkView.vue) spiegelt dieselbe Regel
// nur für die Auswahl-UI — beide müssen dieselbe Definition verwenden.
export function isValidConnectionPair(typeA, typeB) {
  if (!typeA || !typeB) return true
  return !(typeA === typeB && (typeA === 'dose' || typeA === 'geraet'))
}

// Dose = Durchschleifung (rein/raus), also bis zu zwei Kabel; Gerät hat nur
// eines; Switch ist unbegrenzt (ein Port = eine Verbindung, separat geprüft).
export function maxConnectionsForType(type) {
  if (type === 'dose') return 2
  if (type === 'geraet') return 1
  return Infinity
}

// A4-Querformat-Druckbereich als Ziel-Seitenverhältnis (267mm x 160mm) — vom
// PDF-Export (server/pdf/floorplan-vector.js) UND vom Editor (FloorplanEditor.vue)
// verwendet, damit die Bühnenfläche im Editor exakt dem Druckbereich entspricht.
export const PDF_PRINT_AREA_RATIO = 267 / 160
