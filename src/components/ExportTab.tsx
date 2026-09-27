import { useRef, useState } from 'react'
import { clipLength, exportReplay } from '../render'
import { IconSaveVideo, IconVideo } from './icons'
import { Button, Card, FilePicker, fmt, ScreenTitle, Slider, Toast, useObjectUrl, type ProjectProps } from './ui'

export default function ExportTab({ project: p, setProject, file, addFile }: ProjectProps & { file: File | null; addFile: (f: FileList) => void }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ p: 0, label: '' })
  const [error, setError] = useState('')
  const [result, setResult] = useState<File | null>(null)
  const [toast, setToast] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const resultUrl = useObjectUrl(result)
  const len = clipLength(p)

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    const ac = new AbortController()
    abortRef.current = ac
    const lock = await navigator.wakeLock?.request('screen').catch(() => null)
    try {
      setResult(await exportReplay({ project: p, file, signal: ac.signal, onProgress: (v, label) => setProgress({ p: v, label }) }))
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : String(e))
    } finally {
      await lock?.release()
      setBusy(false)
    }
  }

  // Webアプリは写真ライブラリへ直接書けないため、共有シートの「ビデオを保存」を経由する
  async function save() {
    if (!result) return
    if (navigator.canShare?.({ files: [result] })) {
      try {
        await navigator.share({ files: [result] })
        setToast('保存しました')
        setTimeout(() => setToast(''), 1800)
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setError('保存できませんでした。もう一度お試しください')
      }
    } else {
      const a = document.createElement('a')
      a.href = resultUrl!
      a.download = result.name
      a.click()
    }
  }

  return (
    <div className="space-y-5">
      <Toast text={toast} />
      <ScreenTitle step="04" en="EXPORT" title="書き出す" sub="縦長（9:16）の動画にして、写真に保存します" />

      <div className="grid grid-cols-3 gap-3">
        {[['LENGTH', fmt(len)], ['◆', String(p.keyframes.length)], ['SIZE', '1080×1920']].map(([k, v]) => (
          <Card key={k} className="!p-3 text-center">
            <p className="text-[10px] font-black tracking-widest text-muted">{k}</p>
            <p className="mt-1 font-black tabular-nums">{v}</p>
          </Card>
        ))}
      </div>

      <Card>
        <Slider label="試合の音" value={p.gameVolume} display={`${Math.round(p.gameVolume * 100)}%`} min={0} max={1} step={0.05}
          onChange={v => setProject(q => ({ ...q, gameVolume: v }))} />
      </Card>

      {!file && p.source && (
        <Card className="text-center space-y-3">
          <p className="text-sm text-muted">動画「{p.source.name}」をもう一度選んでください</p>
          <FilePicker multiple={false} onFiles={addFile} className="w-full min-h-12 rounded-xl bg-raised border border-line"><IconVideo />動画を選ぶ</FilePicker>
        </Card>
      )}

      {busy ? (
        <Card className="space-y-3">
          <p className="text-sm font-bold">{progress.label || '準備中'}</p>
          <div className="h-2 rounded-full bg-raised overflow-hidden">
            <div className="h-full bg-[linear-gradient(90deg,#2ef2b4,#1a7cff)] transition-[width]" style={{ width: `${progress.p * 100}%` }} />
          </div>
          <p className="text-xs text-muted">画面を開いたままお待ちください</p>
          <Button className="w-full" onClick={() => abortRef.current?.abort()}>中止</Button>
        </Card>
      ) : (
        <Button variant="primary" className="w-full" disabled={!file || len <= 0} onClick={run}>書き出す</Button>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {result && resultUrl && (
        <Card className="space-y-3">
          <video src={resultUrl} controls playsInline className="mx-auto max-h-[60vh] rounded-xl bg-black" />
          <Button variant="primary" className="w-full" onClick={save}><IconSaveVideo />写真に保存</Button>
        </Card>
      )}
    </div>
  )
}
