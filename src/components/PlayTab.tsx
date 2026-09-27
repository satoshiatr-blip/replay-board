import { useEffect, useRef, useState } from 'react'
import { clipLength, drawFrame, OUT_H, OUT_W } from '../render'
import { IconPlay, IconStop } from './icons'
import { Button, Segmented, useObjectUrl, type ProjectProps } from './ui'

const SCALE = 0.5

// 書き出す縦長の動画と同じ絵を、その場で再生して確かめる
export default function PlayTab({ project: p, file }: Pick<ProjectProps, 'project'> & { file: File | null }) {
  const url = useObjectUrl(file)
  const vRef = useRef<HTMLVideoElement>(null)
  const cRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<'1' | '0.5'>('1')
  const len = clipLength(p)

  const paint = () => {
    const v = vRef.current, c = cRef.current
    if (!v || !c) return
    const ctx = c.getContext('2d')!
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    drawFrame(ctx, p, v.videoWidth ? v : null, v.videoWidth || 1, v.videoHeight || 1, Math.max(0, v.currentTime - p.clipStart))
  }

  function stop() {
    cancelAnimationFrame(raf.current)
    vRef.current?.pause()
    setPlaying(false)
  }

  async function play() {
    const v = vRef.current
    if (!v) return
    v.currentTime = p.clipStart
    v.playbackRate = Number(speed)
    setPlaying(true)
    await v.play().catch(() => setPlaying(false))
    const loop = () => {
      paint()
      if (v.currentTime >= p.clipEnd || v.ended) { stop(); v.currentTime = p.clipStart; return }
      raf.current = requestAnimationFrame(loop)
    }
    loop()
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  useEffect(() => { if (!playing) paint() })

  if (!file || len <= 0) return <p className="text-muted text-sm">先に「動画」で場面を選んでください</p>

  return (
    <div className="space-y-4">
      <div className="mx-auto rounded-2xl overflow-hidden border border-line shadow-2xl" style={{ maxWidth: 'min(100%, calc((var(--app-height, 100vh) - 330px) * 9 / 16))' }}>
        <canvas ref={cRef} width={OUT_W * SCALE} height={OUT_H * SCALE} className="block w-full h-auto" />
      </div>
      <video ref={vRef} src={url ?? undefined} playsInline preload="auto" className="absolute w-px h-px opacity-0 pointer-events-none"
        onLoadedData={e => { e.currentTarget.currentTime = p.clipStart }} onSeeked={() => { if (!playing) paint() }} />
      <div className="flex items-center gap-3">
        <Button variant="primary" className="flex-1" onClick={playing ? stop : play}>
          {playing ? <><IconStop />止める</> : <><IconPlay />再生</>}
        </Button>
        <div className="w-40">
          <Segmented value={speed} onChange={setSpeed} options={[{ v: '1', label: '×1' }, { v: '0.5', label: 'スロー' }]} />
        </div>
      </div>
    </div>
  )
}
