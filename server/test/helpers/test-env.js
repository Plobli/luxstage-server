import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'luxstage-test-'))

process.env.DATA_PATH = dataPath
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'
process.env.BASE_DOMAIN = 'luxstage.test'

export function createResponse() {
  let status = null
  let body = null
  return {
    writeHead(code) { status = code },
    end(content) { body = content ? JSON.parse(content) : null },
    get status() { return status },
    get body() { return body },
  }
}

export function cleanupDataPath() {
  fs.rmSync(dataPath, { recursive: true, force: true })
}