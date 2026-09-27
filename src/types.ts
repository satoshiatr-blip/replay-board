export type Team = 'home' | 'away' | 'ball'

// ボード上のコマ。位置は持たず、位置は「瞬間（◆）」ごとに持つ
export type Piece = { id: string; team: Team; number: string; name: string }

// ピッチ上の位置（0〜1）。x は左→右、y は相手ゴール側（上）→自陣ゴール側（下）
export type Pt = [number, number]

export type Drawing = { id: string; kind: 'arrow' | 'zone'; pts: Pt[] }

// 記録した瞬間。t はシーン（切り出し範囲）の先頭からの秒
export type Keyframe = { id: string; t: number; pos: Record<string, Pt>; caption: string; drawings: Drawing[] }

export type SourceMeta = { key: string; name: string; size: number; duration: number }

export type Mode = 3 | 5 | 8 | 11

export type Project = {
  title: string
  date: string
  opponent: string
  source: SourceMeta | null
  clipStart: number
  clipEnd: number
  mode: Mode
  pieces: Piece[]
  // ◆をまだ記録していないときの位置（人数を選んだときの初期配置）
  base: Record<string, Pt>
  showAway: boolean
  showNames: boolean
  keyframes: Keyframe[]
  gameVolume: number
}

export type RosterPlayer = { number: string; name: string }

export const sourceKey = (f: File) => `${f.name}:${f.size}`
export const uid = () => Math.random().toString(36).slice(2, 10)
