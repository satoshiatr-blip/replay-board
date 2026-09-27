import { useRef, useState } from 'react'
import { activeKf, boardAspect, positionsAt, sortKf, trailsAt } from '../board'
import { clipLength, FPS } from '../render'
import { freshPieces, readRoster } from '../store'
import type { Keyframe, Mode, PitchView, Pt } from '../types'
import { uid } from '../types'
import BoardCanvas, { type Tool } from './BoardCanvas'
import VideoFrame from './VideoFrame'
import { IconArrow, IconHand, IconPeople, IconUndo, IconZone } from './icons'
import { Button, fmt, inputCls, Portal, Segmented, Toggle, type ProjectProps } from './ui'

const NEAR = 0.5 / FPS
const snap = (t: number) => Math.round(t * FPS) / FPS

export default function EditTab({ project: p, setProject, file }: ProjectProps & { file: File | null }) {
  const len = clipLength(p)
  const [t, setT] = useState(0)
  const [tool, setTool] = useState<Tool>('move')
  const [editId, setEditId] = useState<string | null>(null)
  const [modeSheet, setModeSheet] = useState(false)
  const undo = useRef<Keyframe[][]>([])
  const [, bump] = useState(0)

  const kfs = sortKf(p.keyframes)
  const cur = kfs.find(k => Math.abs(k.t - t) < NEAR)
  const active = activeKf(p.keyframes, t)
  const pos = positionsAt(p.keyframes, p.base, t)

  const pushUndo = () => { undo.current = [...undo.current.slice(-30), p.keyframes]; bump(n => n + 1) }
  const doUndo = () => {
    const prev = undo.current.pop()
    if (prev) setProject(q => ({ ...q, keyframes: prev }))
    bump(n => n + 1)
  }

  // 今の時点の◆を書き換える（無ければ、今の位置で◆を作る）
  function upsert(f: (k: Keyframe) => Keyframe) {
    const at = snap(t)
    setProject(q => {
      const i = q.keyframes.findIndex(k => Math.abs(k.t - at) < NEAR)
      const k0 = i >= 0 ? q.keyframes[i] : { id: uid(), t: at, pos: { ...positionsAt(q.keyframes, q.base, at) }, caption: '', drawings: [] }
      const k = f(k0)
      return { ...q, keyframes: i >= 0 ? q.keyframes.map((x, j) => (j === i ? k : x)) : [...q.keyframes, k] }
    })
  }
  const moveTo = (id: string, pt: Pt) => upsert(k => ({ ...k, pos: { ...k.pos, [id]: pt } }))

  const seek = (v: number) => setT(snap(Math.min(len, Math.max(0, v))))

  function setMode(m: Mode) {
    if (m !== p.mode && p.keyframes.length && !confirm('人数を変えると、記録した◆はすべて消えます。よろしいですか？')) return
    const { pieces, base } = freshPieces(m)
    setProject(q => ({ ...q, mode: m, pieces, base, keyframes: [] }))
    undo.current = []
    setModeSheet(false)
  }

  if (!p.source || len <= 0) return <p className="text-muted text-sm">先に「動画」で場面を選んでください</p>

  const editing = p.pieces.find(pc => pc.id === editId)

  return (
    <div className="space-y-3">
      <VideoFrame file={file} time={p.clipStart + t} caption={active?.caption} />

      {/* 時間の目盛りと◆ */}
      <div>
        <div className="relative h-5 mx-2">
          {kfs.map(k => (
            <button key={k.id} onClick={() => setT(k.t)} aria-label={`${fmt(k.t)}の◆`}
              className={`absolute top-0 -translate-x-1/2 text-base leading-none ${k === cur ? 'text-accent drop-shadow-[0_0_6px_#ff8a1f]' : 'text-fg/70'}`}
              style={{ left: `${(k.t / len) * 100}%` }}>◆</button>
          ))}
        </div>
        <input type="range" className="w-full h-7" min={0} max={len} step={1 / FPS} value={t} onChange={e => seek(Number(e.target.value))} />
        <div className="flex items-center justify-between gap-2">
          <button className="min-h-10 px-3 rounded-lg bg-raised border border-line text-sm font-bold" onClick={() => seek(t - 1 / FPS)}>−1コマ</button>
          <span className="text-sm font-bold tabular-nums">{fmt(t)} <span className="text-muted">/ {fmt(len)}</span></span>
          <button className="min-h-10 px-3 rounded-lg bg-raised border border-line text-sm font-bold" onClick={() => seek(t + 1 / FPS)}>+1コマ</button>
        </div>
      </div>

      {/* 道具 */}
      <div className="flex gap-1.5">
        {([['move', '動かす', IconHand], ['arrow', '矢印', IconArrow], ['zone', '範囲', IconZone]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTool(id)}
            className={`flex-1 min-h-11 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1 border ${tool === id ? 'bg-accent text-ink border-accent' : 'bg-raised border-line text-fg'}`}>
            <Icon className="text-base" />{label}
          </button>
        ))}
        <button onClick={doUndo} disabled={!undo.current.length} aria-label="戻す"
          className="min-h-11 w-11 rounded-xl bg-raised border border-line grid place-items-center text-lg disabled:opacity-35"><IconUndo /></button>
        <button onClick={() => setModeSheet(true)}
          className="min-h-11 px-2.5 rounded-xl bg-raised border border-line text-[13px] font-bold flex items-center gap-1"><IconPeople className="text-base" />{p.mode}人</button>
      </div>

      <Segmented<PitchView> value={p.view} onChange={v => setProject(q => ({ ...q, view: v }))}
        options={[{ v: 'full', label: 'ピッチ全体' }, { v: 'top', label: '相手陣だけ' }, { v: 'bottom', label: '自陣だけ' }]} />

      <div className="mx-auto" style={{ maxWidth: `max(230px, calc((var(--app-height, 100vh) - 560px) / ${boardAspect(p.view)}))` }}>
        <BoardCanvas tool={tool} pieces={p.pieces} pos={pos} drawings={cur?.drawings ?? active?.drawings ?? []} drawAlpha={cur ? 1 : 0.45}
          trails={cur ? [] : trailsAt(p.keyframes, p.base, t)} showNames={p.showNames} showAway={p.showAway} view={p.view} selectedId={editId}
          onMoveStart={pushUndo} onMove={moveTo}
          onDraw={d => { pushUndo(); upsert(k => ({ ...k, drawings: [...k.drawings, d] })) }}
          onLongPress={id => setEditId(id)} />
      </div>

      {/* 今の◆ */}
      {cur ? (
        <div className="rounded-2xl border border-accent/40 bg-surface p-3 space-y-2.5">
          <p className="text-xs font-bold text-accent">◆ {fmt(cur.t)} の説明（次の◆まで動画の左下に出ます）</p>
          <input className={inputCls} maxLength={30} placeholder="例：ここで裏へ走る" value={cur.caption}
            onChange={e => { const v = e.target.value; upsert(k => ({ ...k, caption: v })) }} />
          <div className="flex gap-2">
            {cur.drawings.length > 0 && (
              <Button className="flex-1 !min-h-10 text-sm" onClick={() => { pushUndo(); upsert(k => ({ ...k, drawings: [] })) }}>線を消す</Button>
            )}
            <Button variant="danger" className="flex-1 !min-h-10 text-sm"
              onClick={() => { pushUndo(); setProject(q => ({ ...q, keyframes: q.keyframes.filter(k => k.id !== cur.id) })) }}>この◆を消す</Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted text-center leading-relaxed">
          コマを動かすか線を描くと、この時点に◆が付きます。<br />コマを長押しすると、名前と背番号を変えられます
        </p>
      )}

      {editing && <PieceSheet key={editing.id} id={editing.id} {...{ project: p, setProject }} onClose={() => setEditId(null)} />}

      {modeSheet && (
        <Sheet onClose={() => setModeSheet(false)} title="人数">
          <div className="grid grid-cols-4 gap-2">
            {([3, 5, 8, 11] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`min-h-14 rounded-xl font-black text-lg border ${p.mode === m ? 'bg-accent text-ink border-accent' : 'bg-raised border-line'}`}>
                {m}<span className="text-xs font-bold">人制</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between min-h-12 mt-3">
            <span className="font-medium">相手チームを出す</span>
            <Toggle label="相手チームを出す" checked={p.showAway} onChange={v => setProject(q => ({ ...q, showAway: v }))} />
          </div>
        </Sheet>
      )}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
        <div className="absolute inset-x-0 bottom-0 max-w-2xl mx-auto rounded-t-3xl bg-surface border-t border-line p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] animate-[sheet_.25s_ease-out]"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black">{title}</h3>
            <button className="min-h-10 px-3 text-accent font-bold" onClick={onClose}>完了</button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  )
}

