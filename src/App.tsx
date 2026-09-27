import { useState } from 'react'
import { useProject } from './store'
import { sourceKey } from './types'
import VideoTab from './components/VideoTab'
import EditTab from './components/EditTab'
import PlayTab from './components/PlayTab'
import ExportTab from './components/ExportTab'
import { IconBoard, IconExport, IconPlay, IconVideo } from './components/icons'
import { Logo, Wordmark } from './components/brand'
import { Toast } from './components/ui'

type Tab = 'video' | 'edit' | 'play' | 'export'
const TABS = [
  { id: 'video', label: '動画', Icon: IconVideo },
  { id: 'edit', label: '配置', Icon: IconBoard },
  { id: 'play', label: '再生', Icon: IconPlay },
  { id: 'export', label: '書き出し', Icon: IconExport },
] as const

// 動画の長さ。大きな4K動画では video 要素が読み込みを終えないことがあるので、時間で打ち切り、読み込み部品で測り直す
function readDuration(f: File) {
  return new Promise<number>(resolve => {
    const v = document.createElement('video')
    const done = (d: number) => { resolve(d); URL.revokeObjectURL(v.src) }
    v.preload = 'metadata'
    v.onloadedmetadata = () => done(v.duration)
    v.onerror = () => done(0)
    setTimeout(() => done(0), 10000)
    v.src = URL.createObjectURL(f)
  }).then(d => (d > 0 && Number.isFinite(d) ? d : durationFromFile(f)))
}

async function durationFromFile(f: File) {
  try {
    const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny')
    const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS })
    try { return await input.computeDuration() } finally { input.dispose() }
  } catch { return 0 }
}

const baseName = (n: string) => n.replace(/\.[^.]+$/, '').toLowerCase()

export default function App() {
  const [project, setProject] = useProject()
  const [file, setFile] = useState<File | null>(null)
  const [tab, setTab] = useState<Tab>('video')
  const [loading, setLoading] = useState('')

  async function addFile(list: FileList) {
    const f = list[0]
    setLoading('動画を読み込んでいます…')
    try {
      const duration = await readDuration(f)
      const src = project.source
      // 選び直しで iPhone が名前やサイズを変えて渡してくることがあるので、名前（拡張子を除く）か長さで前の動画と見なす
      const same = src && (src.key === sourceKey(f) || baseName(src.name) === baseName(f.name) || (duration > 0 && Math.abs(src.duration - duration) < 0.6))
      if (!same && src && project.keyframes.length && !confirm('別の動画にすると、記録した◆はすべて消えます。よろしいですか？')) return
      setFile(f)
      if (same) return
      setProject(p => ({
        ...p,
        source: { key: sourceKey(f), name: f.name, size: f.size, duration },
        clipStart: 0,
        clipEnd: Math.min(10, duration),
        keyframes: [],
      }))
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="bg-ink text-fg flex flex-col overflow-hidden" style={{ position: 'fixed', inset: 0 }}>
      <Toast text={loading} />
      <header className="shrink-0 bg-ink/85 backdrop-blur-xl border-b border-line px-5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Logo size={38} />
          <div className="min-w-0">
            <h1 className="text-lg"><Wordmark /></h1>
            <p className="text-xs text-muted truncate">{project.title ? `${project.title}${project.opponent ? `  VS ${project.opponent}` : ''}` : '試合の動きを、作戦ボードで振り返る'}</p>
          </div>
        </div>
      </header>

      <main key={tab} className="rise flex-1 min-h-0 overflow-y-auto max-w-2xl w-full mx-auto px-5 pt-4 pb-5">
        {tab === 'video' && <VideoTab project={project} setProject={setProject} file={file} addFile={addFile} next={() => setTab('edit')} />}
        {tab === 'edit' && <EditTab project={project} setProject={setProject} file={file} />}
        {tab === 'play' && <PlayTab project={project} file={file} />}
        {tab === 'export' && <ExportTab project={project} setProject={setProject} file={file} addFile={addFile} />}
      </main>

      <nav className="shrink-0 bg-surface/90 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {TABS.map(({ id, label, Icon }, i) => {
            const active = tab === id
            return (
              <button key={id} onClick={() => setTab(id)} className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 transition ${active ? 'text-cyan' : 'text-muted'}`}>
                {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-cyan shadow-[0_0_10px_#2ef2b4]" />}
                <span className="relative text-2xl">
                  <Icon />
                  {id === 'edit' && project.keyframes.length > 0 && (
                    <span className="absolute -top-1.5 -right-3 min-w-5 h-5 px-1 rounded-full bg-cyan text-ink text-[11px] font-bold grid place-items-center">{project.keyframes.length}</span>
                  )}
                </span>
                <span className="text-[10.5px] font-bold whitespace-nowrap tracking-tight"><span className="opacity-50 mr-0.5">0{i + 1}</span>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
