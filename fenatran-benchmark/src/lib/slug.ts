// Safe ASCII file-name fragments: accents removed, anything else becomes `separator`.
export function slugify(text: string, max = 40, separator = '-'): string {
  const ascii = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const parts = ascii.match(/[A-Za-z0-9]+/g) ?? []
  let out = ''
  for (const part of parts) {
    const next = out ? `${out}${separator}${part}` : part
    if (next.length > max) break
    out = next
  }
  return out || (parts[0] ?? '').slice(0, max)
}

// Local calendar date, yyyy-mm-dd.
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
