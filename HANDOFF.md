# HANDOFF

最終更新: 2026-06-21

## 現在の状態

- 作業ブランチ: `main`
- 主な変更ファイル: `index.html`
- `index.html` は未コミット変更あり
- `gikopoi2/` と `hallucinate/` は未追跡フォルダ。今回の変更対象ではないので触らない
- まだ commit / push はしていない

## 今回追加した内容

### 音楽会場

- `R/T/Y/U/I/O/P` で切り替えられる音楽会場を拡張
- 既存の会場に加えて、以下の会場を追加
  - `FUTURE BASS SKY`
  - `DRUM BASS TUNNEL`
  - `LOFI HOUSE LOUNGE`
- 会場ごとに床形状、装飾、照明、レーザー、DJブース、雰囲気を差別化
- 外周に発光ゲートを追加し、NPCがそこから集まってくる演出を追加

### 音楽

- Web Audio API の生成音で、曲ごとの違いを強化
- 32小節構成の展開を追加
  - イントロ
  - ブレイク
  - ビルドアップ
  - サビ/ドロップ
  - フィル
- 会場ごとに BPM、コード進行、ベース、リード、リズムを変更
- 追加した音色
  - クラッシュシンバル
  - ライド
  - サブドロップ
  - ボイスチョップ風シンセ
  - ワブルベース
  - ビルドアップ用ノイズ/ライザー
- `stepArrangementFx()` で共通の曲展開FXを管理
- `stepFutureBass()` / `stepDrumBass()` / `stepLofiHouse()` などでジャンル別の鳴りを差別化

### NPC

- NPCを棒人間風のまま、服装・髪型・肌色・アクセント色・光る棒などでバリエーション追加
- 踊りの種類を追加
  - shuffle
  - robot
  - wavecircle
  - battle系の動き
- NPC同士のダンスバトル、観客、周回、散歩、列になって動く挙動を追加
- 会場出現時、NPCが外周ゲートから時間差で集まってきて、到着後に踊り出す演出を追加
- 入場中は小走り、シャッフル、横ステップ風に動く
- Chill会場ではゆっくり集まるように調整
- 腕や肘の関節の向きを調整し、不自然な曲がり方を減らした
- ポーズ補間を入れて、踊りの切り替わりを少し滑らかにした

### NPC入場演出の追加調整

- NPCがより遠くから集まってくるように、入場開始位置を会場外周からさらに離した
- NPCごとに入口方向をランダム化し、固定順に見えないようにした
- 出発遅延を広めにランダム化し、一気に集まらず、ぽつぽつ集まってくるようにした
- 入場時間は距離とランダムな移動速度から決めるようにした
- 入場ルートを「遠方 → 外周ゲート → 目的位置」の2段階に変更
- Minecraftブロックの障害物を前方検知し、ぶつかりそうな時はジャンプするようにした
- DJブース、Chill会場のソファ、DNB会場のスピーカーなど、会場内オブジェクトも入場用の障害物として登録
- 障害物検知時のジャンプは、検知した瞬間ごとに自然に発火するように調整

## 確認済み

PowerShell で以下を確認済み。

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

結果:

```text
module syntax ok
```

追加で以下も確認済み。

```powershell
git diff --check -- index.html
```

結果:

```text
問題なし
```

※ `LF will be replaced by CRLF` の警告は表示されるが、構文エラーではない。

## 次にやるなら

- ブラウザで実際に会場を出して、NPC入場、ダンス、音楽展開を目視確認する
- 問題なければ `index.html` と `HANDOFF.md` を commit
- ユーザーが希望したら GitHub に push
