# Minecraft Web

Three.js で作ったブラウザ版の 3D ブロックゲームです。
`index.html` だけで動く構成で、GitHub Pages で公開しています。

公開URL:
https://nanasisan12345-ops.github.io/minecraft-web/

## 操作

| 操作 | キー |
|---|---|
| 移動 | `W` / `A` / `S` / `D` |
| ダッシュ | `Shift` |
| ジャンプ | `Space` |
| 視点操作 | マウス |
| ブロック破壊 | 左クリック |
| ブロック設置 | 右クリック |
| ブロック選択 | `1` から `9` / マウスホイール |
| 一時停止 | `Esc` |

最初に画面をクリックするとゲームが開始します。

## 音楽会場モード

`R/T/Y/U` で、プレイヤーの足元付近に音楽会場を出現させます。
同じキーをもう一度押すと、その会場を消せます。

| キー | 会場 | 音楽の方向性 | 見た目の方向性 |
|---|---|---|---|
| `R` | `WAREHOUSE RAVE` | ダークテクノ。サチュレーションの効いた重いキック、オフビートでうねるサブベース、暗いスタブ、深いリバーブ | 暗い倉庫、トラス、スピーカー、青紫系ライト |
| `T` | `EUROBEAT ROAD` | ユーロビート。速いBPM、16分のオクターブ走りベース、きらびやかなスーパーソウのリード（ディレイ） | 道路ステージ、赤黄ネオン、ゲート状ライト |
| `Y` | `TRANCE DOME` | アップリフティングトランス。オフビートのゲートベース、巨大なスーパーソウのパッド、アルペジオ（リバーブ＋ディレイ深め） | 半透明ドーム、同心円リング、青紫のクリスタル |
| `U` | `DANCE FLOOR` | ディスコハウス。ファンキーなシンコペーションベース、7thコードのスタブ、スラップディレイ | 白黒チェック床、ミラーボール、金色の柱 |

音は外部音源ファイルではなく、Web Audio API のシンセでリアルタイム生成しています。
著作権付き楽曲は入れていません。

各会場は、コンプレッサー／コンボリューションリバーブ／テンポ同期ディレイの FX バスと、
キックに合わせたサイドチェイン（ポンプ感）を共通で持ち、ジャンルごとに BPM・リズム・
ベース音色・コード進行・リード／パッドを丸ごと変えて差別化しています。

## 技術メモ

- メイン実装は `index.html` のみです。
- 3D 描画は Three.js を CDN から読み込んでいます。
- 地形はプレイヤー周辺を動的生成する方式です。
- ブロック表示は種類ごとに `InstancedMesh` を使っています。
- ブロック破壊/設置はレイキャストで判定しています。
- RAVE/音楽会場関連の主な実装は `RAVE`、`RAVE_VENUES`、`RAVE_FX`、`buildRaveVenue()`、`raveToggle()`（FXバス構築）、`raveUpdate()` 周辺です。
- 音楽は `scheduleStep()` がジャンル別の `stepTechno()` / `stepEurobeat()` / `stepTrance()` / `stepDisco()` に振り分けます。コード進行は `PROG`、リードは `EUMEL` などにあります。
- 音源（シンセ）は `vKick` / `vBass` / `vSuper`（スーパーソウ）/ `vStab` / `vChord` / `vClap` / `vSnare` / `vHat` など。FX 関連は `makeReverbIR` / `makeShaper` / `sendTo` / `duckTrigger`（サイドチェイン）です。

## 引き継ぎメモ

- 現在のブランチは `main`、公開先は GitHub Pages です。
- 変更後は `index.html` を構文チェックしてから push してください。
- 文字化けしやすいので、README や表示文言を編集するときは UTF-8 として扱ってください。
- 未追跡フォルダ `gikopoi2/` と `hallucinate/` はこのプロジェクトの変更としては触らないでください。
- 会場を増やす場合は、キー割り当て、`RAVE_VENUES`、`RAVE_FX`、`step***()` シーケンサー、会場生成ロジックをセットで更新してください。
- 音楽ジャンルを増やす場合は、既存曲の微変更ではなく、BPM、リズム、ベース音色、リード/パッド、コード進行、会場の形をまとめて変えると差が出ます。

## 確認コマンド

PowerShell で以下を実行すると、`index.html` 内の module script の構文だけを確認できます。

```powershell
@'
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) throw new Error('module script not found');
let code = m[1].replace(/import \* as THREE from 'three';/, 'const THREE = {};');
new Function(code);
console.log('module syntax ok');
'@ | node -
```

ローカルで確認する場合:

```powershell
python -m http.server 8123 --bind 127.0.0.1
```

その後、ブラウザで `http://127.0.0.1:8123/` を開きます。
