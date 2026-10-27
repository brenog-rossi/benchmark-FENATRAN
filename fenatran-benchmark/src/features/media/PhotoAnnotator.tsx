import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button, Sheet } from '../../components/ui'
import type { Media } from '../../data/types'
import { canvasToJpeg, loadImage } from '../../lib/image'
import { objectUrl } from '../../lib/objectUrl'

const PEN_COLORS = [
  { name: 'Red', value: '#e3001b' },
  { name: 'Yellow', value: '#ffd200' },
  { name: 'White', value: '#ffffff' },
  { name: 'Navy', value: '#202a44' },
] as const

type Point = { x: number; y: number }
type Stroke = { color: string; width: number; points: Point[] }

type PhotoAnnotatorProps = {
  photo: Media
  onCancel: () => void
  onSave: (blob: Blob) => void
}

// Draws on a copy of the photo; the original media is never changed.
export function PhotoAnnotator({ photo, onCancel, onSave }: PhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const image = useRef<HTMLImageElement | null>(null)
  const strokes = useRef<Stroke[]>([])
  const active = useRef<Stroke | null>(null)
  const [color, setColor] = useState<string>(PEN_COLORS[0].value)
  const [count, setCount] = useState(0)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'saving'>('loading')

  // Called only after the image has loaded.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image.current as HTMLImageElement, 0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes.current) {
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.beginPath()
      stroke.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
    }
  }, [])

  useEffect(() => {
    let current = true
    loadImage(objectUrl(photo.blob)).then(
      (img) => {
        if (!current) return
        const canvas = canvasRef.current as HTMLCanvasElement
        image.current = img
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        setState('ready')
        redraw()
      },
      () => {
        if (current) setState('error')
      },
    )
    return () => {
      current = false
    }
  }, [photo, redraw])

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * canvas.width) / (rect.width || canvas.width),
      y: ((event.clientY - rect.top) * canvas.height) / (rect.height || canvas.height),
    }
  }

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (state !== 'ready') return
    const width = Math.max(4, event.currentTarget.width / 150)
    active.current = { color, width, points: [point(event)] }
    strokes.current.push(active.current)
    setCount(strokes.current.length)
    redraw()
  }
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!active.current) return
    active.current.points.push(point(event))
    redraw()
  }
  const up = () => {
    active.current = null
  }

  const undo = () => {
    strokes.current.pop()
    setCount(strokes.current.length)
    redraw()
  }

  const save = async () => {
    setState('saving')
    try {
      onSave(await canvasToJpeg(canvasRef.current as HTMLCanvasElement))
    } catch {
      setState('error')
    }
  }

  return (
    <Sheet
      open
      title="Mark up photo"
      onClose={onCancel}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button icon="check" disabled={state !== 'ready'} onClick={() => void save()}>
            Save copy
          </Button>
        </>
      }
    >
      <p className="annotator__hint">Draw on the photo. The original photo is kept.</p>
      <div className="annotator__tools">
        <div className="annotator__colors" role="radiogroup" aria-label="Pen colour">
          {PEN_COLORS.map((pen) => (
            <button
              key={pen.value}
              type="button"
              role="radio"
              aria-checked={color === pen.value}
              aria-label={pen.name}
              className="annotator__color"
              style={{ background: pen.value }}
              onClick={() => setColor(pen.value)}
            />
          ))}
        </div>
        <Button variant="secondary" icon="undo" disabled={count === 0} onClick={undo}>
          Undo
        </Button>
      </div>
      {state === 'error' && (
        <p className="field__error" role="alert">
          This photo could not be edited.
        </p>
      )}
      <canvas
        ref={canvasRef}
        className="annotator__canvas"
        aria-label="Photo to mark up"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
      />
    </Sheet>
  )
}
