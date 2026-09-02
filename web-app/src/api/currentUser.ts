import { getToken } from './client.js'
import { jwtDecode } from './jwtDecode.js'

/** Der eingeloggte Nutzername aus dem JWT, oder null wenn nicht angemeldet. */
export function currentUsername(): string | null {
  const token = getToken()
  return token ? (jwtDecode(token)?.username ?? null) : null
}
