# Audit-Prozess

Dieser Prozess ersetzt das wiederholte Ausführen eines LLM-Audit-Skills (das bei
jedem Lauf neu bewertet und dadurch immer wieder "neue" Findings gegen einen sich
verschiebenden Maßstab produziert — siehe Diskussion vom 2026-09-05). Er trennt
zwei fundamental verschiedene Arten von Befund:

## 1. Deterministische Struktur-Checks (`npm run audit`)

Feste Schwellen, fest programmierte Regeln, exakt reproduzierbares Ergebnis bei
gleichem Code. Kein LLM-Urteil, keine Neubewertung.

```bash
npm run audit              # beide Checks
npm run audit:structure    # Dateigröße, Funktionsgröße, Komplexität, Zirkularität
npm run audit:duplication  # Code-Duplikate (jscpd)
```

**Was geprüft wird und mit welcher Schwelle** (`eslint.audit.config.mjs`):

| Metrik | Regel | Schwelle | Scope |
|---|---|---|---|
| Dateigröße | `max-lines` | 400 Zeilen (Code, ohne Kommentare/Leerzeilen) | `server/`, `web-app/src/`, `shared/` |
| Funktionsgröße | `max-lines-per-function` | 80 Zeilen | dito |
| Zyklomatische Komplexität | `complexity` | 15 | dito |
| Zirkuläre Imports | `import-x/no-cycle` | 0 Zyklen | dito |
| Code-Duplikate | `jscpd` (`.jscpd.json`) | < 3% duplizierte Tokens | dito |

`web-app/src/components/ui/**` (generierte reka-ui-Wrapper) ist bewusst
ausgeschlossen — das ist Drittanbieter-/Boilerplate-Code, kein Anwendungscode.

**Schwellen ändern**: in `eslint.audit.config.mjs` (`STRUCTURE_RULES`) bzw.
`.jscpd.json` (`threshold`). Wer die Zahl ändert, verantwortet auch die Änderung —
das hält den Maßstab absichtlich, nicht zufällig verschiebbar.

**Ergebnis lesen**: `npm run audit:structure` listet jeden Verstoß mit Datei,
Zeile und der überschrittenen Schwelle. Kein Verstoß = Datei/Funktion ist
innerhalb der selbst gesetzten Grenzen — das ist "fertig" für diesen Check,
unabhängig davon, ob irgendwo im Repo eine noch größere Datei existiert (anders
als beim LLM-Audit gibt es hier keinen relativen "größte Datei zuerst"-Effekt).

Ein Fund hier ist noch kein automatischer Auftrag zum Umbau — er ist ein
Kandidat für den Backlog (siehe unten), wenn eine echte inhaltliche Bewertung
ansteht.

## 2. Ermessensfragen (`audits/backlog.md`)

Fragen wie "ist diese Abstraktion sinnvoll?", "lohnt sich dieser Trade-off?",
"sollte dieser Ordner anders geschnitten sein?" haben keinen deterministischen,
absoluten Maßstab — das ist kein Werkzeug-Problem, sondern die Natur der Frage.
Diese Fragen laufen über den Backlog:

- **Ein LLM-Review (z.B. `/code-review`) trägt neue Punkte in `audits/backlog.md`
  ein — es schreibt nie einen neuen Gesamtbericht.** Damit entfällt der Effekt,
  dass ein bereits erledigter Punkt beim nächsten Lauf unter neuer Formulierung
  wieder auftaucht.
- Jeder Backlog-Eintrag hat einen Status (`offen` / `erledigt` / `verworfen`) und
  bleibt stehen, auch wenn er erledigt ist (mit Datum/Commit) — so ist die
  Historie nachvollziehbar, statt bei jedem Lauf neu erfunden zu werden.
- Ein Review, das einen bereits im Backlog stehenden Punkt erneut findet, hakt
  ihn ab oder verweist darauf — es dupliziert ihn nicht als "neuen" Fund.

## Wann was nutzen

- **Vor einem Merge / regelmäßig in CI**: `npm run audit` — schnell, exakt
  reproduzierbar, keine Kosten für ein LLM.
- **Bei größeren Refactorings oder auf expliziten Wunsch**: ein LLM-Review, das
  ausschließlich in `audits/backlog.md` schreibt (nie einen neuen
  Analyse-Bericht als eigene Datei).
- **Nicht mehr tun**: den generischen Software-Design-Analyse-Skill wiederholt
  ohne festen Bezugspunkt laufen lassen — das produziert strukturell immer
  wieder "neue" Befunde, weil der Maßstab bei jedem Lauf relativ zum aktuellen
  Code neu kalibriert wird (siehe `2026-09-05-software-design-analysis.md`
  Ziffer 1: "Most findings below are residual/second-order" — der Bericht
  bestätigt selbst, dass es sich um Restbefunde nach vorheriger Arbeit handelt,
  nicht um neue Probleme).
