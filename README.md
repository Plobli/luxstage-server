# LuxStage

Bühnenmanagement für die Beleuchtung

## Was ist LuxStage?

LuxStage verwaltet Shows, Kanäle und technische Einrichtung für Bühnenshows. Erstelle Vorlagen, speichere Konfigurationen, verfolge Änderungen und exportiere Daten — alles in einer App.

## Features

### Shows verwalten
Erstelle und archiviere Shows. Jede Show enthält Einrichtungs- und Einleuchtnotizen sowie Fotos. Stelle Shows schnell wieder her oder lösche sie dauerhaft.

### Kanäle
Definiere Kanäle mit Nummer, Adresse, Gerät, Position, Farbe und Notizen. Zeige Duplikat-Warnungen für Adressen und Kanalnummern. Sortiere und gruppiere nach Position.

### Sektionen & Notizen
Schreibe Markdown-Notizen oder strukturierte Felder in Sektionen. Reihenfolge per Drag-and-drop veränderbar.

### Grundriss
Zeichne Grundrisse als Canvas über einem Hintergrundbild. Springe direkt zu Kanälen aus dem Grundriss.

### Fotogalerie
Lade Fotos hoch, weise Kanalnummern zu und organisiere sie in einer Galerie.

### Vorlagen
Speichere Kanalkonfigurationen, Sektionen und Grundriss-Bilder als Vorlagen. Neue Shows übernehmen Vorlage-Einstellungen automatisch.

### Import & Export
Importiere EOS-CSV-Dateien. Vorschau vor dem Merge zeigt neue, entfernte und unveränderte Kanäle. Exportiere Shows als CSV oder PDF.

### Versionshistorie
Automatische Snapshots alle 10 Minuten. Frühere Versionen abrufbar und wiederherstellbar.

### Mehrbenutzer
Benutzerverwaltung (nur Admin). Live-Presence zeigt, wer gerade aktiv ist.

### Einstellungen
Konto, Sprache, Darstellung und Benutzerverwaltung.

## Plattformen

- **Web-App**: Vue 3 + Tailwind CSS
- **iOS-App**: SwiftUI (iPhone & iPad)
- **Server**: Node.js + SQLite

## Mehrsprachig

Deutsch und Englisch verfügbar.

## Betrieb

LuxStage wird als gehosteter Dienst betrieben: jedes Theater bekommt einen eigenen
Zugang unter `<team>.luxstage.app`. Eine Selbstinstallation wird nicht mehr angeboten.

Technische Details zum Betrieb: `docs/saas-betrieb.md` und `docs/deploy-cx43.md`.
