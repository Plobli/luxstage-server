// mount_ref in channels: JSON-Feld { type, towerId, slotIndex } oder null
export const id = '011-channels-mount-ref-quantity'

export function alreadyApplied(db) {
  const cols = db.pragma('table_info(channels)').map(c => c.name)
  return cols.includes('mount_ref') && cols.includes('quantity')
}

export function up(db) {
  const cols = db.pragma('table_info(channels)').map(c => c.name)
  if (!cols.includes('mount_ref')) db.exec('ALTER TABLE channels ADD COLUMN mount_ref TEXT')
  if (!cols.includes('quantity')) db.exec('ALTER TABLE channels ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1')
}
