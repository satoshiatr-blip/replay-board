import { useEffect, useRef, useState } from 'react'
import { drawBoard, hitPiece, toPitch, type BoardView } from '../board'
import type { Drawing, Pt } from '../types'
import { uid } from '../types'

export type Tool = 'move' | 'arrow' | 'zone'

type Props = BoardView & {
  tool?: Tool
  onMoveStart?: () => void
  onMove?: (id: string, p: Pt) => void
  onDraw?: (d: Drawing) => void
  onLongPress?: (id: string) => void
}

const LONG_MS = 500

export default function BoardCanvas({ tool = 'move', onMoveStart, onMove, onDraw, onLongPress, ...view }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [draft, setDraft] = useState<Drawing | null>(null)
  const g = useRef<{ id: string | null; x0: number; y0: number; moved: boolean; long: boolean; timer: number } | null>(null)

  useEffect(() => {
    const el = wrap.current!
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = cv.current
    if (!c || !size.w) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(size.w * dpr)
    c.height = Math.round(size.h * dpr)
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    drawBoard(ctx, 0, 0, size.w, size.h, { ...view, drawings: draft ? [...view.drawings, draft] : view.drawings })
  })

  const at = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  function down(e: React.PointerEvent) {
    if (!onMove) return
    const [x, y] = at(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'move') {
      const id = hitPiece(view.pieces, view.pos, size.w, size.h, x, y, view.showAway)
      if (!id) return
      const timer = window.setTimeout(() => {
        if (g.current && !g.current.moved && id !== 'ball') { g.current.long = true; navigator.vibrate?.(15); onLongPress?.(id) }
      }, LONG_MS)
      g.current = { id, x0: x, y0: y, moved: false, long: false, timer }
      return
    }
    const p = toPitch(size.w, size.h, x, y)
    g.current = { id: null, x0: x, y0: y, moved: false, long: false, timer: 0 }
    setDraft({ id: uid(), kind: tool, pts: [p, p] })
  }

  function move(e: React.PointerEvent) {
    const s = g.current
    if (!s) return
    const [x, y] = at(e)
    if (!s.moved && Math.hypot(x - s.x0, y - s.y0) < 6) return
    if (s.long) return
    if (!s.moved) { s.moved = true; clearTimeout(s.timer); if (s.id) onMoveStart?.() }
    const p = toPitch(size.w, size.h, x, y)
    if (s.id) { onMove?.(s.id, p); return }
    setDraft(d => {
      if (!d) return d
      if (d.kind === 'zone') return { ...d, pts: [d.pts[0], p] }
      const last = d.pts[d.pts.length - 1]
      // 指の細かい震えで点が増えすぎないよう、少し離れたら足す
      return Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.012 ? d : { ...d, pts: [...d.pts, p] }
    })
  }

  function up() {
    const s = g.current
    g.current = null
    if (s) clearTimeout(s.timer)
    if (!draft) return
    const [a, b] = [draft.pts[0], draft.pts[draft.pts.length - 1]]
    if (s?.moved && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.04) onDraw?.(draft)
    setDraft(null)
  }

  return (
    <div ref={wrap} className="w-full aspect-[1/1.33] select-none">
      <canvas ref={cv} className="w-full h-full touch-none" style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={e => e.preventDefault()} />
    </div>
  )
}
