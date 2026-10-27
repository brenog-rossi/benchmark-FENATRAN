import { strToU8, zipSync, type Zippable } from 'fflate'

export type ZipEntry = { path: string; data: Blob | string }

// Already-compressed media (JPEG, MP4, ...) is stored; text and XLSX are deflated.
const STORED = /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|webm|3gp|m4a|aac|mp3|ogg|zip|xlsx)$/i

async function bytes(data: Blob | string): Promise<Uint8Array> {
  return typeof data === 'string' ? strToU8(data) : new Uint8Array(await data.arrayBuffer())
}

export async function createZip(entries: ZipEntry[]): Promise<Blob> {
  const tree: Zippable = {}
  for (const entry of entries) {
    tree[entry.path] = [await bytes(entry.data), { level: STORED.test(entry.path) ? 0 : 6 }]
  }
  return new Blob([zipSync(tree)], { type: 'application/zip' })
}
