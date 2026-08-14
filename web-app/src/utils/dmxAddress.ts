/**
 * Normalisiert eine DMX-Adresse auf das Format "Universum/Adresse" mit
 * 3-stelliger Adresse (z.B. "1/010"). Reine Zahlen ohne Universum werden als
 * durchlaufende Adresse interpretiert und auf Universum+Adresse umgerechnet
 * (ein Universum umfasst 512 Kanäle) — siehe ETC Eos Handbuch: Adresse 515
 * ist die 3. Adresse von Universum 2, also "2/003".
 * Eingaben, die keinem der beiden Formate entsprechen, bleiben unverändert.
 */
export function normalizeDmxAddress(raw: string): string {
  const value = raw.trim()
  if (!value) return value

  const withUniverse = value.match(/^(\d+)\/(\d+)$/)
  if (withUniverse) {
    const universe = parseInt(withUniverse[1], 10).toString()
    const address = withUniverse[2].padStart(3, '0')
    return `${universe}/${address}`
  }

  const withoutUniverse = value.match(/^(\d+)$/)
  if (withoutUniverse) {
    const absolute = parseInt(withoutUniverse[1], 10)
    if (absolute < 1) return value
    const universe = Math.floor((absolute - 1) / 512) + 1
    const address = ((absolute - 1) % 512 + 1).toString().padStart(3, '0')
    return `${universe}/${address}`
  }

  return value
}
