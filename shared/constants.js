// Gemeinsame Konstanten für Server und Web-App.
// Server importiert relativ, Web-App über den Vite-Alias '@shared/constants.js'.

/** Mindestlänge eines Passworts — Prüflogik und Locale-Texte leiten sich hiervon ab. */
export const PASSWORD_MIN_LENGTH = 8

/** Bewusst permissiv — endgültig entscheidet die Zustellbarkeit der Bestätigungsmail. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmail = value => EMAIL_RE.test(String(value ?? '').trim())
