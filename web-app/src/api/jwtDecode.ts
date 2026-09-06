/** Payload von signToken() (server/auth.js) — email ist dort NICHT enthalten
 *  (siehe SmtpView.vue userEmail, das trotzdem darauf zugreift — vermutlich
 *  ein bestehender Bug, außerhalb des Scopes dieser Typisierung). */
export interface JwtPayload {
  username: string;
  tenantId?: string;
  tokenVersion: number;
  exp: number;
  iat: number;
}

/** Minimaler JWT-Payload-Decoder (kein Package nötig) */
export function jwtDecode(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

