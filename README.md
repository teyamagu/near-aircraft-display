# 近隣航空機ディスプレイ

ブラウザの位置情報から、近くを飛んでいる航空機を LED 風の画面に表示します。

公開ページ: https://teyamagu.github.io/near-aircraft-display

## 開発

```bash
npm install
npm run dev
```

開発中の API は Vite のプロキシ（`/upstream`）を通ります。本番ビルドは Cloudflare Worker を使います。

```bash
npm test
npm run check
npm run build
```

`npm run check` はテストと、依存パッケージのライセンス確認です。

## データの出どころ

| 用途 | 取得先 |
| --- | --- |
| 航空機の位置 | [adsb.lol](https://adsb.lol)、失敗時は [adsb.fi](https://adsb.fi) |
| 航空会社、路線、機種 | [adsbdb](https://www.adsbdb.com/) |
| 地図 | Esri World Dark Gray（© Esri、OpenStreetMap 貢献者） |
| 航空会社ロゴ | 実行時に pics.avs.io から取得 |

位置情報は端末内で使い、機体を検索するときだけ緯度経度（小数 4 桁）を Worker に送ります。出発定刻はこの系統の API に無いので、到着時刻は残距離と対地速度からの推定です。

## 公開のしくみ

- 画面は GitHub Pages（`main` への push でデプロイ）
- API は Cloudflare Worker `near-aircraft-display.teyamagu.workers.dev`
- Worker が中継するのは、検査済みの近隣検索と機体検索だけです。任意の URL は通しません
- ブラウザから読めるオリジンは `https://teyamagu.github.io` と開発用の localhost です

Worker を更新するとき:

```bash
npx wrangler deploy
```

## ライセンス

このリポジトリのコードとドキュメントは [MIT License](LICENSE) です。

次のものは MIT の対象外です。

- [Leaflet](https://leafletjs.com/) は BSD-2-Clause
- [React](https://react.dev/) は MIT
- 画面のドットフォント Silkscreen は [SIL Open Font License 1.1](https://fonts.google.com/specimen/Silkscreen)。ファイルは同梱せず、Google Fonts から読みます
- 地図タイルは各提供者の利用条件に従います。画面下に帰属を出しています
- 航空会社のロゴと名称は各社の商標です。このリポジトリには画像を含めていません

配布する依存は、MIT と組み合わせられる寛容ライセンスだけです。地図は Leaflet（BSD-2-Clause）を直接使っています。GPL や Hippocratic License のライブラリは使いません。

ビルドに使う Vite は、CSS の変換に lightningcss（MPL-2.0）を呼びます。これは開発時の道具で、公開するサイトには含まれません。`npm run check` が、配布する依存にこれ以外のライセンスが混ざっていないかを確認します。
