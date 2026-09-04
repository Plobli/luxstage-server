import { api } from './client'

export function getSmtpConfig(): Promise<any> { return api.get('/api/smtp') }
export function saveSmtpConfig(cfg: object): Promise<any> { return api.post('/api/smtp', cfg) }
export function testSmtpConfig(to: string): Promise<any> { return api.post('/api/smtp/test', { to }) }
