// LuxStage/server/bootstrap.js
// Einmaliges Setup-Skript: legt den ersten Nutzer in der users-Tabelle an.
// Idempotent: bestehende Nutzer werden nicht überschrieben.
//
// Der Login-Name ist die E-Mail-Adresse — so wie es Benutzerverwaltung,
// Registrierung und Passwort-Reset ohnehin voraussetzen. Weitere Konten legt
// der Admin danach über die Benutzerverwaltung an.
//
// Benötigt: JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
// Optional: DATA_PATH (Standard: ../data)
//
// Aufruf:
//   ADMIN_EMAIL="..." ADMIN_PASSWORD="..." JWT_SECRET="..." node bootstrap.js

import bcrypt from 'bcrypt'
import { dbContainer } from './db-init.js'

const BCRYPT_COST = 12

const adminEmail = (process.env.ADMIN_EMAIL || '').trim()
const adminPassword = process.env.ADMIN_PASSWORD

if (!adminPassword) {
  console.error('FEHLER: ADMIN_PASSWORD fehlt.')
  process.exit(1)
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  console.error('FEHLER: ADMIN_EMAIL fehlt oder ist keine gültige E-Mail-Adresse.')
  process.exit(1)
}

const insert = dbContainer.db.prepare(
  'INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)'
)

const adminHash = await bcrypt.hash(adminPassword, BCRYPT_COST)
const adminResult = insert.run(adminEmail, adminHash, adminEmail)

if (adminResult.changes > 0) {
  console.log(`  ✓  Nutzer "${adminEmail}" angelegt`)
} else {
  console.log(`  –  Nutzer "${adminEmail}" existiert bereits, wird nicht überschrieben`)
}

dbContainer.db.close()
