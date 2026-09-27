# REPLAY BOARD

試合動画のワンシーンの下に作戦ボードを並べ、動きに合わせてコマを動かして、縦長（9:16）の動画に書き出すPWA。
時点ごとに◆を記録すると、◆のあいだはコマがなめらかに動く。◆ごとに説明（動画の左下に出る）と矢印・範囲を付けられる。
読み込み・書き出しはすべて端末内で行い、外部へは送信しない。

- 技術: Vite + React + TypeScript + Tailwind CSS、[mediabunny](https://github.com/Vanilagy/mediabunny)（WebCodecs）
- 人数: 3 / 5 / 8 / 11人制（既定は8人制）。選手名簿は同じサイトの GOLAZO / MATCHCUT で登録したものを借りる

## 開発

```bash
npm install
npm run dev -- --mode pc   # PCのブラウザで確認（http://localhost:5189）
npm run dev                # iPhone実機でLAN越しに確認（https、port 5188）
npx tsc -b                 # 型チェック
npm run build
```