function PieceSheet({ id, project: p, setProject, onClose }: ProjectProps & { id: string; onClose: () => void }) {
  const pc = p.pieces.find(x => x.id === id)!
  const roster = pc.team === 'home' ? readRoster() : []
  const set = (patch: { number?: string; name?: string }) =>
    setProject(q => ({ ...q, pieces: q.pieces.map(x => (x.id === id ? { ...x, ...patch } : x)) }))
  return (
    <Sheet title={pc.team === 'home' ? '味方のコマ' : '相手のコマ'} onClose={onClose}>
      <div className="grid grid-cols-[5.5rem_1fr] gap-2.5">
        <label className="block">
          <span className="block text-xs text-muted mb-1.5">背番号</span>
          <input className={`${inputCls} text-center font-black`} inputMode="numeric" maxLength={3} value={pc.number} onChange={e => set({ number: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs text-muted mb-1.5">名前</span>
          <input className={inputCls} maxLength={8} placeholder="例：そうま" value={pc.name} onChange={e => set({ name: e.target.value })} />
        </label>
      </div>
      {roster.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted mb-1.5">選手名簿から選ぶ</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {roster.map((r, i) => (
              <button key={i} onClick={() => set({ number: r.number, name: r.name })}
                className={`min-h-9 px-3 rounded-full border text-sm font-bold ${pc.name === r.name && pc.number === r.number ? 'bg-accent text-ink border-accent' : 'bg-raised border-line'}`}>
                {r.number && <span className="opacity-60 mr-1">{r.number}</span>}{r.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between min-h-12 mt-3">
        <span className="font-medium">コマの下に名前を出す</span>
        <Toggle label="名前を出す" checked={p.showNames} onChange={v => setProject(q => ({ ...q, showNames: v }))} />
      </div>
    </Sheet>
  )
}
