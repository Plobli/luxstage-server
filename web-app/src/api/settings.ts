import { api } from './client'

export interface DisplaySettings {
  measure_unit: 'm' | 'cm' | 'mm'
  photos_per_page: number
}

export const fetchDisplaySettings = (): Promise<DisplaySettings> => api.get('/api/settings/display')
export const saveDisplaySettings = (data: Partial<DisplaySettings>): Promise<{ ok: true }> => api.post('/api/settings/display', data)

// useMeasureUnit und usePhotoSettings lesen beide beim Start denselben
// Endpunkt — ein gemeinsamer, einmaliger In-Flight-Cache statt zweier
// unabhängiger Requests für dieselbe Antwort.
let initialLoad: Promise<DisplaySettings> | null = null
export function loadDisplaySettingsOnce(): Promise<DisplaySettings> {
  return initialLoad ??= fetchDisplaySettings()
}
