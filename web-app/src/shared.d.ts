declare module '@shared/constants.js' {
  export const PASSWORD_MIN_LENGTH: number
  export const EMAIL_RE: RegExp
  export function isValidEmail(value: unknown): boolean
  export const SECTION_TYPES_WITH_ROWS: string[]
  export const SECTION_TABLE_TYPES: string[]
  export function sectionTypeHasRows(type: string): boolean
  export function isSectionTableType(type: string): boolean
  export function isValidConnectionPair(typeA: string | null | undefined, typeB: string | null | undefined): boolean
  export function maxConnectionsForType(type: string): number
  export const PDF_PRINT_AREA_RATIO: number
}