// Lowercase, no whitespace, a single "@" (later ones are dropped).
export function maskEmail(raw: string): string {
  const clean = raw.toLowerCase().replace(/\s+/g, '')
  const at = clean.indexOf('@')
  if (at === -1) return clean
  return clean.slice(0, at + 1) + clean.slice(at + 1).replaceAll('@', '')
}
