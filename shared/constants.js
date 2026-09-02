// Gemeinsame Konstanten für Server und Web-App.
// Server importiert relativ, Web-App über den Vite-Alias '@shared/constants.js'.

/** Mindestlänge eines Passworts — Prüflogik und Locale-Texte leiten sich hiervon ab. */
export const PASSWORD_MIN_LENGTH = 8

/** Bewusst permissiv — endgültig entscheidet die Zustellbarkeit der Bestätigungsmail. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmail = value => EMAIL_RE.test(String(value ?? '').trim())

/** Section-Typen. Alles außerhalb dieser Liste wird als Setup-/Markdown-Text
 *  behandelt (siehe `server/pdf/section-renderers.js`). */
export const SECTION_TYPES = ['setup', 'kv-table', 'fields']

/** Typen, die eine `rows`-Liste führen — beim Anlegen mit `[]` zu initialisieren. */
export const SECTION_TYPES_WITH_ROWS = ['kv-table']

/** `fields` ist der Altbestand von `kv-table`; beide zählen als derselbe
 *  Tabellentyp, von dem es je Vorlage nur einen geben darf. */
export const SECTION_TABLE_TYPES = ['kv-table', 'fields']

export const sectionTypeHasRows = type => SECTION_TYPES_WITH_ROWS.includes(type)
export const isSectionTableType = type => SECTION_TABLE_TYPES.includes(type)
