import { useEffect, useState } from 'react'
import { makePieces } from './formations'
import type { Mode, Project, RosterPlayer } from './types'

const KEY = 'replay:project'

// 同じ github.io の GOLAZO / MATCHCUT で登録した選手名簿を借りる
export function readRoster(): RosterPlayer[] {
  for (const k of ['golazo:roster', 'matchcut-ai:roster', 'matchcut:roster']) {
    try {
      const r = JSON.parse(localStorage.getItem(k) ?? 'null')
      if (r?.players?.length) return r.players.map((p: RosterPlayer) => ({ number: p.number ?? '', name: p.name ?? '' }))
    } catch { /* 壊れていれば次へ */ }
  }
  return []
}

export function freshPieces(mode: Mode) {
  return makePieces(mode, readRoster())
}

export const emptyProject = (): Project => {
  const { pieces, base } = freshPieces(8)
  return {
    title: '',
    date: new Date().toISOString().slice(0, 10),
    opponent: '',
    source: null,
    clipStart: 0,
    clipEnd: 0,
    mode: 8,
    pieces,
    base,
    showAway: true,
    view: 'full',
    showNames: true,
    keyframes: [],
    gameVolume: 0.9,
  }
}

export function useProject() {
  const [project, setProject] = useState<Project>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return { ...emptyProject(), ...JSON.parse(raw) }
    } catch { /* 破損時は新規 */ }
    return emptyProject()
  })
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(project)) } catch { /* 容量超過などは無視 */ }
  }, [project])
  return [project, setProject] as const
}
