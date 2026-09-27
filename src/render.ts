import {
  ALL_FORMATS, AudioBufferSource, AudioSampleSink, BlobSource, BufferTarget, CanvasSink, CanvasSource,
  Input, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio, canEncodeVideo,
} from 'mediabunny'
import { activeKf, drawBoard, positionsAt, trailsAt } from './board'
import type { Project } from './types'

export const OUT_W = 1080
export const OUT_H = 1920
export const FPS = 30
const SAMPLE_RATE = 48000
const FONT = '-apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif'
const ACC = '#ff8a1f'

// 縦長の画面の割り付け
const HEAD_H = 190
const VIDEO = { x: 0, y: HEAD_H, w: OUT_W, h: Math.round((OUT_W * 9) / 16) }
const BOARD = { x: 36, y: HEAD_H + VIDEO.h + 30, w: OUT_W - 72, h: OUT_H - (HEAD_H + VIDEO.h + 30) - 100 }

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

let aacReady: Promise<void> | null = null
// Safari が AAC を書き出せない場合だけ WASM 版エンコーダを読み込む
export function ensureAac() {
  aacReady ??= (async () => {
    if (await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SAMPLE_RATE })) return
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder')
    registerAacEncoder()
  })()
  return aacReady
}

export const clipLength = (p: Project) => Math.max(0, p.clipEnd - p.clipStart)

// 動画の上に出す説明（その◆から次の◆の手前まで）
export function captionAt(p: Project, t: number) {
  return activeKf(p.keyframes, t)?.caption.trim() ?? ''
}

// 1コマ分の縦長画面を描く。frame は動画のコマ（無ければ黒）
export function drawFrame(ctx: Ctx, p: Project, frame: CanvasImageSource | null, fw: number, fh: number, t: number) {
  ctx.fillStyle = '#05070d'
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  // 見出し
  const g = ctx.createLinearGradient(0, 0, OUT_W, 0)
  g.addColorStop(0, '#0a1226')
  g.addColorStop(1, '#161022')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, OUT_W, HEAD_H)
  ctx.fillStyle = ACC
  ctx.fillRect(0, HEAD_H - 5, OUT_W, 5)
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = `italic 900 58px ${FONT}`
  ctx.fillText(p.title || '振り返り', 48, HEAD_H / 2, OUT_W - 420)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(234,240,255,0.7)'
  ctx.font = `700 34px ${FONT}`
  ctx.fillText(p.date.replaceAll('-', '.'), OUT_W - 48, HEAD_H / 2 - 24)
  if (p.opponent) ctx.fillText(`VS ${p.opponent}`, OUT_W - 48, HEAD_H / 2 + 24, 380)
  ctx.textAlign = 'left'

  // 試合動画（枠いっぱいに、はみ出す分は切る）
  ctx.fillStyle = '#000'
  ctx.fillRect(VIDEO.x, VIDEO.y, VIDEO.w, VIDEO.h)
  if (frame) {
    const k = Math.max(VIDEO.w / fw, VIDEO.h / fh)
    const sw = VIDEO.w / k, sh = VIDEO.h / k
    ctx.drawImage(frame, (fw - sw) / 2, (fh - sh) / 2, sw, sh, VIDEO.x, VIDEO.y, VIDEO.w, VIDEO.h)
  }
  const cap = captionAt(p, t)
  if (cap) {
    ctx.font = `800 40px ${FONT}`
    const w = Math.min(ctx.measureText(cap).width, OUT_W - 160) + 60
    const x = 30, y = VIDEO.y + VIDEO.h - 96
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.beginPath()
    ctx.roundRect(x, y, w, 70, 12)
    ctx.fill()
    ctx.fillStyle = ACC
    ctx.fillRect(x, y, 9, 70)
    ctx.fillStyle = '#fff'
    ctx.fillText(cap, x + 36, y + 37, OUT_W - 160)
  }

  // 作戦ボード
  const k = activeKf(p.keyframes, t)
  drawBoard(ctx, BOARD.x, BOARD.y, BOARD.w, BOARD.h, {
    pieces: p.pieces,
    pos: positionsAt(p.keyframes, p.base, t),
    drawings: k?.drawings ?? [],
    drawAlpha: k ? Math.min(1, (t - k.t) / 0.25 + 0.001) : 1,
    trails: trailsAt(p.keyframes, p.base, t),
    showNames: p.showNames,
    showAway: p.showAway,
  })
  ctx.fillStyle = 'rgba(140,152,179,0.8)'
  ctx.font = `700 28px ${FONT}`
  ctx.fillText('REPLAY BOARD', 48, OUT_H - 50)
}

