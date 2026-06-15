// Riftbound domains. Cards can be single- or dual-domain (max 2).
// Stored in the `domain` column as a JSON array string e.g. '["Fury","Calm"]'.
// Legacy rows hold a plain string ("Fury") — parseDomains tolerates both.

export const RB_DOMAINS = ['Fury', 'Calm', 'Chaos', 'Order', 'Mind', 'Body'] as const
// Cards may combine any number of domains (1 through all 6).
export const MAX_DOMAINS = RB_DOMAINS.length

// Parse a stored domain value into an array of domain names.
//   '["Fury","Calm"]' → ['Fury','Calm']   (JSON array)
//   'Fury'            → ['Fury']           (legacy single value)
//   null / ''         → []
export function parseDomains(raw: string | null | undefined): string[] {
  if (!raw) return []
  const s = String(raw).trim()
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string' && x.length > 0)
    } catch { /* malformed JSON — fall through to single-value */ }
  }
  return [s]
}

// Human-readable label, e.g. "Fury / Calm".
export function formatDomains(raw: string | null | undefined): string {
  return parseDomains(raw).join(' / ')
}

// Serialize a selection back to storage form. '' when empty (so optStr → null).
export function serializeDomains(domains: string[]): string {
  return domains.length ? JSON.stringify(domains) : ''
}
