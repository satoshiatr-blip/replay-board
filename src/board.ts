import type { Drawing, Keyframe, Piece, PitchView, Pt } from './types'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// ピッチの縦横比（8人制のピッチ 68m×50m を縦に置いた形）
export const PITCH_RATIO = 68 / 50

const HOME_COLOR = '#ff4d5e'
const AWAY_COLOR = '#3d8bff'
const DRAW_COLOR = '#ffd400'
const FONT = '-apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const smooth = (u: number) => u * u * (3 - 2 * u)

// 映す縦の範囲（0＝相手ゴール、1＝自陣ゴール）。半分表示でもセンターサークルが少し見えるよう余白を足す
const VIEW_RANGE: Record<PitchView, [number, number]> = { full: [0, 1], top: [-0.02, 0.58], bottom: [0.42, 1.02] }

// ボードの枠の縦横比（高さ÷幅）
export const boardAspect = (view: PitchView = 'full') => {
  const [a, b] = VIEW_RANGE[view]
  return (PITCH_RATIO * (b - a) * 0.9 + 0.1) / 1
}

// 枠（w×h）の中にピッチの映す範囲を収めたときの、ピッチ全体の位置と大きさ（範囲の外は枠で切れる）
export function pitchRect(w: number, h: number, view: PitchView = 'full') {
  const [a, b] = VIEW_RANGE[view]
  const f = b - a
  const pad = Math.min(w, h) * 0.05
  let pw = w - pad * 2
  let vh = pw * PITCH_RATIO * f
  if (vh > h - pad * 2) { vh = h - pad * 2; pw = vh / (PITCH_RATIO * f) }
  const ph = pw * PITCH_RATIO
  return { px: (w - pw) / 2, py: (h - vh) / 2 - a * ph, pw, ph }
}

// ---- 時間と位置 ----

export const sortKf = (kfs: Keyframe[]) => [...kfs].sort((a, b) => a.t - b.t)

// t の時点の位置：前後の瞬間（◆）をなめらかにつなぐ。◆が無ければ初期配置
export function positionsAt(kfs: Keyframe[], base: Record<string, Pt>, t: number): Record<string, Pt> {
  const ks = sortKf(kfs)
  if (!ks.length) return base
  const last = ks[ks.length - 1]
  if (t >= last.t) return { ...base, ...last.pos }
  // 最初の◆より前は、シーン先頭の初期配置から最初の◆へ動かす（◆1つでも動きが出る）
  const i = ks.findIndex(k => k.t > t)
  const a = i > 0 ? ks[i - 1] : { t: 0, pos: base }, b = ks[i]
  const u = smooth(clamp((t - a.t) / Math.max(0.001, b.t - a.t), 0, 1))
  const out: Record<string, Pt> = { ...base }
  for (const id of Object.keys(out)) {
    const pa = a.pos[id] ?? out[id], pb = b.pos[id] ?? pa
    out[id] = [pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u]
  }
  return out
}

// t の時点で効いている瞬間（その◆から次の◆の手前まで）
export function activeKf(kfs: Keyframe[], t: number) {
  const ks = sortKf(kfs)
  let cur: Keyframe | null = null
  for (const k of ks) if (k.t <= t + 0.001) cur = k
  return cur
}

// 動いた跡：直前の◆の位置から今の位置まで（大きく動いたコマだけ）
export function trailsAt(kfs: Keyframe[], base: Record<string, Pt>, t: number) {
  const prev = activeKf(kfs, t)
  if (!prev) return []
  const now = positionsAt(kfs, base, t)
  const out: [Pt, Pt][] = []
  for (const [id, p] of Object.entries(now)) {
    const q = prev.pos[id]
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.02) out.push([q, p])
  }
  return out
}

export function hitPiece(pieces: Piece[], pos: Record<string, Pt>, w: number, h: number, x: number, y: number, showAway: boolean, view?: PitchView) {
  const { px, py, pw, ph } = pitchRect(w, h, view)
  const r = pieceRadius(pw) * 1.5
  let best: string | null = null, bestD = Infinity
  for (const pc of pieces) {
    if (pc.team === 'away' && !showAway) continue
    const p = pos[pc.id]
    if (!p) continue
    const d = Math.hypot(px + p[0] * pw - x, py + p[1] * ph - y)
    if (d < r && d < bestD) { best = pc.id; bestD = d }
  }
  return best
}

export const toPitch = (w: number, h: number, x: number, y: number, view?: PitchView): Pt => {
  const { px, py, pw, ph } = pitchRect(w, h, view)
  return [clamp((x - px) / pw, -0.03, 1.03), clamp((y - py) / ph, -0.03, 1.03)]
}

const pieceRadius = (pw: number) => pw * 0.042

// ---- 描画 ----

export type BoardView = {
  pieces: Piece[]
  pos: Record<string, Pt>
  drawings: Drawing[]
  drawAlpha?: number
  trails?: [Pt, Pt][]
  showNames: boolean
  showAway: boolean
  selectedId?: string | null
  view?: PitchView
}

