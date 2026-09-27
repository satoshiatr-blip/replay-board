import { useEffect, useRef } from 'react'
import { useObjectUrl } from './ui'

// iPhone は video 要素のままだと止めたコマを描かないことがあるため、シークした絵を canvas に写して見せる
export default function VideoFrame({ file, time, caption }: { file: File | null; time: number; caption?: string }) {
  const url = useObjectUrl(file)
  const vRef = useRef<HTMLVideoElement>(null)
  const cRef = useRef<HTMLCanvasElement>(null)
  const want = useRef(time)
  const busy = useRef(false)

  const draw = () => {
    const v = vRef.current, c = cRef.current
    if (!v || !c || !v.videoWidth) return
    const ctx = c.getContext('2d')!
    // 書き出しと同じく 16:9 の枠いっぱいに合わせ、はみ出しは切る
    const k = Math.max(c.width / v.videoWidth, c.height / v.videoHeight)
    const sw = c.width / k, sh = c.height / k
    ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, c.width, c.height)
  }
  // 早送り中に何度も位置を変えられても、前のシークが終わってから最新の位置へ一度だけ飛ぶ
  const kick = () => {
    const v = vRef.current
    if (!v || busy.current || v.readyState < 1) return
    if (Math.abs(v.currentTime - want.current) < 0.001) { draw(); return }
    busy.current = true
    v.currentTime = want.current
  }
  useEffect(() => { want.current = time; kick() }, [time])

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
      <canvas ref={cRef} width={960} height={540} className="absolute inset-0 w-full h-full" />
      {url && (
        <video ref={vRef} src={url} playsInline muted preload="auto" className="absolute w-px h-px opacity-0 pointer-events-none"
          onLoadedData={() => { busy.current = false; kick() }}
          onSeeked={() => { busy.current = false; draw(); if (Math.abs((vRef.current?.currentTime ?? 0) - want.current) > 0.001) kick() }} />
      )}
      {!file && <p className="absolute inset-0 grid place-items-center text-sm text-muted">動画を選んでください</p>}
      {caption && (
        <p className="absolute left-2.5 bottom-2.5 max-w-[85%] truncate rounded-md bg-black/70 border-l-[3px] border-accent pl-2.5 pr-3 py-1 text-[13px] font-extrabold">{caption}</p>
      )}
    </div>
  )
}
