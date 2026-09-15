export const id = '046-diagnostics'

export function alreadyApplied(db) {
  try {
    db.prepare('SELECT 1 FROM diagnostics_reports LIMIT 1').get()
    return true
  } catch {
    return false
  }
}

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS diagnostics_reports (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      platform       TEXT NOT NULL,
      app_version    TEXT,
      build_number   TEXT,
      os_version     TEXT,
      device_model   TEXT,
      report_type    TEXT NOT NULL,
      payload        TEXT NOT NULL,
      created_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_diagnostics_platform_type ON diagnostics_reports(platform, report_type);
    CREATE INDEX IF NOT EXISTS idx_diagnostics_created_at ON diagnostics_reports(created_at DESC);
  `)
}
