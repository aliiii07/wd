// The ERP platform's own brand. Boutiques (tenants) keep their own names inside it.
export const PLATFORM = {
  name: 'Oq Libos',
  monogram: 'OL',
  product: 'Bridal ERP',
}

/** One or two letters for a boutique's monogram ("Sharlin" → "S", "Oq Libos" → "OL"). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

/** Order-number prefix derived from the boutique name ("Sharlin" → "SH"). */
export function orderPrefixOf(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, '').toUpperCase()
  return (letters.slice(0, 2) || 'OR').padEnd(2, 'X')
}
