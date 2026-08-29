// Netzwerk-Übersicht: gebäudeweite Verkabelung, unabhängig von einzelnen
// Shows. Nutzer pflegt eine Verbindungsliste (Tabelle), die Topologie wird
// daraus im Frontend automatisch gezeichnet.
export const id = '034-network-tables'

export function alreadyApplied(db) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'network_nodes'
  `).get()
  return row.n > 0
}

export function up(db) {
  db.exec(`
    CREATE TABLE network_nodes (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      label      TEXT NOT NULL,
      room       TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE network_connections (
      id            TEXT PRIMARY KEY,
      from_node_id  TEXT NOT NULL REFERENCES network_nodes(id) ON DELETE CASCADE,
      from_port     TEXT NOT NULL DEFAULT '',
      to_node_id    TEXT NOT NULL REFERENCES network_nodes(id) ON DELETE CASCADE,
      to_port       TEXT NOT NULL DEFAULT '',
      cable_type    TEXT NOT NULL DEFAULT '',
      created_at    INTEGER NOT NULL
    );

    CREATE INDEX idx_network_connections_from ON network_connections(from_node_id);
    CREATE INDEX idx_network_connections_to   ON network_connections(to_node_id);
  `)
}