type ExportOpts = { project: Project; file: File; onProgress: (p: number, label: string) => void; signal: AbortSignal }

export async function exportReplay({ project, file, onProgress, signal }: ExportOpts): Promise<File> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  try {
    if (!(await canEncodeVideo('avc', { width: OUT_W, height: OUT_H })))
      throw new Error('この端末のブラウザは動画の書き出し（H.264）に対応していません。iOSを最新にしてお試しください')
    await ensureAac()
    const vTrack = await input.getPrimaryVideoTrack()
    if (!vTrack) throw new Error('映像トラックがありません')
    if (!(await vTrack.canDecode()))
      throw new Error('この端末のブラウザでは、この動画の形式を読み込めません。iOSを最新にするか、iPhoneの「設定」→「カメラ」→「フォーマット」を「互換性優先」にして撮った動画でお試しください')

    const dur = clipLength(project)
    const total = Math.round(dur * FPS)
    onProgress(0, '音声を準備中')
    const audio = await renderAudio(input, project)

    const canvas = new OffscreenCanvas(OUT_W, OUT_H)
    const ctx = canvas.getContext('2d')!
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
    const video = new CanvasSource(canvas, { codec: 'avc', bitrate: QUALITY_HIGH })
    output.addVideoTrack(video, { frameRate: FPS })
    const audioSrc = new AudioBufferSource({ codec: 'aac', bitrate: QUALITY_HIGH })
    output.addAudioTrack(audioSrc)
    await output.start()

    // 4K でも上の枠（1080px幅）に足りる大きさで取り出す
    const dw = await vTrack.getDisplayWidth(), dh = await vTrack.getDisplayHeight()
    const k0 = Math.min(1, 1600 / Math.max(dw, dh))
    const fw = Math.round(dw * k0), fh = Math.round(dh * k0)
    const sink = new CanvasSink(vTrack, { poolSize: 2, width: fw, height: fh, fit: 'fill' })
    const times = Array.from({ length: total }, (_, i) => project.clipStart + i / FPS)
    let i = 0
    for await (const wc of sink.canvasesAtTimestamps(times)) {
      if (signal.aborted) throw new DOMException('中止しました', 'AbortError')
      drawFrame(ctx, project, wc?.canvas ?? null, fw, fh, i / FPS)
      await video.add(i / FPS, 1 / FPS)
      i++
      if (i % 10 === 0) onProgress(i / total, `書き出し中 ${Math.round((i / total) * 100)}%`)
    }
    onProgress(1, '仕上げ中')
    await audioSrc.add(audio)
    await output.finalize()
    const buf = (output.target as BufferTarget).buffer!
    const name = `${project.date}_${project.opponent || 'replay'}.mp4`.replace(/[\\/:*?"<>|\s]/g, '_')
    return new File([buf], name, { type: 'video/mp4' })
  } finally {
    input.dispose()
  }
}

async function renderAudio(input: Input, p: Project) {
  const dur = clipLength(p)
  const ac = new OfflineAudioContext(2, Math.max(1, Math.ceil(dur * SAMPLE_RATE)), SAMPLE_RATE)
  const track = await input.getPrimaryAudioTrack()
  if (track) {
    const sr = await track.getSampleRate()
    const buf = ac.createBuffer(2, Math.max(1, Math.ceil(dur * sr)), sr)
    const L = buf.getChannelData(0), R = buf.getChannelData(1)
    const sink = new AudioSampleSink(track)
    for await (const s of sink.samples(p.clipStart, p.clipEnd)) {
      const b = s.toAudioBuffer()
      const off = Math.round((s.timestamp - p.clipStart) * sr)
      const l = b.getChannelData(0), r = b.numberOfChannels > 1 ? b.getChannelData(1) : l
      for (let j = 0; j < l.length; j++) {
        const k = off + j
        if (k >= 0 && k < L.length) { L[k] = l[j]; R[k] = r[j] }
      }
      s.close()
    }
    const node = ac.createBufferSource()
    node.buffer = buf
    const g = ac.createGain()
    g.gain.setValueAtTime(0, 0)
    g.gain.linearRampToValueAtTime(p.gameVolume, 0.15)
    g.gain.setValueAtTime(p.gameVolume, Math.max(0.15, dur - 0.3))
    g.gain.linearRampToValueAtTime(0, dur)
    node.connect(g).connect(ac.destination)
    node.start(0)
  }
  return ac.startRendering()
}