export function drawBoard(ctx: Ctx, x: number, y: number, w: number, h: number, v: BoardView) {
  const { px, py, pw, ph } = pitchRect(w, h, v.view)
  const X = (p: Pt) => x + px + p[0] * pw
  const Y = (p: Pt) => y + py + p[1] * ph
  ctx.save()
  // 芝の縞
  const R = Math.min(w, h) * 0.035
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, R)
  ctx.clip()
  ctx.fillStyle = '#1e6b35'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#237a3c'
  for (let i = 0; i < 10; i += 2) ctx.fillRect(x, y + py + (ph / 10) * i, w, ph / 10)
  // ライン
  ctx.strokeStyle = 'rgba(255,255,255,0.78)'
  ctx.lineWidth = Math.max(1.5, pw * 0.006)
  ctx.strokeRect(x + px, y + py, pw, ph)
  ctx.beginPath()
  ctx.moveTo(x + px, y + py + ph / 2)
  ctx.lineTo(x + px + pw, y + py + ph / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + px + pw / 2, y + py + ph / 2, pw * 0.13, 0, Math.PI * 2)
  ctx.stroke()
  const boxW = pw * 0.44, boxH = ph * 0.13
  ctx.strokeRect(x + px + (pw - boxW) / 2, y + py, boxW, boxH)
  ctx.strokeRect(x + px + (pw - boxW) / 2, y + py + ph - boxH, boxW, boxH)
  const gW = pw * 0.16, gH = ph * 0.02
  ctx.strokeRect(x + px + (pw - gW) / 2, y + py - gH, gW, gH)
  ctx.strokeRect(x + px + (pw - gW) / 2, y + py + ph, gW, gH)

  const r = pieceRadius(pw)
  // 動いた跡
  ctx.setLineDash([r * 0.3, r * 0.45])
  ctx.lineCap = 'round'
  ctx.lineWidth = r * 0.22
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  for (const [a, b] of v.trails ?? []) {
    ctx.beginPath()
    ctx.moveTo(X(a), Y(a))
    ctx.lineTo(X(b), Y(b))
    ctx.stroke()
  }
  ctx.setLineDash([])

  // 描いた矢印・範囲
  ctx.globalAlpha = v.drawAlpha ?? 1
  for (const d of v.drawings) drawDrawing(ctx, d, X, Y, r)
  ctx.globalAlpha = 1

  // コマ
  const order = [...v.pieces].sort((a, b) => (a.team === 'ball' ? 1 : 0) - (b.team === 'ball' ? 1 : 0))
  for (const pc of order) {
    if (pc.team === 'away' && !v.showAway) continue
    const p = v.pos[pc.id]
    if (!p) continue
    const cx = X(p), cy = Y(p)
    if (pc.team === 'ball') {
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#111'
      ctx.lineWidth = r * 0.14
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      continue
    }
    if (pc.id === v.selectedId) {
      ctx.strokeStyle = '#ff8a1f'
      ctx.lineWidth = r * 0.25
      ctx.beginPath()
      ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = r * 0.5
    ctx.shadowOffsetY = r * 0.15
    ctx.fillStyle = pc.team === 'home' ? HOME_COLOR : AWAY_COLOR
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = r * 0.17
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 ${r * (pc.number.length > 1 ? 0.9 : 1.05)}px ${FONT}`
    ctx.fillText(pc.number, cx, cy + r * 0.05)
    if (v.showNames && pc.name) {
      ctx.font = `800 ${r * 0.82}px ${FONT}`
      ctx.lineWidth = r * 0.28
      ctx.strokeStyle = 'rgba(6,30,15,0.9)'
      ctx.lineJoin = 'round'
      ctx.strokeText(pc.name, cx, cy + r * 2)
      ctx.fillText(pc.name, cx, cy + r * 2)
    }
  }
  ctx.restore()
}

function drawDrawing(ctx: Ctx, d: Drawing, X: (p: Pt) => number, Y: (p: Pt) => number, r: number) {
  ctx.strokeStyle = DRAW_COLOR
  ctx.fillStyle = DRAW_COLOR
  if (d.kind === 'zone' && d.pts.length >= 2) {
    const [a, b] = d.pts
    const cx = (X(a) + X(b)) / 2, cy = (Y(a) + Y(b)) / 2
    const rx = Math.abs(X(b) - X(a)) / 2, ry = Math.abs(Y(b) - Y(a)) / 2
    ctx.save()
    ctx.globalAlpha *= 0.22
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(rx, 2), Math.max(ry, 2), 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.setLineDash([r * 0.5, r * 0.35])
    ctx.lineWidth = r * 0.2
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(rx, 2), Math.max(ry, 2), 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    return
  }
  if (d.kind === 'arrow' && d.pts.length >= 2) {
    const ps = d.pts.map(p => [X(p), Y(p)] as const)
    ctx.lineWidth = r * 0.34
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(ps[0][0], ps[0][1])
    for (let i = 1; i < ps.length - 1; i++) {
      const mx = (ps[i][0] + ps[i + 1][0]) / 2, my = (ps[i][1] + ps[i + 1][1]) / 2
      ctx.quadraticCurveTo(ps[i][0], ps[i][1], mx, my)
    }
    const end = ps[ps.length - 1]
    ctx.lineTo(end[0], end[1])
    ctx.stroke()
    // 矢じり：最後の区間の向きに合わせる
    const back = ps[Math.max(0, ps.length - 4)]
    const ang = Math.atan2(end[1] - back[1], end[0] - back[0])
    const s = r * 1.1
    ctx.beginPath()
    ctx.moveTo(end[0] + Math.cos(ang) * s * 0.4, end[1] + Math.sin(ang) * s * 0.4)
    ctx.lineTo(end[0] + Math.cos(ang + 2.5) * s, end[1] + Math.sin(ang + 2.5) * s)
    ctx.lineTo(end[0] + Math.cos(ang - 2.5) * s, end[1] + Math.sin(ang - 2.5) * s)
    ctx.closePath()
    ctx.fill()
  }
}
