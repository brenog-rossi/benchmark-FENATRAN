// One object URL per Blob for the lifetime of the page; revoke when the media is removed.
const urls = new WeakMap<Blob, string>()

export function objectUrl(blob: Blob): string {
  let url = urls.get(blob)
  if (!url) {
    url = URL.createObjectURL(blob)
    urls.set(blob, url)
  }
  return url
}

export function revokeObjectUrl(blob: Blob): void {
  const url = urls.get(blob)
  if (url) {
    URL.revokeObjectURL(url)
    urls.delete(blob)
  }
}
