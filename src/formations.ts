import type { Mode, Piece, Pt, RosterPlayer } from './types'

// 味方（home）は下側、相手（away）は上側。[x, y, 背番号]
const HOME: Record<Mode, [number, number, string][]> = {
  3: [[0.3, 0.76, '1'], [0.7, 0.76, '2'], [0.5, 0.62, '3']],
  5: [[0.5, 0.94, '1'], [0.3, 0.8, '2'], [0.7, 0.8, '3'], [0.5, 0.68, '4'], [0.5, 0.57, '5']],
  8: [[0.5, 0.94, '1'], [0.22, 0.81, '2'], [0.5, 0.83, '3'], [0.78, 0.81, '4'], [0.2, 0.67, '5'], [0.5, 0.69, '6'], [0.8, 0.67, '7'], [0.5, 0.57, '8']],
  11: [[0.5, 0.95, '1'], [0.13, 0.82, '2'], [0.38, 0.85, '3'], [0.62, 0.85, '4'], [0.87, 0.82, '5'], [0.13, 0.68, '6'], [0.38, 0.7, '7'], [0.62, 0.7, '8'], [0.87, 0.68, '9'], [0.38, 0.57, '10'], [0.62, 0.57, '11']],
}

export function makePieces(mode: Mode, roster: RosterPlayer[]) {
  const pieces: Piece[] = []
  const base: Record<string, Pt> = {}
  HOME[mode].forEach(([x, y, n], i) => {
    const r = roster[i]
    const id = `h${i}`
    pieces.push({ id, team: 'home', number: r?.number || n, name: r?.name || '' })
    base[id] = [x, y]
  })
  HOME[mode].forEach(([x, y, n], i) => {
    const id = `a${i}`
    pieces.push({ id, team: 'away', number: n, name: '' })
    base[id] = [1 - x, 1 - y]
  })
  pieces.push({ id: 'ball', team: 'ball', number: '', name: '' })
  base.ball = [0.5, 0.5]
  return { pieces, base }
}
