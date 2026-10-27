// Canvas helpers. Re-encoding through a canvas drops all metadata (EXIF, GPS).
export const MAX_PHOTO_PX = 4096
export const THUMB_PX = 320
const JPEG = 'image/jpeg'

export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height, 1))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      JPEG,
      quality,
    )
  })
}

function encode(source: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const size = fitWithin(source.width, source.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas unavailable'))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size.width, size.height)
  ctx.drawImage(source, 0, 0, size.width, size.height)
  return canvasToJpeg(canvas, quality)
}

function decode(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') return Promise.reject(new Error('No decoder'))
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}

// Downscales to `max` px on the longest side and re-encodes as JPEG.
export async function resizeImage(blob: Blob, max = MAX_PHOTO_PX, quality = 0.9): Promise<Blob> {
  const bitmap = await decode(blob)
  try {
    return await encode(bitmap, max, quality)
  } finally {
    bitmap.close()
  }
}

export type PreparedPhoto = { blob: Blob; thumb?: Blob; mime: string }

// Stored copy (<= 4096 px, no EXIF) + thumbnail. Falls back to the original file when the
// browser cannot decode it (for example HEIC on some devices).
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  try {
    const bitmap = await decode(file)
    try {
      const blob = await encode(bitmap, MAX_PHOTO_PX, 0.9)
      const thumb = await encode(bitmap, THUMB_PX, 0.7)
      return { blob, thumb, mime: JPEG }
    } finally {
      bitmap.close()
    }
  } catch {
    return { blob: file, mime: file.type || JPEG }
  }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image could not be loaded'))
    image.src = url
  })
}
