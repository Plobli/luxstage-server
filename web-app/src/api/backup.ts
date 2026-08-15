/**
 * backup.ts — ZIP-Backup-Download und -Restore
 */
import { api } from './client'

export async function downloadBackup(): Promise<void> {
  const url = await api.downloadUrl('/api/backup')
  window.location.href = url
}

export async function uploadRestore(file: File): Promise<any> {
  return api.send('POST', '/api/restore', file, 'application/zip')
}

