import { useState } from 'react'
import { clipLength } from '../render'
import VideoFrame from './VideoFrame'
import { IconVideo } from './icons'
import { Button, Card, Field, FilePicker, fmt, inputCls, ScreenTitle, type ProjectProps } from './ui'

const MAX_CLIP = 30

export default function VideoTab({ project: p, setProject, file, addFile, next }:
  ProjectProps & { file: File | null; addFile: (f: FileList) => void; next: () => void }) {
  const dur = p.source?.duration ?? 0
  const [t, setT] = useState(p.clipStart)
  const len = clipLength(p)

  // 場面の長さが変わったら、はみ出した◆は外す
  const setClip = (s: number, e: number) =>
    setProject(q => ({ ...q, clipStart: s, clipEnd: e, keyframes: q.keyframes.filter(k => k.t <= e - s + 0.001) }))
  const setStart = (s: number) => setClip(s, Math.min(dur, s + MAX_CLIP, Math.max(p.clipEnd, s + 1)))
  const setEnd = (e: number) => setClip(Math.max(0, Math.min(p.clipStart, e - 1), e - MAX_CLIP), e)

  return (
    <div className="space-y-5">
      <ScreenTitle step="01" en="SCENE" title="場面を選ぶ" sub="振り返りたいワンシーンを切り出します（30秒まで）" />

      <Card className="space-y-3">
        <Field label="タイトル">
          <input className={inputCls} maxLength={20} placeholder="例：先制点までの動き" value={p.title} onChange={e => setProject(q => ({ ...q, title: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="日付">
            <input type="date" className={inputCls} value={p.date} onChange={e => setProject(q => ({ ...q, date: e.target.value }))} />
          </Field>
          <Field label="対戦相手">
            <input className={inputCls} maxLength={14} placeholder="例：〇〇SC" value={p.opponent} onChange={e => setProject(q => ({ ...q, opponent: e.target.value }))} />
          </Field>
        </div>
      </Card>

      {!p.source || !file ? (
        <Card className="text-center space-y-3">
          {p.source && <p className="text-sm text-muted">前回の動画「{p.source.name}」をもう一度選んでください</p>}
          <FilePicker multiple={false} onFiles={addFile} className="w-full min-h-14 rounded-xl bg-[linear-gradient(110deg,#2ef2b4,#1a7cff)] text-ink">
            <IconVideo className="text-xl" />試合の動画を選ぶ
          </FilePicker>
        </Card>
      ) : (
        <Card className="space-y-3">
          <VideoFrame file={file} time={t} />
          <div className="relative">
            <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-cyan/35 pointer-events-none"
              style={{ left: `${(p.clipStart / dur) * 100}%`, width: `${(len / dur) * 100}%` }} />
            <input type="range" className="relative w-full h-8" min={0} max={dur} step={0.05} value={t} onChange={e => setT(Number(e.target.value))} />
          </div>
          <p className="text-center text-sm tabular-nums font-bold">{fmt(t)} <span className="text-muted">/ {fmt(dur)}</span></p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setStart(t)} disabled={t >= dur - 0.5}>ここから</Button>
            <Button onClick={() => setEnd(t)} disabled={t <= 0.5}>ここまで</Button>
          </div>
          <p className="text-center text-sm text-muted">
            場面：<span className="text-fg font-bold tabular-nums">{fmt(p.clipStart)} 〜 {fmt(p.clipEnd)}</span>（{len.toFixed(1)}秒）
          </p>
          <FilePicker multiple={false} onFiles={addFile} className="w-full min-h-11 rounded-xl text-sm text-muted">別の動画にする</FilePicker>
        </Card>
      )}

      <Button variant="primary" className="w-full" disabled={!file || len <= 0} onClick={next}>コマを並べる</Button>
    </div>
  )
}
