export type ShareOutcome = 'shared' | 'cancelled' | 'failed'

export function canShareFiles(files: File[]): boolean {
  if (files.length === 0 || typeof navigator.share !== 'function') return false
  try {
    return navigator.canShare?.({ files }) === true
  } catch {
    return false
  }
}

// Must run inside a user gesture (tap). One `text` for all files: WhatsApp may drop it on
// multi-file shares, so captions also live in the file names and data.json.
export async function shareFiles(
  files: File[],
  title: string,
  text?: string,
): Promise<ShareOutcome> {
  try {
    await navigator.share({ files, title, text })
    return 'shared'
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
