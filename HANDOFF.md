# HANDOFF

最終更新: 2026-06-30

---

## 2026-06-30 追記: 日本ランドマークを参照画像と見比べて作り直し（第1弾）

- ユーザー指示「今まで作った構造物を、Minecraftの作例を画像検索で見比べながら作り直す。必要なら新ブロックも追加してよい」を受け、まず日本ランドマークを再構築。音楽会場系は触っていない。
- **構造物監査ハーネスを再構築し、今度は追跡対象に保存**（前回分は `.tmp` 内で消えていた）: **`scripts/structure-audit.mjs`**（コミット済み）。`32-world-window.js` から `function` 宣言を抽出し（`heightAt` だけ実行時依存なのでスタブに差し替え）、`put()` で集めたブロックを **front/iso の PNG に描画**（依存ゼロ・Node標準のzlibで自前PNGエンコード）。使い方: `node scripts/structure-audit.mjs . <name>` → `.tmp/structure-audit/<name>-front.png` / `-iso.png`（出力先 `.tmp/` は gitignore 済み）。新ブロックを足したら `NAMES`/`COLOR` に追記、新ランドマークは `PLANS` に追記する。
- 参照画像は **YouTube作例のサムネ**（`https://img.youtube.com/vi/<id>/maxresdefault.jpg`）を PowerShell の `Invoke-WebRequest` で取得して `Read` で閲覧（Bash の curl はサンドボックスでSSL不可、PowerShellは通る）。
- **新ブロック追加**: 青銅 `BRONZE=33`（落ち着いた緑青、大仏の像体）／青銅(陰) `BRONZE_DARK=34`（面相・衣の襞）。`20-textures.js` / `22-block-types.js` / `render.mjs` に追加。
- `src/game/parts/32-world-window.js` の修正:
  - **鳥居**: 笠木を濃色で大きく張り出し、両端を2段反り上げ、二重梁（貫＋島木）＋額束＋吊り灯籠＋石の根巻。柱高8。サイズを `[15,3]`（±7）へ拡大。
  - **五重塔**: 屋根を黒瓦→**緑青の銅瓦(COPPER_ROOF)**、胴体を高く(bodyH=4)して各層の朱壁・窓・縁側(欄干)を見せる。下層を一回り大きく `halfs=[5,4,3,2,2]`。サイズ `[15,15]`・クリア高さ `base+34`。
  - **天守閣**: 白壁の高さを bodyH=3→**5**にして各層の白漆喰壁・窓・黒連子・縁側欄干を見せる（緑屋根に埋もれていたのを解消）。クリア高さ `base+24`。
  - **大仏**: 緑→**青銅**化、大きな金光背を撤去。正面シルエットを「半幅プロファイル×奥行き」で中身を詰めて造形（先細りの塔→座像へ）。大きな丸頭・伏し目・白毫・鼻・口、長い耳たぶ、張った肩、腰のくびれ、椀状の定印の手、二段の蓮華座。`addDaibutsu`(旧・小型)は未使用のまま残置、使用中は `addGiantDaibutsu`。
  - **水上鳥居**: 上記の鳥居改善が反映。サイズ `[15,11]`。
- 確認: `npm.cmd run check` 成功（39ファイル・新ブロックOK）。ハーネスで front/iso を出力し参照と比較済み。**プレビューはバックグラウンドで生成が止まるため、目視検証はこのハーネスで担保**（鉄則どおり）。実ブラウザでの最終確認はユーザー画面でリロード後に推奨。
- **残り**: 茶屋・東京タワー・棚田は認識可能だが軽微改善余地（茶屋の妻側の白パッチ、東京タワーのラチス密度/脚の反り）。その後、マップ散在の人工構造物（小屋・廃墟・店・バス停・倉庫等）と村の建物も同方式で高品質化していく。


## 🚩 次セッションへの引き継ぎ（最初に読む）

### 状態
- ブランチ `main`。**2026-06-27: Vite移行＋全機能＋ `music/` を初コミット＆push 済み**（commit `dc3a03e`）。これで **GitHub Pages の公開サイトが単一HTML版 → Viteビルド版（GitHub Actions deploy）へ切替**。デプロイ成功確認済み。以降は通常どおり機能ごとにコミット/push してよい。
- **⚠️ GitHub Pages の配信元は必ず「GitHub Actions」（API上 `build_type: workflow`）にすること。** 初回は「ブランチ main /（legacy）」のままで、ビルド前の素の `index.html`（`/src/styles.css`・`/src/main.js` を絶対パス参照、しかも `game.generated.js` は未コミット）を配信してしまい、全アセット404で公開サイトが真っ白/素テキスト表示になった。`gh api -X PUT repos/<owner>/minecraft-web/pages -f build_type=workflow` で切替→`gh workflow run "Deploy GitHub Pages"` で再デプロイして復旧。配信HTMLが `./assets/...`（相対）を参照していればOK。`vite.config.js` の `base: './'` がサブパス配信の肝。
- `.gitignore` で `gikopoi2/` `hallucinate/` `textures/` `*.url` `suno生成プロンプト.txt` を除外（巨大/対象外のため）。`music/`（mp3 計~153MB・最大7MB）はPages BGM用にコミット済み。
- ビルドは通る: `npm.cmd run check` 成功（39パーツ）。`npm.cmd run dev -- --port 5190` で HTTP 200、ブラウザ上で `#travelerPanel` / `#chestPanel` 生成・console error/warnなし。
- **小型スライム敵Mobは出現停止中**。倒す方法が未実装のため、`src/game/parts/39-hostile-mobs.js` の `HOSTILE_SPAWNING_ENABLED=false` でスポーンを止め、既存 `HOSTILES` も更新時に除去する。攻撃/敵HP/撃破報酬などを入れてから再有効化する。
- 既知の軽微事項: `.github/workflows/deploy-pages.yml` の actions が Node20非推奨警告（Node24で強制実行されるため動作はする）。v5系へ更新推奨。

### 開発・確認の鉄則
- 編集対象は `src/game/parts/*.js` と `src/styles.css`。`src/game.generated.js` は `npm run assemble` が結合する自動生成物（直接編集しない）。パーツはファイル名のアルファベット順で結合され、**module直下スコープを全パーツで共有**（関数宣言は巻き上げで前後参照OK、const/letはTDZあり＝トップレベルで後方の値を参照しない）。
- **プレビューはタブがバックグラウンドでrAFが止まり、マップ生成（`processWorldJob`）が進まない**。動きの目視は不可。よって生成系の検証は「①`npm run check`成功 ②ロードで`__mcReady`・エラーなし ③依存をスタブしたNode単体ハーネスでジオメトリ検証」で担保してきた（このやり方を踏襲）。
- **構造物を追加・修正するときは、必ず先にネット画像検索でMinecraft作例/実物写真を複数見て、共通するシルエット・比率・特徴部位をメモしてから実装する。実装後は実ブラウザで該当構造物へ移動してスクリーンショットを撮り、参照画像と見比べて「名前を伏せても何に見えるか」を確認する。ビルド成功・ブロック数・undefinedなしだけでは完了扱いにしない。**
- 音楽会場系（`60-rave-venues.js`/`70-music.js` 等）はユーザー指示でこのセッション中は触っていない。通常ワールド側のみ対象。
- `gikopoi2/` `hallucinate/` は対象外。

### 今セッションで追加したもの（通常ワールド「マップ拡張」一式）
- 地下遺跡ダンジョン / 村クラスタ（井戸・家・畑・道・街灯＋鍛冶屋・市場・教会・見張り塔・図書館・畜舎・村名看板）/ マップ全体に散る人工構造物（小屋、廃墟、石塔、砂漠神殿、道路、店、バス停、太陽光施設、アンテナ、休憩所、倉庫、作業小屋、小祠、監視拠点、観測所）/ 廃坑 / 地下湖（水・溶岩）/ 新バイオーム3種（沼地・ジャングル・火山＋溶岩クレーター）/ 自然ディテール（岩・倒木・枯れ木・サボテン・水草）/ 村人の村定住＋会話/簡易取引 / 夜の蛍 / 宝箱の右クリックグリッドUI / 溶岩・サボテンの接触ダメージ / 深層鉱石ブースト。
- 新ブロック（index）: 石レンガ20, 苔石レンガ21, 宝箱22, ランタン23, 溶岩24, サボテン25, 開いた宝箱26, 村の看板27。
- 生成は `32-world-window.js` の **ビルドキュー方式**（`collectBuilders()` が 建物/遺跡/村/廃坑/地下湖 のビルダー関数を1キューに集約し、pregen/移動窓の構造物フェーズで順次実行）。地下構造の地上階段は共通の `carveStairUp()`。
- 確認用デバッグ移動: `F3`飛行 / `F4`洞窟 / `F6`地下遺跡 / `F7`村 / `F8`廃坑 / `F9`地下湖 / `F10`峡谷 / `F11`富士山 / `0`和風建築順送り（飛行中）。

### 次の候補（ユーザーの「どんどん実装」継続用）
- 村人の生活スケジュール、評判、構造物別の専用取引。
- 敵Mobを再有効化するための攻撃/敵HP/撃破報酬/ノックバック。
- 宝箱報酬を構造物別テーブルに分ける、罠つき宝箱などを追加する。
- 海岸線・島（川/峡谷/滝は実装済み）。ただし地形高さの大改修で世界の見た目が一変するため重め。

---

## 2026-06-29 追記: 日本ランドマーク第三弾（水上鳥居・大仏・棚田・東京タワー風）

- `HANDOFF.md` を読んで継続。音楽会場系（`60-rave-venues.js` / `70-music.js`）は触らず、通常ワールドのランドマーク追加のみ。
- `src/game/parts/32-world-window.js`:
  - `structurePlanForCell()` の和風抽選を `jp<0.40` に拡張し、`waterTorii` / `daibutsu` / `riceTerrace` / `tokyoTower` を追加。草原/森林に出現。
  - `addWaterTorii()`: 厳島風。浅い池、砂の岸、石畳の参道、中央の朱鳥居、石灯籠。
  - `addDaibutsu()`: 緑青の銅瓦ブロックをブロンズに見立てた座像。台座、膝、肩、頭、耳、白毫、宝箱/灯り。
  - `addRiceTerrace()`: 段ごとの水田、畦、木道、案山子、石灯籠。
  - `addTokyoTower()`: 赤白ラチス脚、リング梁、展望台、アンテナ、頂部発光結晶。高いので構造物クリア高さを `base+36` に拡張。
  - `structureBase()` の地形差許容と `addStructurePlan()` のdispatch/clear高さを各typeに合わせて更新。
- `src/game/parts/49-debug-mode.js`: `0` の和風建築順送りに `waterTorii` / `daibutsu` / `riceTerrace` / `tokyoTower` を追加。
- `README.md` / `MINECRAFT_GAP_PLAN.md` を同期。
- 確認: `npm.cmd run assemble` 成功。`npm.cmd run check` 成功（39ファイル結合・Vite build・35 runtime asset copy）。Node単体ハーネスで実ビルダー抽出実行: 水上鳥居=231ブロック/maxY20/水・朱・石レンガ・ランタン、大仏=378ブロック/maxY22/銅瓦・ガラス・金・宝箱、棚田=561ブロック/maxY14/水・村看板・板材・石レンガ、東京タワー風=341ブロック/maxY45/朱・雪・ガラス・発光結晶、いずれもundefined配置なし。`npm.cmd run dev -- --port 5190` を起動し `http://127.0.0.1:5190/` HTTP 200、アプリ内ブラウザでcanvas 1280x720・地形チャンク49・console error/warnなし、スクリーンショットサンプル1620点中 nonWhite=1584 / nonBlack=1614 / uniqueColors=920。
- **次の候補**: 町家/神社の参道/大きな寺、既存散在構造物（shop/depot/restStop 等）の新ヘルパー化、構造物別の宝箱報酬。

## 2026-06-30 追記: 大仏を巨大ランドマーク枠へ修正

- ユーザー指摘「大仏っぽくない」「ブロックが大きいから作るのが難しい」を受け、小型散在構造物のまま似せる方針を撤回。`src/game/parts/32-world-window.js` の `daibutsu` を 27x23 の巨大枠に拡大し、地形差許容と上空クリア高さも専用化した。
- `addGiantDaibutsu()` を追加し、広い基壇、蓮華座、座禅の膝、胴体、丸頭、細い長耳、控えめな光背、膝上の手を優先。黒い目や白い横帯がロボット顔に見えたため、顔のコントラストを落として伏し目寄りに調整した。
- `src/game/parts/49-debug-mode.js`: `0` キーの大仏移動は像の中心ではなく正面の鑑賞位置へ飛び、`yaw/pitch` も大仏へ向けるよう修正。
- 確認: `npm.cmd run check` 成功。実ビルダー抽出の正面プレビューを `.tmp/structure-audit/daibutsu-revised-front.png` に生成して確認。実ブラウザ確認は一度ブラウザ制御側がタイムアウトしたため、ユーザー画面でリロード後に再確認が必要。

## 2026-06-29 追記: 共通建築ヘルパー＋和風建築（鳥居・五重塔・茶屋）

- 富士山に続く日本ランドマーク第二弾。音楽会場系は触らず通常ワールドのみ。公開Minecraft系の「テンプレ配置」手法を参考に、まず**再利用可能な建築ヘルパー**を入れて品質の土台を作った（既存の村建物 `buildHouse`/`buildChurch` の作り込みを汎用化）。
- `src/game/parts/32-world-window.js` に共通ヘルパーを追加:
  - `roofGabledX/Z()`: 軒を1ブロック張り出し、妻側の三角壁を塞ぐ**切妻屋根**（棟がX/Z方向）。`mat`/`ridgeMat`/`gableMat` を指定。
  - `framedWalls()`: 角柱＋窓＋出入口の壁（`opts.door='minZ'|...`、`opts.win`/`winY`）。
  - `stoneLantern()`: 竿(石レンガ)＋火袋(ランタン)＋笠(石)の石灯籠。
- 和風ビルダー追加: `addTorii()`（朱＝レンガの鳥居、笠木の反り上がり、x/z両向き）、`addPagoda()`（段ごとに縮む3層の屋根＋心柱＋相輪＝発光結晶、内部に宝箱）、`addTeahouse()`（縁側＋障子＝ガラス＋丸太柱＋瓦＝石の切妻屋根＋参道の石灯籠、内部に宝箱/作業台）、`addCastle()`（**天守閣／姫路城風**＝石垣の3段台座＋白壁＝雪＋反り屋根の3層＋金の鯱＝金鉱石、内部に宝箱2/ランタン。13×13でレア）。
- `structurePlanForCell()`: 草原/森林で `jp<0.34` のとき和風に割当（天守閣4%レア / 鳥居 / 五重塔 / 茶屋）。size表・`structureBase` のlimit（鳥居・天守閣は3まで許容）・`addStructurePlan` のdispatch・五重塔/天守閣のプリクリア高さ(+15)を追加。
- 確認: `npm.cmd run check` 成功（39ファイル結合・Vite build）。**Node単体ハーネスで実コードを抽出実行**: 鳥居=笠木全幅＋反り端＋柱（x/z両向き）／五重塔=342ブロック・maxY24・相輪(発光結晶)・宝箱・段の縮小／茶屋=入口開口・障子ガラス・作業台・宝箱／天守閣=795ブロック・maxY26・石垣底面full・金の鯱・白壁・障子・宝箱、いずれも天井76未満・例外なし・undefined配置なし。
- **次の候補**: 町家/神社の参道/大きな寺、既存散在構造物（shop/depot/restStop 等）も新ヘルパーで作り直して高品質化する。

## 2026-06-29 追記: 自然ランドマーク「富士山」を追加

- ユーザー要望「自然の山も作り直して、富士山があるといい」「日本各地のランドマークもどんどん追加」を受けた第一弾。音楽会場系は触らず通常ワールドのみ。
- **公開Minecraft系の調査結果**: 高品質な構造物は「テンプレ/スキマティックをデータで持って配置する」方式（本家の村のNBT+ジグソー、Hunternif/VoxelArchitecture など）。地形は座標シードノイズ。コード流用はせず手法のみ参照。
- `src/game/parts/32-world-window.js`: 富士山を**高さオーバーライド型のランドマーク**として実装。`fujiCenter()` がシード決定の中心（スポーンから距離168）を返し、`landmarkHeightAt(x,z)` が反った円錐＋放射尾根＋碗状火口の高さを返す。`heightAt()` で通常地形を上書き（`Math.min(lm, CHUNK_Y_MAX-4)` で描画天井 80 直下にキャップ）。**通常の高さ上限 clamp(…,3,32) を超える**のがポイント。
- `topTypeAt()`: 富士山の列だけ、上部=雪冠(SNOW)、中腹=火山岩(STONE)、裾野=森(GRASS) の3層に。`generateTerrainColumn()`: 富士山の列は洞窟くり抜きをスキップしてクリーンな山体を保つ。
- `src/game/parts/49-debug-mode.js` / `54-input.js`: 確認用に `F11`=富士山頂へ移動（飛行ON）。デバッグHUDにも追記。
- 確認: `npm.cmd run check` 成功（39ファイル結合・Vite build・35 asset copy）。**Node単体ハーネスで高さ式を検証**: 中心 y55 < 火口の縁 y60（碗状火口）／縁60>中腹35>裾野12（外側へ低下）／描画天井76未満／雪冠(縁)・火山岩(中腹)・森(裾野)の帯が成立。ノイズ0の最悪ケースでも碗形が保たれる。プレビューはrAFが止まり生成が進まないため目視不可、この手法で担保（鉄則を踏襲）。
- **次の候補（日本ランドマーク継続）**: 共通建築ヘルパー（傾斜屋根・軒・柱フレーム・内装）を作って既存散在構造物を高品質化 → 鳥居/五重塔/天守閣/大仏/茶屋・町家/石灯籠の参道/棚田/東京タワー風。建物は `structurePlanForCell` のtype追加＋ビルダー関数＋size表＋`structureBase` のlimit＋dispatchをセットで更新する（既存の `addObservatory` 等が雛形）。

## 2026-06-29 追記: マップ全体の人工構造物を追加

- ユーザー補足「村じゃなくて、マップ全体的に人工の建物を増やしたい」を受け、村ではなく `structurePlanForCell()` 側の全体散布構造物を拡張。敵系は触っていない。
- `src/game/parts/32-world-window.js`: 構造物テーブルに `restStop`（休憩所）、`depot`（倉庫）、`workshop`（作業小屋）、`shrine`（小祠）、`outpost`（監視拠点）、`observatory`（観測所）を追加。バイオームに応じて、砂漠/高地/森林/雪原/平地に散る。
- 同ファイルに `addRestStop()` / `addDepot()` / `addWorkshop()` / `addShrine()` / `addOutpost()` / `addObservatory()` を追加。宝箱、ランタン、作業台、かまど、発光結晶など既存ブロックを使って内装差を出す。
- 直前に村側へ広げかけた宿屋/倉庫/木工小屋の追加は、ユーザー意図に合わせて戻し、村は図書館・畜舎までの状態に維持。
- `README.md` / `MINECRAFT_GAP_PLAN.md` も同期。
- 確認: `npm.cmd run check` 成功（39ファイル結合、Vite build、35 runtime asset copy）。

## 2026-06-29 追記: 村の図書館・畜舎を追加

- ユーザー指示「村の畜舎・図書館などの建物追加」を受け、通常ワールド側の村建物バリエーションを追加。音楽会場/BGM系は触っていない。
- `src/game/parts/32-world-window.js`: 村のスロット数を7〜9へ増やし、固定スロットとして `library` と `stable` を追加。`buildLibrary()` は本棚風の壁、閲覧机、ランタン、資料用宝箱を生成。`buildStable()` は屋根付き小屋、丸太の囲い、飼い葉桶、干し草風の積み荷を生成。
- `src/game/parts/38-travelers.js`: 図書館付近の村人を **司書**、畜舎付近の村人を **牧場係** に割り当てるよう追加。司書はガラス/ランタン、牧場係はベリー/板材の簡易取引を持つ。
- `README.md` / `MINECRAFT_GAP_PLAN.md` も同期。
- 確認: `npm.cmd run check` 成功（39ファイル結合、Vite build、35 runtime asset copy）。

## 2026-06-29 追記: スライム敵Mobの出現停止

- ユーザー指示「スライムの敵がいるけど、今は倒す方法がないので出現させないようにして」を受け、小型スライム敵Mobを一時停止。
- `src/game/parts/39-hostile-mobs.js`: `HOSTILE_SPAWNING_ENABLED=false` を追加。`spawnHostileNearPlayer()` は即returnし、`updateHostileMobs()` は既存 `HOSTILES` を `scene` から除去して配列を空にする。
- `MINECRAFT_GAP_PLAN.md`: 敵Mobを `[paused]` に変更。再開条件はプレイヤー攻撃、敵HP、撃破報酬、ノックバックなど、倒す手段の実装後。
- 確認: `npm.cmd run check` 成功（39ファイル結合、Vite build、35 runtime asset copy）。

## 2026-06-29 追記: 村名と名前看板

- 前回候補どおり、通常ワールド側に村名と村名看板を追加。音楽会場/BGM系は触っていない。
- `src/game/parts/32-world-window.js`: セル座標から決定的な村名を作る `villageNameForCell()`、現在地付近の村名を返す `villageLabelAt()`、入口側に村名看板を立てる `buildVillageSign()` を追加。`addVillagePlan()` で各村の看板を生成する。
- `src/game/parts/20-textures.js` / `22-block-types.js`: 村の看板ブロック `VILLAGE_SIGN=27` を追加。`src/game/parts/52-raycast.js` では板材ドロップ、斧優先、軽めの硬さに設定。
- `src/game/parts/82-weather-and-loop.js`: 村の近くにいる間、左上ステータスへ `村: <name>` を表示。`README.md` / `MINECRAFT_GAP_PLAN.md` も同期。

## 2026-06-29 追記: 村人の会話/簡易取引

- ユーザー指示「次の実装を行って」を受け、前回候補どおり通常ワールド側の村人会話/取引を実装。音楽会場/BGM系は触っていない。
- `src/game/parts/38-travelers.js`: 村人に `role` を追加。村スロットの近くでスポーンした場合、畑=農家、鍛冶屋=鍛冶屋、市場=商人、教会=聖職者、見張り塔=見張りへ割り当て、その他は旅人/商人寄り。視線上の近い村人を拾う `pickTravelerTarget()` を追加。
- 同ファイルに簡易取引定義を追加。農家はベリー/リンゴ、鍛冶屋は粗鉄/鉄道具、商人はたいまつ/ガラス、聖職者はランタン/食料、見張りは石レンガ/石斧、旅人は板材/たいまつを交換する。`canDoTravelerTrade()` / `doTravelerTrade()` でインベントリ消費と入手を処理。
- 新規 `src/game/parts/56-traveler-panel.js`: 村人パネルを追加。役割名、一言、取引リスト、現在所持数つきコスト、受取アイテムを表示し、足りない取引は無効化。`Esc`/`Tab` で閉じられるよう `src/game/parts/54-input.js` にガードを追加。
- `src/game/parts/52-raycast.js`: 右クリック時、ブロック操作より先に視線上の村人を確認し、見つかったら会話/取引パネルを開く。`src/styles.css` に村人パネルCSSを追加。`README.md` / `MINECRAFT_GAP_PLAN.md` も同期。
- 確認: `npm.cmd run check` 成功（39ファイル結合、Vite build、35 runtime asset copy）。`http://127.0.0.1:5190/` HTTP 200。ブラウザで `#travelerPanel` / `#chestPanel` DOM生成、地形生成完了後に「クリックして開始」、console error/warnなし。
- 次に順番で進めるなら、**村人の生活スケジュール/評判**、または**敵Mobを再有効化するための攻撃/撃破システム**。

## 2026-06-29 追記: README同期と宝箱グリッドUI

- ユーザー指示「順番に実装して」の1番目として、READMEの古い単一HTML/Web Audioシンセ説明を Vite 分割構成・mp3専用会場BGM・数字キー会場操作に同期。`npm.cmd run check` を確認コマンドとして記載。
- `src/game/parts/52-raycast.js`: 宝箱の中身を `mc_chests_<seed>` に座標キーで保存。右クリック時に一度だけ `rollChestLoot()` で中身を作り、閉じても再抽選しない。スタック単位取得/一括取得でインベントリへ入り、空になると既存どおり `OPEN_CHEST` へ変化して編集保存する。宝箱を採掘した場合は保存済み中身（未生成なら新規中身）を入手してから壊れる。
- 新規 `src/game/parts/56-chest-panel.js`: 中央に開く宝箱パネルを追加。18枠グリッド、スタック取得、すべて取る、閉じる、空状態を表示。`Esc`/`Tab` で閉じられるよう `src/game/parts/54-input.js` にガードを追加。
- `src/styles.css`: 宝箱パネル/グリッド/スロットのCSSを追加。`README.md` と `MINECRAFT_GAP_PLAN.md` も同期。
- 確認: `npm.cmd run check` 成功（38ファイル結合、Vite build、35 runtime asset copy）。`npm.cmd run dev -- --port 5190` で HTTP 200、ブラウザで `#chestPanel` DOM 生成と console error/warn なしを確認。ブラウザ制御環境では `window.__mcReady` が未取得だったが、画面は「クリックして開始」まで到達。
- 次に順番で進めるなら、**村人の会話/簡易取引**から。宝箱UIが入ったので、村探索の報酬導線は一段落。

## 2026-06-27 追記: 採掘/略奪した新ブロックを設置可能に（インベントリ画面から選択）

- 課題: ホットバーが固定12枠のため、ダンジョン/村の戦利品（石レンガ・苔石レンガ・ランタン等）はインベントリに入るが**設置できなかった**。番号キー1〜8は会場用で競合するため、ホットバー拡張ではなく**インベントリ画面（Tab）からの選択**で解決。
- `src/game/parts/53-inventory.js`: `heldBlockOverride` と `currentPlaceType()` / `currentPlaceName()` / `setHeldBlock()` / `clearHeldOverride()` を追加。ホットバー枠外のブロックを「設置対象」として上書き保持し、枠内の種類ならその枠を選択し直す。在庫が尽きたら自動でホットバーに戻る。
- `src/game/parts/52-raycast.js`: `placeBlock()` が `HOTBAR[selected]` ではなく `currentPlaceType()` を置く。
- `src/game/parts/56-inventory-panel.js`: ブロック行をクリックで設置対象に選択（`data-place`）。選択中の行をハイライト＋「✓ 設置中」表示。`56-hotbar-ui.js` の `selectSlot()` はホットバー選択時に override をクリア（マウスホイール/枠クリックが常に優先）。
- `src/game/parts/58-third-person-view.js` / `82-weather-and-loop.js`: 三人称の持ち物と左上「選択:」表示も現在の設置ブロックを反映。`src/styles.css`: 選択行のハイライトCSS。
- 確認: `npm.cmd run check` 成功。**実ブラウザ（dev `127.0.0.1:5174`）でDOM検証**: ロードで `__mcReady=true`・console error/warnなし。localStorageに石レンガ(20)/ランタン(23)を仕込んでリロード→Tabのブロックタブに出現→クリックで `selected` 化＋「✓設置中」、ホットバー枠クリックで override 解除（枠ブロックが選択）まで確認。
- 補足: 真のオーシャン/海岸線/島は別途。**現状この世界は海面(SEA=8)以下の地形がほぼ皆無**（52万列中1列）で、海を作るには `terrainHeightRaw` の大改修が要る＝世界の見た目が一変するため、腰を据えてやる方が良い。

## 2026-06-27 追記: 村の教会・見張り塔を追加

- ユーザー指示により、音楽会場系は触らず通常ワールド側のみ。
- `src/game/parts/32-world-window.js`: `villagePlanForCell` の4番目/5番目の村スロットを **教会** と **見張り塔** に割り当て。`buildChurch` は石レンガ壁、切妻屋根、十字付き尖塔、祭壇、ランタン、献金箱。`buildTower` は細い石レンガ塔、矢狭間、胸壁、ランタンビーコン、基部宝箱。
- 確認: `npm.cmd run check` 成功。`npm run dev -- --port 5185` でローカルロード、canvas表示、console error/warnなし、スクリーンショット取得成功。依存スタブのNode単体ハーネスで、村候補に `farm/blacksmith/market/church/tower/...` が入ることを確認。

## 2026-06-27 追記: 川の連続性・峡谷・滝（地形拡張）

- ユーザー選択「地形: 川・滝・峡谷」を実装。音楽会場系は触らず通常ワールドのみ。
- `src/game/parts/32-world-window.js`: **既存の `waterFeatureAt` 削り機構をそのまま再利用**して、川/峡谷/滝を追加（`terrainHeightRaw` は変更せず、水フィーチャの `level` を低く取り、`generateTerrainColumn` の削除ループで中腹をくり抜く＝周囲の満杯列が自然に壁になる）。
  - `meanderBand()`: ridged な歪みノイズで「うねる帯」を作る共通ヘルパ。`abs(fbm)` が小さい列が川/峡谷の中心線。
  - `riverAt()`: 連続して流れる川。`valleyFlowLevel()`（低周波 fbm）で**緩やかに下る滑らかな水面**を決め、`min(flowLevel, h-1)` で地面より上に浮かない。砂の床。
  - `canyonAt()`: 一部の地域（region>0.72）だけに出る深い峡谷。床は `min(flowLevel, h-5)` で**深さ5以上**を保証、底に川（火山バイオームは溶岩）、石の床・壁に鉱石露出。
  - `valleyAt()` が両者を統合し `waterFeatureAt()` の先頭に追加（→ 木/動物/Mob/旅人は自動で川・峡谷を避ける）。
  - **滝**: 峡谷の壁ぎわ（`t>0.6`）でまばらに、`fallTop` まで水/溶岩を縦に積んで壁伝いに落とす（`fill` を `level+1..fallTop` に充填）。溶岩は `12-lights.js` の動的ライトで光る。
  - `generateTerrainColumn`: 床材(`bed`)・充填材(`fill`=水/溶岩)・`fallTop` に対応。**洞窟入口/洞窟が水の真下を貫通して水が浮くバグを修正**（水フィーチャ時は床 `[level-deep, level-1]` を必ず塞ぐ）。
- `src/game/parts/49-debug-mode.js` / `54-input.js`: 確認用に `F10`=近くの峡谷へ移動 を追加。
- 確認: `npm.cmd run check` 成功（37ファイル）。**依存をスタブしたNode単体ハーネス**で 720×720=約52万列を生成検証 → 例外0／川は水面に水あり・隣接水面差≤1が99.8%（連続）／峡谷は全列で深さ≥5・底に水or溶岩・中腹が空気／滝列は縦4以上の充填／**浮いた水ブロック0**。プレビューはrAFが止まり生成が進まないため目視不可、この手法で担保（鉄則を踏襲）。

## 2026-06-27 追記: 村の役割付き建物（鍛冶屋/市場）とサボテン接触ダメージ

- `src/game/parts/32-world-window.js`: 村の建物に役割を追加。各村に **鍛冶屋**（石レンガの建物＋かまど＋溶岩の火床〈壁で囲い触れない〉＋金床〈丸太＋石〉＋宝箱）と **市場**（柱＋テント屋根＋カウンターに葉/砂/鉱石/サボテン等の品物＋宝箱）を必ず1軒ずつ生成。`villagePlanForCell` のスロット割当を `farm/blacksmith/market/...house` に変更し、`buildBlacksmith`/`buildMarket` を追加。
- `src/game/parts/51-survival.js`: サボテンに隣接すると小ダメージ（溶岩より軽い、デバッグ飛行中は無効）。
- 確認: `npm.cmd run check` 成功。`npm run dev` で `__mcReady=true`・console error/warnなし。鍛冶屋/市場は依存スタブのNode単体ハーネスで検証（各400件すべて例外なし・undefined配置なし／鍛冶屋に炉と溶岩火床／市場に品物と宝箱）。

## 2026-06-27 追記: 宝箱の開封インタラクション

- 新ブロック 開いた宝箱(26)（`20-textures.js`/`22-block-types.js`）。
- `src/game/parts/52-raycast.js`: 宝箱を**右クリックで開封**→`rollChestLoot()` の中身を入手し、開いた宝箱(26)へ変化（編集として永続化、再略奪不可）。入手内容を画面のトーストに表示（`setDebugToast` を流用）。開いた宝箱は右クリック無反応、採掘すると板材を落とす。宝箱を壊して入手する従来ルートも維持。
- 確認: `npm.cmd run check` 成功。`npm run dev` リロードで `__mcReady=true`・console error/warnなし。

## 2026-06-27 追記: 村人の定住化と夜の蛍

- ユーザー「実装をどんどん続けて」を受けた追加。音楽会場系は触らず通常ワールドのみ。
- **村人の定住**: `src/game/parts/38-travelers.js`。`spawnTravelerNearPlayer` を改修し、近く（`TRAVELER_SPAWN_R`内）に村があれば旅人を村の家/中心付近にスポーンさせる（`villageSpawnSpot`）。`canPlaceTravelerAt` が村の列（`villageAffectsColumn`）の上でも配置可になるよう許可条件を追加。これで村が無人ではなくなり、村人がうろつく。
- **夜の蛍**: 新パート `src/game/parts/43-fireflies.js`。加算ブレンドの `THREE.Points`（44粒）で、夜かつ屋外かつ草原/森林/沼地/ジャングルのときだけプレイヤー周囲にふわふわ漂う蛍を表示。`DAY.light` から夜度を算出してフェードし、個体ごとに点滅。会場中・地下では非表示。`82-weather-and-loop.js` の更新ループに `updateFireflies(dt)` を追加。
- 確認: `npm.cmd run check` 成功（37ファイルへ）。`npm run dev` リロードで `__mcReady=true`・canvasあり・console error/warnなし。プレビューはrAFが止まり動きの目視はできないため、モジュール読込時の初期化（蛍メッシュ生成/scene追加）が無事通ることと、ロジックがガード済みであることで担保。
- 次の候補: 川の連続性/滝、村の役割付き建物（鍛冶屋/市場）、宝箱の開封インタラクション、サボテン接触ダメージ。

## 2026-06-27 追記: 新バイオームと自然ディテール（マップ追加 ④⑤）

- ユーザー「どんどん実装して」を受け、④地形・新バイオームと⑤自然ディテールを実装。音楽会場系は触らず通常ワールドのみ。
- **④ 新バイオーム** `src/game/parts/32-world-window.js`:
  - `BIOMES` に 沼地 / ジャングル / 火山 を追加し、`biomeAt` の判定に組み込み（火山は `region<0.06 && rough>0.52` でレア、ジャングルは高温多湿、沼地は多湿で平坦）。既存5バイオームとスポーン平地の挙動は維持。
  - `terrainHeightRaw` に各バイオームの起伏を追加（沼地=水面付近で平坦、ジャングル=やや起伏、火山=高い山体）。`topTypeAt` で火山表面を石に。`generateTerrainColumn` で火山の高所(h≥27)に発光する溶岩クレーターを生成。
  - `isTrunk`/`addTreeAt`: ジャングルは木が密で高く、沼地は疎な木。沼地は池の出現率を上げてマーシュ感を出した。
  - バイオーム健全性をNode単体ハーネスで確認（全8バイオーム到達／高さNaNなし・範囲[5,32]）。
- **⑤ 自然ディテール**: 新ブロック サボテン(25)（`20-textures.js`/`22-block-types.js`/`52-raycast.js`）。`addDecorAt()` を追加し、木と同じフェーズでまばらに散布（cheapなhashで約97.8%を即bailし負荷を抑制）。岩（石の小さな塊）、倒木（森/ジャングル）、枯れ木とサボテン（砂漠）、沼の水草（葉を水面に）。構造物/村/水辺の上には出さない。
- 確認: `npm.cmd run check` 成功。`npm run dev` リロードで `__mcReady=true`・canvasあり・console error/warnなし。
- これで当初の「順番に実装」リスト①〜⑤を一通り実装完了。今後の候補: 川の連続性/滝、サボテン接触ダメージ、蛍などの夜パーティクル、村に役割付き建物/定住NPC、宝箱の開封インタラクション。

## 2026-06-27 追記: 地下ワールド拡張（廃坑・地下湖・溶岩・深層鉱石）

- ユーザー「順番に実装」の続き（③地下ワールド拡張）。音楽会場系は触らず通常ワールドのみ。
- 新ブロック: 溶岩(24)。`src/game/parts/20-textures.js`（液体の発光テクスチャ）/ `22-block-types.js`（`solid:false`・発光マテリアル）。`12-lights.js` で溶岩を動的ライトに追加。
- `src/game/parts/51-survival.js`: 溶岩に触れると毎秒ダメージ＋ハート点滅（デバッグ飛行中は無効）。
- `src/game/parts/32-world-window.js`:
  - **廃坑** `MINESHAFT_CELL=70`（約12%）: 地下に木の支柱（丸太＋板の梁）トンネルを長さ22〜37で掘り、4マスごとに支柱、8マスごとにたいまつ、壁に露出鉱石、途中に溶岩ハザード、終端の小部屋に宝箱とランタン。入口側から地上への階段。
  - **地下湖** `LAKE_CELL=104`（約8.5%）: 楕円体の大空洞を掘り、下半分を水（約3割は溶岩湖）で満たし、岸に砂、天井寄りに発光結晶。岸から地上への階段。
  - **深層鉱石**: `oreTypeAt` で y≤11 はダイヤ/金の出現閾値を緩め、深く掘るほど良い鉱石が出やすい。
  - 生成フェーズを **ビルドキュー方式** に整理（`collectBuilders()` が建物/遺跡/村/廃坑/地下湖のビルダー関数を1本のキューにまとめ、pregen/移動窓の構造物フェーズで順次実行）。共通の地上階段 `carveStairUp()` を追加し、遺跡入口マーカーを再利用。
- `src/game/parts/49-debug-mode.js` / `54-input.js`: 確認用に `F8`=近くの廃坑、`F9`=近くの地下湖 を追加。
- 確認: `npm.cmd run check` 成功。`npm run dev` リロードで `__mcReady=true`・canvasあり・console error/warnなし。廃坑/地下湖ジオメトリは依存スタブのNode単体ハーネスで検証（廃坑459件すべて階段が地上到達＋宝箱／地下湖231件すべて階段到達・うち溶岩湖65件）。
- 残り: ④地形・新バイオーム（川/滝/沼/ジャングル/火山）、⑤自然ディテール（倒木/岩/サボテン/蛍/滝しぶき）。

## 2026-06-27 追記: 地上の村クラスタを追加（マップ追加 第2弾／村）

- ユーザー選択「地上の村クラスタ」を実装。音楽会場系は触らず通常ワールドのみ。
- `src/game/parts/32-world-window.js`: 村生成を追加。`VILLAGE_CELL=150` のセル単位（約10%）で、平地/森林かつ平坦（中心±12の高低差≤4）な場所にのみ生成。中央に井戸（石レンガの縁＋水＋丸太の柱＋板の屋根＋ランタン）、その周りのリング上に5〜7区画。各区画は家（板材＋丸太/石レンガの角柱、窓ガラス、中心を向いた出入口、屋根、内装ランタン、約45%に宝箱）または畑（土の畝＋中央の水路＋葉の作物＋丸太の柵）。各区画と中央を石レンガの道でつなぎ、中心付近にランタン街灯を2本立てる。`buildWell/buildHouse/buildFarm/buildPath/buildLamp/addVillagePlan` を追加し、構造物フェーズ（pregen/移動窓）に `collectVillagePlans` を組み込んだ。
- 村の上は木・池・水路を抑制（`villageAffectsColumn` を `addTreeAt` / `pondFeatureAt` / `streamFeatureAt` に追加）。森林の高い木密度で村が埋もれないようにした。
- `src/game/parts/49-debug-mode.js` / `54-input.js`: 確認用に `F7` で近くの村へ移動を追加（村は数百ブロック間隔でレアなので発見補助）。
- 確認: `npm.cmd run check` 成功。`npm run dev` リロードで `__mcReady=true`・canvasあり・console error/warnなし。村ジオメトリは依存スタブのNode単体ハーネスで検証（村362件すべて例外なし／平均家3.9＋畑2.1／全井戸に水／宝箱638）。
- 残り（ユーザー要望「順番に実装」の続き）: ③地下ワールド拡張（廃坑/地下湖/溶岩/深層）、④地形・新バイオーム（川/滝/沼/ジャングル/火山）、⑤自然ディテール（倒木/岩/サボテン/蛍/滝しぶき）。

## 2026-06-27 追記: 地下遺跡ダンジョンと意味のある探索報酬を追加

- ユーザー指示「GitHub公開のMinecraft系ゲームを参考に、意味のある建物/遺跡/地下ワールドを入れて」を受けた第一弾。音楽会場系は触らず、通常ワールド側のみ対象。
- 参考: `dgreenheck/minecraft-threejs-clone`, `ashish0kumar/Minecraft-Javascript-Edition` などの公開クローンの「seed付きノイズ + セル単位の決定的配置 + 3Dノイズ鉱石」という生成手法を参照（コード流用なし）。これらのクローンは地形/鉱石/木までで村・ダンジョンは持たないため、同じスタイルで地下遺跡を自作した。
- `src/game/parts/20-textures.js` / `22-block-types.js`: 石レンガ(20)、苔石レンガ(21)、宝箱(22)、ランタン(23)を追加。石レンガ系には法線マップ付き。
- `src/game/parts/32-world-window.js`: 地下遺跡ダンジョンを追加。`DUNGEON_CELL=84` のセル単位（約16%）で、地表下に石レンガ/苔石レンガの部屋を生成。四隅の柱とランタンで内部を照らし、中央に宝箱、壁に露出鉱石を配置。部屋から地上まで登り階段（1段ごとに+1y外側へ）を掘り、地上には壊れた石レンガの遺跡入口マーカーを出す。`collectDungeonPlans()` を構造物フェーズ（pregen/移動窓の両方）に組み込み。
- `src/game/parts/52-raycast.js`: 宝箱を採掘すると `rollChestLoot()` で石炭確定＋2〜4種（粗鉄/粗金/ダイヤ/インゴット/食料/たいまつ/発光結晶など）をドロップ。石レンガ系/宝箱の採掘ツール・硬度も追加。
- `src/game/parts/12-lights.js`: ランタンを動的ライト探索に追加（暖色・距離11）。
- `src/game/parts/49-debug-mode.js` / `54-input.js`: 確認用に `F6` で近くの地下遺跡へ移動を追加。ダンジョンは数が少ないので発見補助になる。
- 確認: `npm.cmd run check` 成功。`npm run dev` でページ読み込み・`window.__mcReady=true`・console error/warnなし。プレビューはタブがバックグラウンドでrAFが止まりマップ生成が進まないため、ダンジョン生成ジオメトリは依存をスタブしたNode単体ハーネスで検証（生成1075件すべて例外なし／宝箱配置／階段が地上へ到達）。
- 次の候補: 地上の村（複数小屋＋畑＋井戸＋道のクラスタ）、内装のある遺跡神殿、地下湖/深層エリア、宝箱を「開ける」インタラクション化。

## 2026-06-27 追記: 垂直すぎる山を緩和

- ユーザー指摘: 高い山がほぼ垂直で、通常移動では登れない。
- ユーザー指示により、音楽会場関係は触らず、通常ワールド側だけを対象にした。
- `src/game/parts/32-world-window.js`: 高地/雪原バイオームの高さ差、尾根加算、最大標高を抑制。バイオーム境界で砂漠や草原から巨大な壁になりにくいようにした。高さ計算キャッシュも追加。
- `src/game/parts/50-player-physics.js`: 通常移動時、接地中の水平移動で1ブロック程度の段差を自動で上がるステップアップを追加。
- `MINECRAFT_GAP_PLAN.md` / `README.md` を同期。
- 確認: `npm.cmd run check` 成功。本番プレビュー `http://127.0.0.1:4173/` で初期生成完了 (`クリックして開始`, `地形チャンク: 49`) とページ側 console error/warnなしを確認。
- 注意: 既に開いているブラウザではリロード後に新しい地形生成が反映される。

## 2026-06-27 追記: 洞窟確認用デバッグ移動を追加

- ユーザー指示により、音楽会場関係は触らず、通常ワールド側だけを対象にした。
- `src/game/parts/49-debug-mode.js`: 通常ワールド確認用のデバッグ状態を追加。`F3` で飛行ON/OFF、`F4` で近くの洞窟入口へ移動。
- `src/game/parts/82-weather-and-loop.js`: デバッグ飛行中は衝突/重力を無視し、`WASD` 移動、`Space` 上昇、`Shift` 下降、`Ctrl` 高速移動に切り替える。
- `src/game/parts/54-input.js` / `styles.css`: デバッグキー入力と画面上部のデバッグHUDを追加。
- `MINECRAFT_GAP_PLAN.md` / `README.md` を同期。
- 確認: `npm.cmd run check` 成功。本番プレビュー `http://127.0.0.1:4173/` で `F3` デバッグHUD表示とページ側 console error/warnなしを確認。

## 2026-06-27 追記: 洞窟の探索価値を追加

- ユーザー指示により、音楽会場関係は触らず、通常ワールド側だけを対象にした。
- `src/game/parts/20-textures.js` / `22-block-types.js`: 発光結晶と鍾乳石ブロックを追加。発光結晶は青系の発光マテリアル。
- `src/game/parts/32-world-window.js`: 洞窟入口付近と地下空洞内に、低密度で発光結晶/鍾乳石を生成。発光結晶は深めの洞窟ほど少し出やすい。
- `src/game/parts/12-lights.js`: たいまつ用の近傍ライト探索に発光結晶を追加し、洞窟内で青く光るようにした。
- `src/game/parts/52-raycast.js` / `53-inventory.js`: 発光結晶の採掘ドロップとして「発光結晶の欠片」を追加。
- `MINECRAFT_GAP_PLAN.md` / `README.md` を同期。
- 確認: `npm.cmd run check` 成功。本番プレビュー `http://127.0.0.1:4173/` で初期生成完了 (`クリックして開始`, `地形チャンク: 49`) とページ側 console error/warnなしを確認。

## 2026-06-27 追記: インベントリ整理画面を追加

- ユーザー指示により、音楽会場関係は触らず、通常ワールド側だけを対象にした。
- `src/game/parts/56-inventory-panel.js`: `Tab` で開くインベントリ整理画面を追加。ブロック、素材、道具、食料をカテゴリ別に一覧表示する。
- `src/game/parts/53-inventory.js`: 所持数や食料使用時に整理画面も更新するよう接続。
- `src/styles.css`: インベントリ整理画面の表示を追加。
- `MINECRAFT_GAP_PLAN.md` / `README.md` を同期。
- 確認: `npm.cmd run check` 成功。本番プレビュー `http://127.0.0.1:4173/` で `Tab` 表示、カテゴリ切替、ページ側 console error/warnなしを確認。

## 2026-06-27 追記: 通常ワールド側の食料UIと道具耐久を追加

- ユーザー指示により、音楽会場関係は触らず、通常ワールド側だけを対象にした。
- `src/game/parts/53-inventory.js`: 食料アイテム（リンゴ/ベリー）と、道具ごとの耐久値保存 (`mc_tool_durability_<seed>`) を追加。
- `src/game/parts/52-raycast.js`: 葉/草の採掘で食料がドロップし、適正道具で採掘した時に耐久が減るよう変更。耐久が0になると所持道具を1本消費する。
- `src/game/parts/51-survival.js` / `56-hotbar-ui.js` / `styles.css`: 画面右下に食料ボタンと現在の最良道具の耐久表示を追加。食料はクリックまたは `H` キーで空腹と体力を回復する。
- `MINECRAFT_GAP_PLAN.md` / `README.md` を同期。
- 確認: `npm.cmd run check` 成功。

## 2026-06-27 追記: 水辺の探索感を追加

- 次の開発候補から「水辺の改善」を選択し、小さな池と浅く蛇行する水路を追加。
- `src/game/parts/32-world-window.js`: シード固定のセル判定で池、ノイズ判定で細い水路を生成。スポーン平地、構造物、高地/雪原などでは出ないよう抑制し、岸や底は砂へ寄せた。
- `src/game/parts/37-animals.js`: 動物が池や水路の上にスポーン/移動しないよう、水景判定を参照。
- `MINECRAFT_GAP_PLAN.md` / `README.md` を同期。
- 参考: GitHubのMinecraft系実装はコード流用せず、シード付きノイズ地形と水面生成の考え方だけ参照。

## 2026-06-27 追記: 通常ワールド用の旅人NPCを追加

- ユーザー指示により、会場NPC/ダンサー系は触らず、通常ワールド側だけを対象にした。
- `src/game/parts/38-travelers.js` を追加。Minecraft系の村人らしい大きめの頭、鼻、腕組み、ローブ、背負い袋のシルエットを、既存の軽量ボックスモデル方式で実装。
- 旅人NPCは構造物周辺または草原に最大8体までスポーンし、ゆっくり歩き、近づいたプレイヤーの方を見る。会場起動中は新規スポーンしない。
- `src/game/parts/82-weather-and-loop.js`: 通常ワールドの更新ループに `updateTravelers(dt)` を追加。
- `src/game/parts/39-hostile-mobs.js`: 直前の水辺追加に合わせ、敵Mobも池/水路上に出ないよう調整。
- `MINECRAFT_GAP_PLAN.md` / `README.md` を同期。

## 2026-06-27 追記: 地形描画負荷の表示と範囲を調整

- 左上ステータスの `描画ブロック` は、個別Mesh数ではなくチャンクメッシュへ結合された可視ブロック集計で、18万前後と出て不安を招いていた。
- `src/game/parts/24-instanced-meshes.js`: 地形チャンクメッシュの `frustumCulled=false` を外し、カメラ外チャンクの視錐台カリングを有効化。ステータス用に `terrainChunkCount()` を追加。
- `src/game/parts/32-world-window.js`: フォグ距離に対して余裕が大きかった生成/描画窓を `WIN_R=108` から `72`、起動前事前生成を `PREGEN_R=220` から `96` へ縮小。
- `src/game/parts/82-weather-and-loop.js`: ステータス表示を `描画ブロック` から `地形チャンク` へ変更。
- `src/game/parts/34-mesh-rebuild.js`: 1フレームあたりのメッシュ再構築予算を下げ、初回描画も分割処理へ寄せた。いったん試した greedy meshing は崖が大きな板のように見えてブロック感を壊したため、通常の1ブロック単位の可視面メッシュへ戻した。
- `src/game/parts/20-textures.js`: 生成テクスチャ/法線マップを RepeatWrapping に変更。現状は通常メッシュ表示なので副作用は小さいが、将来の面結合を再検討しやすい状態。
- `src/game/parts/24-instanced-meshes.js`: 現状の地形/木/構造物の高さに合わせ、チャンクY走査上限を `96` から `80` へ縮小。
- 起動前の最後に同期 `rebuild()` で全チャンクを一括生成していた部分を、既存の分割 `requestRebuildAsync()` へ変更。開始表示は `地形描画中...` を経由し、チャンク生成完了後に `クリックして開始` になる。
- 確認: `npm.cmd run check` 成功。プレビューで `マップ生成中...` → `地形描画中...` → `クリックして開始` を確認。開始後 `地形チャンク: 49`、console error/warnなし。

## 2026-06-27 追記: 設定UIとワールド作成入口を追加

- GitHub公開Minecraft系の実装を参考に、今後の追加機能で重くなった時の逃げ道として設定UIを先に追加。
- `src/game/parts/31-settings.js`: 設定保存 (`mc_settings_v1`) と、描画距離/視野角/マウス感度の既定値を追加。
- `src/game/parts/59-settings-panel.js`: 右上の歯車と `,` キーで開く設定パネルを追加。描画距離、視野角、マウス感度、シード指定、ランダムワールド作成を操作できる。
- `src/game/parts/32-world-window.js`: `WIN_R` / `PREGEN_R` を設定値から決めるよう変更。描画距離は再読み込み後に反映。
- `src/game/parts/54-input.js`: マウス感度設定を視点操作に反映。
- `MINECRAFT_GAP_PLAN.md` / `README.md` を同期。

## 2026-06-26 追記: Minecraft差分ロードマップ / Phase 1開始

- `MINECRAFT_GAP_PLAN.md` を追加。Minecraftと比べて足りない要素を、探索、サバイバル、インベントリ/クラフト、Mob/生態系、構造物、地下、UI、保存/ワールド設定の8フェーズに整理した。
- Phase 1「探索の基礎」として、地下鉱石とたいまつを追加。
- `src/game/parts/20-textures.js`: 石炭鉱石、鉄鉱石、金鉱石、ダイヤ鉱石、たいまつのドット絵テクスチャを追加。
- `src/game/parts/22-block-types.js`: 鉱石4種とたいまつをブロック種別に追加。たいまつはホットバー10枠目へ追加。
- `src/game/parts/32-world-window.js`: 地下の深さとノイズに応じて鉱石が自然生成されるようにした。石炭は浅めにも出て、鉄/金/ダイヤは深いほどレア。
- `src/game/parts/12-lights.js` / `82-weather-and-loop.js`: 近くに置いたたいまつを最大10個まで動的ライトとして拾い、周囲を暖色で照らすようにした。
- 確認: `npm.cmd run check` 成功。

## 2026-06-26 追記: 音楽会場BGMの無音化バグ修正

- 症状: 音楽会場を出した時に、たまに音が鳴らない。
- 原因: Vite開発サーバーが存在しない `music/<kind>-N.mp3` にも `HEAD 200` + HTMLを返すため、mp3走査が実在しない4曲目以降を「あり」と誤検出していた。
- `src/game/parts/70-music.js`: mp3走査でHTTPステータスだけでなく `Content-Type` / `Content-Length` を確認し、HTMLフォールバックをmp3として数えないように修正。
- 確認: `npm.cmd run check` 成功。ローカルHEAD確認で検出数は `classic=3`, `neon=3`, `forest=3`, `laser=5`, `future=4`, `bass=3`, `chill=3`, `dub=3`。

## 2026-06-26 追記: Phase 3 クラフト/かまど/道具の入口実装

- `src/game/parts/20-textures.js` / `22-block-types.js`: 作業台とかまどのテクスチャ/ブロック種別を追加。ホットバーは12枠になり、作業台/かまども設置できる。
- `src/game/parts/53-inventory.js`: インベントリをブロック専用から、棒、石炭、粗鉄、粗金、インゴット、ダイヤ、道具などの文字列アイテムも保存できる形へ拡張。既存の数値キーセーブも読める。
- `src/game/parts/55-crafting.js` を追加。`B` でクラフト、`F` でかまどパネルを開く。丸太->板材、板材->棒、作業台、かまど、たいまつ、木/石/鉄ツルハシ、木/石斧、木/石シャベル、粗鉄/粗金/砂の精錬を実装。
- `src/game/parts/52-raycast.js`: 鉱石を壊した時のドロップを石炭/粗鉄/粗金/ダイヤへ変更。ツルハシ所持時は一部鉱石に小さな入手ボーナスが入る。
- `src/game/parts/54-input.js`: パネル表示用に `B` / `F` を追加。UI操作用のポインタロック解除では一時停止しないガードを追加。
- `src/styles.css`: クラフト/かまどパネル、12枠ホットバーの表示を追加。
- 確認: `npm.cmd run check` 成功。ブラウザ確認でキャンバス表示、ホットバー12枠、`B` でクラフト12レシピ、`F` でかまど3レシピ、console errorなし。
- 未実装: 採掘時間、道具耐久値、アイテム一覧画面の整理は次回以降。

## 2026-06-26 追記: Minecraftらしい一人称操作感の追加

- フィードバック: 機能は増えたが、手や道具が見えず、Minecraftっぽくない。
- `src/game/parts/52-raycast.js`: 左クリック即時破壊をやめ、左クリック長押し採掘へ変更。ブロック硬度、道具種別、道具Tierによる採掘時間差、採掘ゲージを追加。狙いが外れる/クリックを離すと採掘はリセットされる。
- `src/game/parts/57-first-person-hand.js` を追加。画面右下に一人称の手と持ち物を表示。通常時は選択中ブロック、採掘中は対象ブロックに合うツルハシ/斧/シャベルを所持していれば表示する。
- `src/game/parts/58-third-person-view.js` を追加。`N` で一人称/三人称を切り替え、三人称ではブロック調のプレイヤー本体と持ち物を表示する。ブラウザの `F5` はリロード用に残すため使わない。
- 追加修正: 一人称の手が太い柱のように見えていたため、いったん本家Minecraft寄りのシンプルな四角い腕へ変更。通常時は青い袖＋肌色の前腕だけを表示し、選択ブロックを腕に刺さない。採掘中だけ、対象ブロックに合う道具を持っていれば道具を重ねて表示する。
- `src/game/parts/54-input.js`: 左クリック押下状態を管理し、右クリックは作業台/かまどに当たっていればパネルを開く。
- `src/game/parts/82-weather-and-loop.js`: 毎フレーム採掘進行、手/持ち物表示、三人称カメラを更新。
- `src/styles.css`: 採掘ゲージを追加。
- 確認: `npm.cmd run check` 成功。ブラウザのDOM/コンソール確認でキャンバス、ホットバー12枠、採掘ゲージDOMあり、console errorなし。
- 次のMinecraft感改善候補: ブロック破壊のヒビ割れ表示、アイテム拾得ポップ、インベントリ画面、村/チェスト/敵Mobの見た目強化。

## 2026-06-26 追記: Phase 2/3/8の入口実装

- `src/game/parts/51-survival.js` を追加。体力、空腹度、落下ダメージ、死亡時の自動リスポーン、体力/空腹HUDを実装。
- `src/game/parts/46-day-night.js` を追加。昼/朝/夕方/夜の時間を進め、太陽位置と明るさを変える。夜は暗くなり、左上ステータスに時間帯を表示する。
- `src/game/parts/39-hostile-mobs.js` を追加。夜だけ小型スライム風Mobがスポーンし、近づくとプレイヤーへダメージを与える。現在は倒す方法が未実装のため、2026-06-29追記どおり出現停止中。
- 食べ物の入口として、葉ブロックを壊すと一定確率でリンゴ相当の空腹回復が入るようにした。
- `src/game/parts/53-inventory.js` を追加。ホットバーの所持数を管理し、ブロック破壊で増え、設置で減る。`56-hotbar-ui.js` と `styles.css` で個数表示も追加。
- `src/game/parts/30-noise.js` / `32-world-window.js` / `52-raycast.js`: ワールドシード、編集済みブロック、インベントリを `localStorage` に保存/読み込みするようにした。
- 確認: `npm.cmd run check` 成功。

## 2026-06-26 追記: 音楽会場BGMをmp3専用化

- `src/game/parts/70-music.js`: 音楽会場のBGMをmp3専用に変更。mp3が無い/再生失敗した場合でも、自前シンセ曲へフォールバックせず無音にする。
- mp3専用モードではシンセのノート生成も止め、会場のビジュアル/拍クロックだけが動くようにした。
- 確認: `npm.cmd run check` 成功。

## 2026-06-26 追記: Minecraft外の動物追加

- `src/game/parts/37-animals.js`: 鹿、リス、アヒル、クマ、ハリネズミ、スズメを追加。既存の牛/羊/豚/ニワトリと同じ軽量ブロック調だが、顔・耳・鼻・羽・角・しっぽなどで遠目にも種類が分かるようにした。
- 動物ごとの行動差も追加。鹿は慎重に歩き、リスは小さく跳ねてしっぽを振る。アヒルはよちよち歩き、スズメは小刻みに跳ねて羽を動かす。クマは大きくゆっくり、ハリネズミは低く小さく止まりがち。
- スズメは地面を跳ねるだけでなく、一定間隔で短く低空飛行する。飛行中は移動速度が上がり、地面から少し浮いて羽ばたきが大きくなる。
- 確認: `npm.cmd run check` 成功。

## 2026-06-25 追記: 動物NPCの回転バグ修正

- `src/game/parts/37-animals.js`: 動物が詰まった時に毎フレーム180度反転して高速回転する問題を修正。向きを `turnTo` へ補間し、ブロック時はクールダウンを挟んで方向転換するようにした。
- 動物の上下揺れを `position.y += ...` の加算式から地面高さ基準に変更し、歩行中に浮いたり沈んだりし続けないようにした。
- 動物がタンスのように見えていたため、モデル比率を作り直し。牛は角/鼻/白模様、羊はもこもこ胴体/黒い顔、豚は鼻/耳、ニワトリはくちばし/トサカ/羽を追加して、低く横長のかわいいブロック調に寄せた。
- 追加調整: 羊の黒い顔が大きく怖く見えていたため小顔化し、白目+黒目のドット顔、羊毛の段差、鼻先を追加。牛/豚も顔を小さめにして、鼻・耳・目が読みやすい比率へ再調整。
- 追加調整: 動物ごとのサイズと動きを分離。牛は大きく遅い、羊は中型でよく立ち止まる、豚は小さく低くちょこちょこ歩く、ニワトリはかなり小さく素早く方向転換する。
- 追加調整: ニワトリが段差を上る時だけ短く浮き上がり、羽パーツを大きく振って少し飛ぶようにした。通常歩行中も羽が小さく揺れる。
- 確認: `npm.cmd run check` 成功。

## 進行中: Vite + Three.js構成へ分離、GitHub Pages対応

- `index.html` 単体から、Viteプロジェクト構成へ移行。
- 既存ゲーム本体は挙動を変えずに章単位で `src/game/parts/*.js` に分割。
- `scripts/assemble-game.mjs` が `src/game/parts/*.js` を結合して `src/game.generated.js` を生成する。`src/game.generated.js` は自動生成物なので直接編集しない。
- `src/main.js` は生成済みゲーム本体を読み込むViteエントリ。
- `src/styles.css` にUI/CSSを分離。
- `vite.config.js` は `base: './'`。GitHub Pages のリポジトリサブパス配信でも動くようにしている。
- `.github/workflows/deploy-pages.yml` を追加。GitHub Pages の Source を「GitHub Actions」にすると、`main` push時に `npm ci` -> `npm run build` -> `dist/` deploy。
- `scripts/copy-public-assets.mjs` を追加。`npm run build` 後に `music/` を `dist/music/` へコピーするため、Pagesでもmp3 BGMが読める。
- `.gitignore` に `node_modules/`, `dist/`, `.vite/`, `src/game.generated.js`, `.codex/logs/` を追加。

### 開発コマンド

```powershell
npm install
npm run dev
```

開発URL: `http://127.0.0.1:5173/`

```powershell
npm run build
npm run preview -- --port 4173
```

本番プレビューURL: `http://127.0.0.1:4173/`

### 確認済み

- `npm install`: 成功。Vite 8.1.0 / Three.js 0.160.1。`npm audit` は0件。
- `npm run build`: 成功。`dist/index.html`, `dist/assets/*`, `dist/music/*` 生成。`music` は29ファイルコピー済み。
- 開発サーバー `http://127.0.0.1:5173/`: HTTP 200。
- 本番プレビュー `http://127.0.0.1:4173/`: HTTP 200。
- ブラウザ確認: 本番プレビューでキャンバス表示、ステータス表示、地形/空/UI描画、console error/warnなし。
- スクリーンショット: `.codex/logs/prod-preview.png` に保存済み（gitignore対象）。

### 今後の編集入口

- `src/game/parts/32-world-window.js`: 地形生成範囲、生成窓、非同期worldJob。
- `src/game/parts/34-mesh-rebuild.js`: メッシュ再構築、ダブルバッファ。
- `src/game/parts/82-weather-and-loop.js`: 天候、メインループ、フレーム分散処理。
- `src/game/parts/60-rave-venues.js`: 音楽会場。
- `src/game/parts/70-music.js`: mp3 BGM検出/再生。
- `src/styles.css`: UI。

### 注意

- `music/` はPagesでBGMを鳴らすならコミット対象。mp3合計サイズが大きいので、GitHub容量やPages転送量が気になる場合は後で外部ホスト化を検討。
- `textures/` は変換用のHDR/中間ファイルが多く、HTMLには空画像がdata URI埋め込み済みなのでコミットしない方針。
- `gikopoi2/` と `hallucinate/` は今回も対象外。
- `window.__dbg` は削除済み。`window.__mcReady` のみ簡易確認用に残している。

## 進行中: マップ生成のバリエーション追加（2026-06-25）

- `src/game/parts/32-world-window.js` を、バイオーム/地下/構造物を持つ生成器へ更新。
- バイオーム追加: `草原`, `森林`, `砂漠`, `高地`, `雪原`。座標ノイズの heat/wet/rough から決定。
- `heightAt()` がバイオームごとに高さ・起伏・尾根の強さを変えるようになった。
- `topTypeAt()` が砂漠は砂、雪原/高高度は雪、急斜面/高地は石を出しやすいようになった。
- 地下空洞: `isCaveAt()` で地下トンネル/空洞を掘る。`caveMouthAt()` で地表近くに洞窟入口も少し出る。
- 構造物: `structurePlanForCell()` / `addStructurePlan()` を追加。セル単位で小屋、廃墟、石塔、砂漠の小神殿が出る。
- 構造物周辺では `structureAffectsColumn()` により木や草花が突き刺さらないよう抑制。
- `src/game/parts/36-plants.js` はバイオームの `flower` 係数で草花密度を変える。
- `src/game/parts/82-weather-and-loop.js` の左上ステータスに `バイオーム: ...` を追加。
- 歩行時に生成窓の端が見える問題へ追加対応。`worldJob` が走行中でも現在位置が大きくズレたら最新中心へリターゲットし、木の追加処理は新しく見える帯だけを優先するよう軽量化。`processWorldJob()` / `processRebuildJob()` の1フレーム予算は 3.2ms。
- 追加改善: `rangesOutsideRect()` / `processRanges()` を追加し、移動時の非同期生成は窓全体走査ではなく「新しく窓に入った外周帯」だけをキュー処理する方式へ変更。生成が追いつかず端が見える症状をさらに抑える狙い。
- 公開前掃除として `window.__dbg` を削除。`window.__mcReady` は簡易準備完了フラグとして残している。
- 重さ対策: 旧 `InstancedMesh(BoxGeometry)` 描画をやめ、`src/game/parts/24-instanced-meshes.js` / `34-mesh-rebuild.js` を「見える面だけを結合した `BufferGeometry`」方式へ変更。外側ブロックを丸ごと立方体で描かず、必要な面だけGPUへ送る。
- 追加の描画軽量化: `RENDER_PIXEL_RATIO=1.25`、WebGL antialias off、地形メッシュの `castShadow=false`、太陽シャドウマップ 2048 -> 1024 / far 240 -> 180。
- ブロック破壊/設置の重さ対策: `breakBlock()` / `placeBlock()` が同期 `rebuild()` を呼んでいたため、クリック瞬間に地形全体を作り直していた。いったん非同期再構築へ変更したが、破壊/設置の見た目反映が遅れたため、さらに地形メッシュを `CHUNK_SIZE=24` のチャンク単位へ分割。編集時は `requestEditedBlockRebuild()` で周辺チャンクだけ即時再構築する。
- 断面テクスチャ修正: 可視面メッシュ化後、草ブロック側面のUV向きが面ごとに揃っておらず、断面で草の縁が縦じま状に見えていた。`FACE_DEFS` に面ごとの `uv` を持たせ、`addFaceToState()` で `fd.uv` を使うよう修正。
- 描画遅れ対策: 移動時に生成が追いつかず空白が見える症状へ追加対応。`terrainRanges` / `treeRanges` とメッシュ再構築チャンクをプレイヤー近く優先でソートし、`worldJob` の地形生成が終わった時点で先に `requestRebuildAsync()` を走らせる。建物/木/掃除の完了を待たず、地形だけ先に表示してから最終メッシュへ更新する。
- 現代風マップ第一弾: 構造物生成に `road`, `busStop`, `shop`, `solar`, `antenna` を追加。自然の中に舗装路、街灯、バス停、小さな現代建物、ソーラー施設、電波塔が点在する方向。新規ブロックは増やさず、石/レンガ/雪/ガラス/板材/丸太の組み合わせで軽く表現している。
- 現代建物の見た目調整: スクショ確認で `shop` が木造小屋っぽく見えたため、白い外壁、ガラス正面、石の薄い屋根、広めの舗装、照明、駐車場ライン寄りに変更。バス停/街灯/ソーラー柵も木材を減らし、石・雪・ガラス中心に寄せた。
- 起動前マップ生成方式へ変更: 歩行中の生成スパイクを減らすため、スポーン周辺 `PREGEN_R=220` を開始画面の裏で分割事前生成する。ページ自体はすぐ表示し、`#overlay .go` に `マップ生成中... xx%` を表示。生成完了までは `startGame()` が開始を待たせ、完了後に `クリックして開始` へ戻す。事前生成済み範囲内では地形生成を走らせず、表示チャンク範囲が変わる時だけメッシュ更新する。
- ランダムワールド化: `WORLD_SEED` をページ読み込みごとにランダム生成し、Perlinノイズのpermと `hash2()` に反映。リロードするたびにバイオーム配置、起伏、洞窟、木、構造物の配置が変わる。スポーン周辺の平地だけはテストしやすいよう維持。
- 現代建物の密度アップ: 構造物セルの出現率を `chance <= 0.34` から `chance <= 0.52` へ上げ、非雪原バイオームでは現代構造物を `modern < 0.72` で優先。店舗/道路/バス停/ソーラー/電波塔が以前より多く出る。
- バイオーム分布改善: 以前は熱/湿度/荒さノイズが低周波すぎて、長距離歩いても草原が続きやすかった。`biomeAt()` のノイズスケールを細かくし、96ブロック前後の地域セルバイアスを追加。スポーン平地を抜けると森林/砂漠/高地/雪原へ到達しやすくした。
- 屋外環境音追加: `src/game/parts/44-sound-effects.js` に `ENV` を追加。屋外ではマインクラフト風の静かな生成BGM、雨音ノイズループ、雷SEをWeb Audioで鳴らす。会場中は環境音をフェードダウン。前回決めたSunoテーマに合わせ、`ambient-grass-1.mp3`, `ambient-night-1.mp3`, `ambient-rain-1.mp3`, `ambient-cave-1.mp3`, `ambient-snow-1.mp3`, `ambient-sunset-1.mp3`, `ambient-modern-1.mp3` のテーマ名付き連番を推奨。旧 `ambient-1.mp3` から `ambient-7.mp3` も互換用に検出する。屋外mp3 BGMは常時ループではなく、Minecraft風に無音時間を挟んでたまに再生する。mp3が無ければ内蔵生成BGMにフォールバックする。

### 確認済み

- `npm run build`: 成功。
- 追加確認: `npm run check` 成功。開発サーバー `http://127.0.0.1:5173/` でキャンバス表示、console error/warnなし。
- 追加確認: `npm run check` 成功。開発サーバーを `http://127.0.0.1:5173/` で再起動し、キャンバス表示、左上ステータス表示、`window.__dbg` 不在、console error/warnなし。
- 追加確認: `npm run check` 成功。可視面メッシュ化後、開発サーバー `http://127.0.0.1:5173/` で起動、開始後の地形/空/UI表示をスクショ確認。初回実装時の古い `RangeError` は配列結合修正で解消済み。
- 追加確認: `npm run check` 成功。ブラウザで開始後に左/右クリックのスモークテスト、ページ側 console error/warnなし。
- 追加確認: `npm run check` 成功。チャンクメッシュ化後、開発サーバーで起動、開始後に左/右クリックのスモークテスト、ページ側 console error/warnなし。
- 追加確認: `npm run check` 成功。開発サーバー `http://127.0.0.1:5173/` でリロード、キャンバス表示、開始後の地形/空/UI表示、ページ側 console error/warnなし。
- 追加確認: 現代風構造物追加後 `npm run check` 成功。開発サーバー `http://127.0.0.1:5173/` でキャンバス表示、ページ側 console error/warnなし。
- 追加確認: 現代建物の見た目調整後 `npm run check` 成功。
- 追加確認: 起動前マップ生成化後 `npm run check` 成功。ブラウザでロード約2.2秒、開始画面に `マップ生成中...` 表示、約12秒後に `クリックして開始`、クリック開始OK、ページ側 console error/warnなし。
- 追加確認: ランダムシード化＋現代建物密度アップ後 `npm run check` 成功。
- 追加確認: バイオーム分布改善後 `npm run check` 成功。
- 追加確認: 屋外環境音追加後 `npm run check` 成功。雨/雷は `G` キーで雨へ切り替えて確認する。
- 追加調整: 雨音が大きすぎたため、`src/game/parts/44-sound-effects.js` の雨ノイズ音量を `rainAmount * 0.42` から `rainAmount * 0.18` に下げた。
- 追加調整: 雷SEを短い高域ノイズの稲妻音 + 遅れて入る低域ノイズ/サイン波のゴロゴロ音へ変更。単発の低いSEより雷らしく聞こえる狙い。
- 追加調整: 移動時の重さ対策として、表示窓がチャンク境界をまたいだ時の地形メッシュ再構築を全表示チャンク再構築から「新しく視界に入った外周チャンクだけ」へ変更。`requestRebuildWindowMove()` を追加し、生成済み範囲内の移動や範囲外生成完了時に使う。
- 追加調整: 雨音をさらに `rainAmount * 0.075` へ下げ、屋外mp3 BGMも晴天時0.20/雨天時0.13へ下げた。環境音として、草原/夕方の小さな鳥、洞窟の水滴、雨/雪原の風を間欠的に鳴らす処理を追加。
- 追加修正: 移動時の差分再構築で古い境界チャンクや外側チャンクが残り、地形が切れた崖/浮遊パーツに見える問題へ対応。新規外周チャンクの周辺1チャンクも再構築し、再構築中に窓が更新された場合は古い外側チャンクを即時破棄し、ジョブが外側チャンクを再生成しないよう範囲チェックを追加。草花も `topTypeAt(...) === GRASS` の時だけ配置するよう強化。
- 追加実装: `src/game/parts/37-animals.js` を追加し、Minecraft風のブロック調動物NPCを実装。牛、羊、豚、ニワトリが草原/森林/雪原の近くに軽量スポーンし、ゆっくり歩き回る。遠距離個体は自動整理し、会場中は新規スポーンしない。
- 開発サーバー `http://127.0.0.1:5173/`: キャンバス表示、左上に `バイオーム: 草原` 表示、console error/warnなし。
- 本番プレビュー `http://127.0.0.1:4173/`: キャンバス表示、左上に `バイオーム: 草原` 表示、ページ側console error/warnなし。

最終更新: 2026-06-24

## ⏳ 進行中（2026-06-24）：雲を実写テクスチャ化（リアルな空）＋ file:// 対応（未コミット）

ユーザー要望「雲を無料テクスチャでリアルにしたい」→ **Poly Haven の CC0 equirectangular 空 HDRI** を採用し、手描きの雲を実写パノラマに置換。すべて `index.html` のみ（＋ `textures/` に変換用の素材・スクリプト）。**ユーザー確認OK（晴れ・曇りとも良い感じ）。まだ未コミット。**

### 追加変更（2026-06-25・引き継ぎ後）
- 音楽会場キーを数字キーに変更済み：`1`〜`8` が会場、旧 `R/T/Y/U/I/O/P/[` はエイリアスとして併存。ブロック選択はマウスホイール＋ホットバークリックに変更。
- 読み込み範囲をさらに拡張：現在は `WIN_R=108`, `STEP=8`、屋外天候のフォグ `far` は快晴/晴れ=70、曇り=68、雨=60。`far <= WIN_R - STEP` を維持して地形端のポップインを隠す方針。
- 歩行中に一定距離ごと一瞬止まる対策として、`regenWindow()` を全消し再生成から差分更新へ変更。新規 `generateTerrainColumn()` / `addTreeAt()` を追加し、移動時は窓外の列だけ削除、新しく入った列だけ生成する。`requestRebuildAsync()` / `processRebuildJob()` は「座標スキャンだけ」を分散し、完成後にメッシュと草花を一括反映する方式。途中反映で草だけ浮く/地形が欠ける見た目を避けるため、メッシュ書き込みの分散反映はやめた。破壊/設置の `rebuild()` は即時反映のまま。
- 追加調整：地形端の断面が見えたため `WIN_R=108`, `STEP=8`、屋外フォグは快晴/晴れ=70、曇り=68、雨=60へ拡張。再び停止が目立ったため、ブロックメッシュを表/裏のダブルバッファに変更。`processRebuildJob()` が非表示の `standbyMeshes` に分散書き込みし、完成後に `swapStandbyMeshes()` で表示を入れ替える。`MAX=120000`。

### 何をしたか（`index.html`）
1. **手描き雲を実写パノラマ空ドームに置換**（`makeCloudPano`/`cloudDome`＝雲ドーム、頭上の `clouds` プレーンは `visible=false` で無効化。コードは残置）。
   - `photoSky`（晴れ用）＋ `photoOvercast`（曇り用）の2つの BackSide 球ドーム（半径760, `fog:false`, `depthWrite:false`）。`SUN_OFFSET` 付近の `const SKY_ROT_Y = 2.7` で写真のベイク太陽を太陽方向に合わせる回転。
   - テクスチャは**JPEGをdata URIでインライン埋め込み**（`const SKY_DAY_URI` / `SKY_OVERCAST_URI`、`_texLoader`直前）。→ **外部ファイル不要なので `file://` で直接開いても動く**（ユーザー要件）。元PNGは大きいのでブラウザでJPEG化(2048×1024, q0.85, 各~60〜120KB)。
   - 読込中の黒画面防止：`let skyReady`＝写真デコード完了フラグ。`updateWeather` で `photoSky.visible = skyReady`、未完了時は背後の青いグラデ `skyDome` を見せる。
2. **天候連動（晴れ↔曇りクロスフェード）**：`updateWeather` 内で `photoSky` はカメラ追従・固定（太陽整合のため）、`photoOvercast` はゆっくり回転＋`overcastK`（`gray`/`cloud`から算出）で opacity クロスフェード。明るさは `photoSky.material.color.setScalar(0.86+0.16*glow)` / overcast `0.86+0.14*glow`。
3. **採用した空**（CC0・クレジット不要）：
   - 晴れ＝`kloofendal_48d_partly_cloudy_puresky`（青空＋ふわふわ積雲）。露出 **1.2** で焼き出し（明るめ。ユーザー「もっと明るく」を反映）。
   - 曇り＝`overcast_soil_puresky`（一面のグレーの雲＝教科書どおりの曇天）。露出 0.8。
   - ※ `_puresky` 系は地面が写らないので自前地形と干渉しない。
4. **地形ポップイン（遠景の白い木）対策**＝**フォグ色を各空の地平線色に一致**させるのが肝。実測色: 快晴`#a3acbb`/晴れ`#9fa9b9`/曇り`#9d9d9c`/雨`#8f8f8e`。フォグに完全に染まった遠景地形が空に溶けてシルエットが消える。
   - 併せて `WIN_R=34, STEP=16 → STEP=8`、`far 33→26`（窓サイズ据え置きで再生成ヒッチは小さいまま、進行方向の地形端を常にフォグ外≤26に保つ）。視界は短く靄っぽくなるトレードオフ（ユーザー承諾済み）。
5. **確認用キー `G`**：押すたび天候を 快晴→晴れ→曇り→雨 と手動切替（屋外のみ。会場中は天候停止）。`addEventListener('keydown')` の `KeyM` の下。

### 確認方法（重要・前回同様タブがバックグラウンド）
プレビュー(localhost:8123)は `document.hidden=true`・幅数pxで rAF が止まり **preview_screenshot 不可**。代わりに **render-to-PNG**：`window.__dbg`(THREE,scene,player) を使い preview_eval 内で新規 `WebGLRenderer({preserveDrawingBuffer:true})` を作ってスポーンから空をレンダ→`toDataURL`→ローカルsink(`textures/sink.js` ポート8124)へPOST→`Read textures/rtest.jpg` で目視。露出/色の調整もこの方法で詰めた。

### 変換パイプライン（`textures/`、すべてdev用＝ページには不要）
- `hdr2png.js <in.hdr> <out.png> <exposure> <scale>`：Radiance .hdr(RGBE)をデコード→露出トーンマップ(`1-exp(-k*v)`)→sRGB→PNG（依存ゼロ・zlibのみ）。
- `sample2.js <in.hdr> <expo>`：地平線/lowsky帯の平均色を実測（フォグ色合わせ用）。
- ブラウザで PNG→JPEG 再エンコード（`createImageBitmap`→canvas→`toDataURL('image/jpeg')`）して `sink.js` で保存。
- `reinline2.js`：`sky_day.jpg`/`sky_overcast.jpg` を base64化して `index.html` の `SKY_DAY_URI`/`SKY_OVERCAST_URI` を置換（正規表現）。

### 残タスク / 調整ノブ
- **未コミット**。気に入ったら `index.html`＋`HANDOFF.md` をコミット。
- **コミット前の掃除**：`textures/` の HDR（計~30MB）・中間PNG/JPG・dev用 .js（hdr2png/sample2/sink/reinline2/hdr2png系prev等）は**ページに不要**（テクスチャはHTMLに埋め込み済み）。`.gitignore` するか削除。**HDRをリポジトリに入れない**こと。
- **`window.__dbg` の削除は完了**（Vite分割後の `src/game/parts/82-weather-and-loop.js` から削除済み）。
- 調整ノブ：明るさ＝`hdr2png.js` の露出（晴れ1.2→上げると雲白飛び）／曇天ドーム係数。視界＝`far`（26→上げると木が見え始める）／`STEP`。フォグ色＝各天候の `fog`（空の地平線色に合わせる）。太陽方位＝`SKY_ROT_Y`。
- 嵐っぽい雨空にしたいなら曇り/雨テクスチャを `kloppenheim_07_puresky` 等に差し替え可（DL済みHDRが `textures/` にある）。

---

## ⏳ 進行中（2026-06-23）：空・天候・会場の夜空・花火の刷新（未コミット）

このセッションの作業。**すべて `index.html` のみ**（＋ `music/bass-1〜3.mp3` 追加）。`bass` 会場のmp3は配置済みで自動検出OK（probe精度: bass=3確認、BPM 172/178/166 が SONGS/SUNO_PROMPTS と一致）。

### ⚠️ 確認方法が特殊（重要）
プレビュータブは常に**バックグラウンド**（`document.hidden=true`, 幅1px）で requestAnimationFrame が止まり、**preview_screenshot は使えない**。そこで「手動レンダリング→PNG焼き出し」で見た目を確認した:
- 当時は `index.html` 末尾に `window.__dbg = { THREE, scene, player, buildRaveVenue, RAVE, EYE }` を仕込んで確認していた。現在は削除済み。
- 受信用に node サーバ `/tmp/imgsink.js`（ポート8124, CORS許可, POSTされたdataURLを `/tmp/sky.jpg` に保存）を起動 → `node /tmp/imgsink.js &`
- preview_eval で `buildRaveVenue('forest')` → grpをscene追加・`sky.visible`相当を消し（`o.scale.x>5000`=THREE.Sky, radius500=skyTint, LineSegments=rain, y>60のPlane=clouds を一時非表示）→ 新規 `WebGLRenderer({preserveDrawingBuffer:true})` で空を見上げてレンダ → `toDataURL` を imgsink にPOST → `Read /tmp/sky.jpg` で目視。
- これでタブが裏でも実際の描画を確認できた（白飛び＝Sky消し忘れ等のバグもこれで発見）。

### 実装した内容
1. **会場看板の被り解消（全8会場）**: `TRANCE` 等の看板がDJ/観客に重なっていたのを、ブース上空バナー位置（y≈3.0〜4.1）へ引き上げ＋拡大（`makeSign` 呼び出し各所）。
2. **天候システム（屋外・ランダム）**: `animate()` 直前に `WEATHER`/`updateWeather(dt)`。快晴/晴れ/曇り/雨を 35〜85秒ごとに抽選し τ=7s で滑らかに遷移。Sky(turbidity/rayleigh/mie)・フォグ色/濃さ(farは生成窓34の内側で境界隠し維持)・太陽/環境光・雲・雨パーティクル(`rain` 1100本のLineSegments)・曇天の灰色ドーム(`skyTint` 半径500)・雷(`lightning`)を連動。HUDに天候表示。**会場(RAVE.on)中は冒頭で return して停止**。
3. **会場の夜空＝深宇宙（全8会場・会場色に連動）**: `buildVenueSky(grp,kind,cfg)` を `buildRaveVenue` 冒頭で呼ぶ。
   - `makeStarfield(R)`: 等級べき分布＋色温度（青白/白/黄/橙）＋天の川の帯＋淡い星雲を1つのBufferに（MAIN1300/BAND520/NEB150）。`STAR_VERT`/`STAR_FRAG` のカスタムPointsシェーダで**丸いグロー＋星ごとのまたたき**（uniform `uTime=beat`,`uEnv`,`uOpacity`、role `nightStars` で更新）。※当初 `smoothstep(0.5,0.0,d)` の引数逆で星が四角くなるバグ→ `1.0-smoothstep(0.0,0.5,d)` で修正。
   - グラデーションのスカイドーム(半径110, fog無効): 天頂ほぼ漆黒→地平線に**会場色(hue)のグロー**。会場ごとに色が変わる（ユーザー要望で必須）。
   - `addDeepSpace(grp,hue)`: 天の川のコア(暖白スプライト)＋明るい芯14枚／カラフル星雲(マゼンタ/青/紫…加算スプライト)／渦巻銀河4／十字輝星5／**環のある惑星＋衛星3**。テクスチャは `ensureSkyTextures()` で雲/銀河/輝星を**1度だけ生成し共有**（`SKY_SHARED_TEX`、`disposeRaveGroup` で破棄除外）。惑星は `makePlanetTex` の縞＋焼き込み陰影をBasicに（暗い会場でも見える）。
   - 流れ星 `RAVE.meteors`（プール6・`updateVenueSky` で2〜6.5秒ごと発火）。
   - **forest会場の旧・四角い星空(240点PointsMaterial)＋青い内ドームは削除**（新システムと重複し空を青くwashするため）。
4. **打ち上げ花火の刷新**: 破裂高度を約3.9→**16〜30**に（夜空まで上昇、fog無効でクッキリ）。`FW_TYPES` 8種(peony/chrys/willow/ring/palm/crackle/double/rainbow=形・色・重力・寿命・またたき)＋上昇の尾＋破裂フラッシュ＋尾を引く火花。`updateVenueSky` で4.5〜9.5秒ごと自動＋ドロップ(section16/28)で2〜3発。ジオメトリ共有維持（`FW_TRAIL_GEO` 追加、`FW_SPARKS=26`）。

### 現在の見た目の状態（render-to-PNGで確認済み）
- forest: 漆黒に丸い星・十字輝星・柔らかい天の川・環の惑星でリファレンス方向にOK（ユーザー「かなり良くなった」）。会場色を戻したのでやや青緑寄り。
- future: マゼンタ寄りの宇宙。※カラフル星雲が**加算で飽和して板状に見える**場合があり opacity を 0.2〜0.4 に下げた（要再確認）。

### 残タスク / 調整ノブ
- **`window.__dbg` は削除済み**。
- 星雲の飽和（future等の板状）が残るなら opacity/サイズをさらに調整。
- 天の川をもっと「明るい川」にする・星雲をより鮮やかに、等はユーザー好み次第。
- 天候の雨頻度/強さ、雷頻度の調整余地。
- まだ commit/push していない。気に入ったところで `index.html`＋`music/bass-*.mp3`＋ドキュメントをまとめてコミット。
- 保留: forest会場「内部」の装飾アップ（夜空とは別）。



## ✅ 完了：Suno生成mp3の会場BGM統合

**経緯**: 自前Web Audioシンセで「曲ごとに別アレンジ」を作り込んだが「同じ曲に聞こえる」（手続き生成の限界）。→ **本物の別曲は Suno生成mp3** を会場BGMとして鳴らす方向に決定し、**実装・動作確認まで完了**。

### 実装した内容（`index.html`）
- `MUSIC` オブジェクト＋ヘルパー群（`raveOff` 直前）。会場を開くと `music/<kind>-N.mp3` を `createMediaElementSource` 経由で再生。
- **ビートクロック方式**：mp3再生時も自前スケジューラは回したまま、`RAVE.master`(out)ゲインを0にして無音化（HANDOFFの推奨どおり）。`RAVE.bpm` は曲番号=`SONGS`順に一致（SUNO_PROMPTSのBPMと整合）。mp3ループ/再開時に `resyncBeatClock()` で拍を再同期。
- **Q/E**で全mp3を巡回（`venueTrackCount`=`max(synth曲数, mp3数)`なので laser-4/5・future-4 にも届く）。会場切替/Off時はフェードアウト、距離で減衰（`MUSIC.distGain`）。ポーズ中はBGMも停止。
- **graceful degradation**：mp3が無い会場（現状 `bass`=DRUM&BASS）は自前シンセにフォールバック（`onMusicFail`/`muteSynth(false)`）。
- **将来の追加に強い**：起動時 `probeMusic()` でHEAD走査（1から連番、最初の欠番で打ち切り、`MUSIC.max=12`）。会場を開くたびに `probeMusicKind()` で裏再走査。コンソールから `rescanMusic()` で手動再走査（リロード不要）。**`music/` に `<kind>-N.mp3` を足すだけで自動で増える**。

### 検証済み（preview, python http.server）
- プローブ精度：classic/neon/forest/chill/dub=3, laser=5, future=4, **bass=0**。
- Classic ON → `classic-2.mp3` 再生・synthゲイン0.0001（ミュート）。Q/E → `classic-3.mp3` 頭出し。bass ON → mp3なし・synthゲイン0.42（フォールバック）。コンソールエラーなし。

### 残メモ
- **bass（O / DRUM&BASS）のmp3が未配置**。`music/bass-1.mp3`〜を置けば自動でBGM化（リロードで反映、または `rescanMusic()`）。プロンプトは [music/SUNO_PROMPTS.md](music/SUNO_PROMPTS.md) のO項。
- laser-4/5・future-4 はSUNO_PROMPTSに無い余剰曲。BPM未知のため `RAVE_VENUES[kind].bpm` を流用（ビート同期は近似）。気になるなら正規BPMを `SONGS` に追記。
- ライセンス: Suno有料プランの公開可否はユーザー確認済み前提。
- サイズ: mp3合計が大きい（~110MB）。gh-pagesが重い/超過するなら外部ホスト/圧縮を検討。

## ✅ 完了：NPCダンス拡充・会場クオリティUP・ミュート機能（2026-06-22）

- **ダンス技追加**（`MOVES`）：MJ風 `moonwalk`/`mjkick`/`mjspin`/`mjlean`、ブレイク `toprock`/`footwork`/`breakfreeze`（※`windmill`/`headspin`は見た目NGで没）。
- **NPCの個性**：`DANCER_PERSONAS`（breaker/mj/raver/groover/popper/freestyle）＋シグネチャー技＋テンポ倍率を各ダンサーに付与（`makeDancer`）。grooverが多め・breaker/mjは少数で目立たせる。選曲は会場プール＋ペルソナをブレンド。
- **視点バグ修正**：会場でフレームが詰まると`movementX`が巨大化し視点が飛ぶ→1イベント±120pxにクランプ（`mousemove`）。
- **ミュート機能**：`M`キーで全体ミュート/解除（`setRaveMuted`、シンセ・mp3まとめて）。`RAVE.muted`。
- **会場クオリティUP（全8会場・4方向＝照明/構造/ビート同期/群衆）**：1会場ずつ仕上げる方針で全会場に装飾追加。重いライトは増やさず**発光メッシュ中心**（パフォーマンス配慮）。
  - forest=星空(Points)＋光の柱(`tranceBeam`)＋トラスアーチ＋DJステージ＋二重結晶。新ロール `starfield`/`tranceBeam` を `updateRaveBeatObjects` に追加。
  - classic=倉庫柱/パーライト/サブ壁、neon=街灯/センターライン/夜景、laser=ミラーボール放射ビーム/LEDピラミッド/金縁、future=雲/中央クリスタル/虹アーチ、bass=奥行きフープ/サブ壁、chill=フェアリーライト/植物/窓/本棚、dub=サブ壁/パイプ/ハザード灯/スクリーン。
  - 検証：全8会場をミュートで巡回しビルド＋updateにコンソールエラーなし。
- **次の候補**：各会場の見栄え微調整（ユーザー確認待ち）、bass mp3配置、commit/push。

## 現在の状態

- 作業ブランチ: `main`
- 主な変更ファイル: `index.html`（mp3再生システム）, `README.md`, `HANDOFF.md`、新規 `music/`（mp3＋README/プロンプト）
- 上記ファイルは未コミット変更あり
- 自前シンセ（B-2〜B-2拡張2）は**フォールバックとして残す**方針に確定（mp3が無い会場・読込失敗時に鳴る）。
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

### 会場キーHUDとドキュメント更新

- `R/T/Y/U/I/O/P` の会場キー一覧を画面左下に常時表示
- 現在出ている会場のキーが光るようにして、切り替え状態を分かりやすくした
- 会場キー一覧をクリック/タップ操作にも対応
- 左上ステータスに会場名、曲番号、BPM、NPC入場状況を表示
- キー処理を `RAVE_KEY_BINDINGS` から引く形に整理
- 右上の会場表示も `RAVE_KEY_BINDINGS` 由来のキー一覧を表示するように変更
- `README.md` の音楽会場モードを `I/O/P` 追加会場まで更新

### O会場の屋根高さ修正

- `O` の `DRUM BASS TUNNEL` で、DJ/NPCの頭が屋根にかぶらないように天井板を `y=2.8` から `y=3.95` へ上げた
- トンネル左右の壁と発光リブも同じ高さに合わせて、低い天井に見えないよう調整

### 観客リアクション/参加ダンス/拍同期ギミック

- サビ/ドロップの小節境界で `launchCrowdReaction()` を呼び、観客NPCが波のようにジャンプ、手上げ、外側へ広がる演出を追加
- 観客リアクション時に `RAVE.cheers` の発光粒子が円形に広がり、歓声っぽく見えるようにした
- 会場内にプレイヤーが立つと近くのNPCが少しプレイヤー側を向き、`Z/X/C/V` を押すとプレイヤーダンス状態になって同じ動きを真似するようにした
- Future Bassの浮遊島、DNBトンネルの発光リブ/壁、Lofiの月/ランプを `trackRaveObject()` で追跡し、拍やサビに合わせて上下/明滅/光の波を出すようにした
- 会場外周に音ブロック風の小ブロックを追加し、キックやサビで伸びたり光ったりするようにした
- 床タイルとゲート/ゲートビームもキックやサビに合わせてスケール変化するようにした

### スポーン周辺の会場テスト用平地

- 原点周辺を固定スポーンに変更
- `SPAWN_FLAT_R = 28` の範囲は高さ `SPAWN_GROUND_Y = 12` の草地に固定
- `SPAWN_CLEAR_R = 38` の範囲は木と草花を生成しない
- 平地の外側は自然地形へ滑らかにつなぐようにした

### DJ操作

- テスト用の `N/B/M/G/H` ショートカットは削除
- `Q/E` で同じ会場の曲を前後に切り替え
- `J` でDJフィルターのスイープを発火
- `K` でクラッシュシンバル/サブドロップ/観客リアクションを発火
- `L` で短い1拍ループロールを発火
- 左上ステータスに短時間 `DJ: NEXT TRACK/FILTER SWEEP/CRASH/LOOP ROLL` などを表示

### 観客盛り上がりゲージ

- 右上に `CROWD HYPE` ゲージを追加
- DJ操作、プレイヤーダンス、サビ/ドロップ、会場内にいることに応じて少しずつ上昇
- 時間経過で少しずつ減少
- 満タンになると `HYPE MAX` を発火し、観客リアクション、クラッシュ/サブドロップ、照明/ストロボ増量、上空花火を発生
- `HYPE MAX` には短いクールダウンを設け、連続発火しすぎないようにした

### 花火演出

- `launchFireworks()` / `updateFireworks()` を追加
- 花火は会場グループ内にロケットを打ち上げ、一定時間後に多数の発光粒子へ分裂してフェード
- `HYPE MAX` 時は複数発、DJクラッシュ `K` では小さめに2発打ち上げ
- 会場を消すとグループごと削除されるため花火も残らない

### 気持ちよさ演出

- DJ操作/プレイヤーダンスで `GROOVE` コンボが伸び、HYPE上昇量が少し増えるようにした
- 画面中央に `NEXT MIX` / `FILTER` / `CRASH` / `LOOP` / `GROOVE FEVER` などのポップテキストを表示
- `screenPulse` を追加し、DJクラッシュやHYPE MAXで画面全体に短い発光フラッシュを出す
- `launchShockwave()` / `updateShockwaves()` を追加し、DJクラッシュ、ループロール、強い観客リアクションで床を走る発光リングを出す

### 音楽の本格化 Push 1（ミックス/マスタリング＋ステレオ化）

YouTube的な“ちゃんと作られた”質感へ近づけるため、音作りの土台を強化（自前シンセ強化方針）。

- 会場ごとのマスターチェインを刷新（`raveStart` 内）
  - 不要超低域カットの highpass（30Hz）
  - 低中域の濁りを軽く抜く peaking（290Hz, -2.2dB）
  - 高域の空気感の highshelf（9kHz, +3.2dB）
  - 全体をまとめる glue コンプ
  - 倍音を足す `makeShaper(0.55)` のサチュレーション
  - ブリックウォール風リミッターで音圧/グルー
  - 旧 `comp` 1段は上記チェインに置き換え。`out` の到達ゲインは 0.5→0.42 に下げてヘッドルーム確保
  - 信号経路: `out → HP → peaking → highshelf → glue → sat → djFilter → limiter → distGain → destination`
  - `djFilter`（DJスイープ用LPF）と `distGain`（距離減衰）は従来通り機能
- ステレオ化
  - ディレイを単一→**ピンポンステレオディレイ**（左右クロスフィードバック＋ハードパン）に変更。`RAVE.delay` は送り先の `dL`
  - `vSuper`（パッド/リード/アルペジオ）のユニゾン各声部を左右に展開（`opt.spread` 既定0.72）→ 厚み/広がり
  - `vHat` を左右ランダム定位、`vClap` の3連トランジェントを左右に振り分け
### 音楽の本格化 Push 2（“どのスピーカーでも分かる”音作り）

Push 1（マスタリング/ステレオ）は内蔵スピーカーだと地味で体感差が小さい、というフィードバックを受けて、機種を問わず効く要素を強化。

- サイドチェイン（ポンプ感）を強化（`duckTrigger`）
  - 回復カーブを linear→`setTargetAtTime` の指数回復にして“ブレス感”を強調
  - 上限 0.95→0.96、各会場の `duck` 値を一段引き上げ（例 future 0.62→0.74, classic 0.55→0.66, chill は控えめ 0.22→0.34）
- キックにノイズの“ビーター”トランジェント層を追加（`vKick`）→ 小型スピーカーでも抜ける
- ベースにサチュレーションを追加（`vBass`、`makeShaper(opt.drive ?? 1.25)`）→ サブだけに頼らず倍音で太く、スマホ/ノートでも聞こえる
- `makeShaper` のカーブを k ごとにキャッシュ（`shaperCurve`）。ベースで毎ノート生成しても軽い

確認: モジュール構文OK / リロード後 I(Future)・O(DnB) 起動でランタイムエラー無し（音は要試聴）。

⚠️ 試聴時の注意: ローカルプレビュー（localhost:8123）を**ハードリロード**（Ctrl+Shift+R）して会場を開き直すこと。GitHub Pages 公開版はまだ push していないので旧音のまま。

### 音楽の本格化 Push 3（作曲レイヤー導入 — トランス会場をArmin van Buuren風に）

「ミックスではなく“作曲そのもの”が問題（メロディ/フックが無い・ハーモニーが原始的・展開が音量だけ）」というユーザー指摘を受け、**“何を鳴らすか”を決める作曲レイヤー**を新設。ユーザーの好み（Armin van Buuren）に合わせ `forest`（TRANCE DOME）を題材に実装。著作権セーフのため、**進行は王道（保護対象外）を使い、主旋律はその進行に乗るオリジナル**を作曲。

- 作曲レイヤー（`const SONGS` の直前に追加）
  - `mtof`（MIDI→Hz）、`SCALES`（minor/major）、`degToFreq`/`leadFreq`（スケール度数→Hz、常にキー内）
  - `padVoicing`：コードにadd9＋オクターブを足してトランスらしい広がり
  - `TRANCE_LEAD`：8小節×16分の主旋律フック（数字=スケール度数 / `.`=休符）を文字列で定義しparse。前半=問い、後半=オクターブ上の応え。i–VI–III–VII に乗る“歌える”原曲
- `forest` の3曲に `key`/`scale`/`lead: TRANCE_LEAD` を付与（A/E/A minor）。3曲目の進行を Am F Dm **G**（Emaj→G）に変更してスケール内に統一し、同じフックが転調して乗るように
- `stepTrance` を全面改訂
  - イントロ(section0-7)はフック無し → **ブレイク(8-)で静かに登場 → ビルドで明るく → ドロップ(16-23)で全開**、と戻ってくる構成
  - リードはディレイ＋リバーブの効いた7声スーパーソウ。サビはアルペジオを控えめにして主旋律を立たせる
  - ローリングのオフビート・ゲートベース、オフビートのオープンハット、add9パッド

確認: モジュール構文OK＋度数→Hzの値検証（deg4=659.26/E5, deg7=880/A5, deg9=1046.5/C6）。ブラウザで Y(TRANCE DOME) を17秒走らせ、ブレイク〜ビルドの主旋律登場までエラー無し（音は要試聴）。

⚠️ 試聴: localhost:8123 をハードリロード → クリック開始 → **Y** で TRANCE DOME。最初の数小節はイントロ（旋律なし）、**十数秒後のブレイク〜ドロップで主旋律フックが鳴る**のがキモ。

### 音楽の本格化 Push 4（新会場: DUBSTEP LAB / Skrillex風）

ユーザー要望「ドラムンベースとかdubstep会場も作りたい」を受け、**新規に dubstep 会場を追加**（DnBは既存の `bass`=O 会場）。著作権セーフのため進行は王道＋オリジナルの低音リフ。

- 新キー割当 `[`（BracketLeft）→ `dub`。`RAVE_KEY_BINDINGS` に追加（HUD/ドックは自動で8会場に）
- `RAVE_VENUES.dub`（DUBSTEP LAB, 140BPM, hue0.85マゼンタ, checker, dancers15, lasers8）、`RAVE_FX.dub`、mood、`MOVE_POOL.dub`（headbang/stomp/robot系）を追加
- `SONGS.dub` 3曲（E/A/D minor）。各曲に `key`/`scale`/`lead: DUB_RIFF`/`screech: DUB_SCREECH`
- 作曲データ: `DUB_RIFF`（低音グロウルの度数リフ）、`DUB_WOBBLE_RATES=[4,8,6,3]`（小節ごとにワブル速度を変えて“喋る”感じ）、`DUB_SCREECH`（高域の金属スクリーチ）
- `stepDubstep`: **ハーフタイム**ドラム（キック=1拍/スネア=3拍）。ドロップ(chorus)で `vDubWobble` のうねるグロウル＋スクリーチ＋ボイスチョップ。イントロ/ビルドはシンプルなサブ＋ライザー＋スネアロール。`scheduleStep` に分岐追加
- **【フィードバック反映】dubstep特有の“刻んだうねり”が無い** → 専用音源 `vDubWobble` を新設。原因は音が短すぎてLFOがうねる前に切れていたこと。修正点:
  - 1音を**半小節(2拍)保持**し、その間テンポ同期した**1本のLFOでレゾナント・ローパスと音量ゲートを同位相に揺らす**（音量を0..1に刻む＝「ウェウェウェ」）
  - うねり速度は `DUB_WPB=[2,4,2,3]`（1拍あたりのワブル回数）で小節ごとに変え、後半(s=8)は倍速にして“喋る”動き。`lfoHz = bpm/60 * wpb`
  - サチュレーション(`makeShaper(2.0)`)で凶悪な倍音、サブもゲートを通して低域ごと刻む
- **【再フィードバック】「もっとがっつり刻んでSkrillex風に」** → `vDubWobble` をさらに強化:
  - 音量ゲートを**サインからスクエアLFOに変更**（0↔最大をハードに刻む＝がっつり）。フィルター掃引は別のサインLFOで担当（音色のうねり）
  - **2段の強い歪み**（`makeShaper(8)`→`makeShaper(3)`）でSkrillex風の凶悪な倍音
  - **喋るフォルマント**（バンドパスをゆっくり動かす）を本体に重ねて“声色”を付与
  - サブは歪み/フォルマントを通さず低域維持、ただし同じゲートで一緒に刻む
  - `DUB_WPB=[4,8,4,6,8,4,6,3]`（半小節ごとに刻み速度を変える）に高速化。`stepDubstep` は半小節インデックスで参照
- `buildRaveVenue` に dub の床色＋装飾（スピーカースタック×6・金属トラス・ストロボバー・DUBSTEPサイン）、`raveUpdate` の床アニメ＋ストロボ（ビート半分で強く点滅）に dub ケース追加

確認: 構文OK＋`git diff --check` OK。ブラウザで `[` 会場を27秒走らせ、ドロップ（grolwベース）到達までエラー無し。ドック8会場・キー一覧 `R/T/Y/U/I/O/P/[` 表示OK。

⚠️ 試聴: `[` で DUBSTEP LAB。**イントロは静か → 十数秒後のドロップで“ワブル/グロウル・ベース”がメイン**。

### 音楽の本格化 Push 5（既存6会場へのアーティスト別フック展開）

trance(Armin)/dub(Skrillex) と同じ作曲レイヤー方式（`key`/`scale` + 度数フックの文字列定義 + `step***()` 内で section ゲートして再生）で、残り6会場すべてにアーティスト別フックを付与。著作権セーフのため進行は王道＋主旋律はオリジナル。

- **R / classic（Charlotte de Witte風テクノ）**: `TECHNO_RIFF`（2小節ループ・root/min7/5th/min6/min3 中心の催眠的アシッド）。classic 3曲に key/scale/lead 付与（A/D/E minor）。`stepTechno` に `section` 追加＋フック（イントロ無し→ブレイクは伸ばし→ビルド→ドロップで高Qレゾナント全開、ドロップはオクターブ上）
- **T / neon（Dave Rodgers風ユーロビート）**: `EURO_HOOK`（4小節・A5〜C6のロングトーン・アンセム）。既存 EUMEL の上に重ねる。neon 3曲に key/scale/hook（A/D/A minor）。`stepEurobeat` でサビ全開＋ビルド頭拍。`duck:false`
- **U / laser（Daft Punk風ディスコハウス）**: `DISCO_VOX`（2小節・root-3rd-5th を回す "Around the World" 系）。`vVocalChop` のボコーダー風フォルマント声で、小節ごとに tone を動かして“喋る”。laser 3曲に key/scale/vox（C major）。`stepDisco` でサビ前面反復
- **I / future（Flume風フューチャーベース）**: `FLUME_LEAD`（2小節・シンコペした応答）。既存 chop に答えるデチューン強め(28)の“ワンキー”なスーパーソウ。future 3曲に key/scale/lead（C/F/G major）。`stepFutureBass` のドロップで前面
- **O / bass（Pendulum風DnB）**: `DNB_LEAD`（4小節・長音→answer の soaring topline）。低域リースの上に乗る7声スーパーソウ。bass 3曲に key/scale/lead（A/E/D minor）。`stepDrumBass` のドロップで高域に伸ばす
- **P / chill（Nujabes風ローファイ）**: `LOFI_MEL`（4小節・メジャーペンタ C D E G A・隙間を活かす）。EDM系と違い**イントロ(section<4)以外は常に流す**メインの旋律。やわらかいトライアングル＋深めディレイ/リバーブ。chill 3曲に key/scale/lead（C major）。`stepLofiHouse` に `section` 追加＋フック

確認: モジュール構文OK／`git diff --check` OK／各フックの度数→Hz を全曲 in-key・適正レジスタで検証。ブラウザ（localhost:8123 をリロード）で R/T/U/I/O/P を順に起動し、各サビ（chill は旋律区間）まで走らせて**コンソールエラーゼロ**。音そのものは要試聴。

### 音楽の本格化 Push 6（グルーヴ＋音色強化＋展開アレンジ）

「もっとアイデア」を受け、A（生っぽさ）→B（展開）の順で実装。

- **A-1 グルーヴ／スウィング＋ベロシティ揺らぎ（全会場）**
  - `SIXTEENTH` 付近に `SWING`（会場別のハネ量。house/disco/Lo-Fi/DnBはハネ、テクノ/ユーロ/トランス/dubはストレート）。`raveUpdate` のスケジューラで**奇数16分だけ後ろへずらす**（頭拍/キックは偶数なので動かさずグリッド維持）
  - `RAVE.vel`（頭拍強・裏拍弱＋微ランダム）をスケジューラで毎ステップ算出し、`vKick`/`vHat`/`vClap`/`vSnare`/`vBass`/`vStab`/`vSuper` の gain に乗算。スケジュール外の発音用にループ後 `RAVE.vel=1` に戻す
- **A-2 アシッドのグライド（テクノ）／リースベース（DnB）**
  - `vAcid`（303風：レゾナントLPF＋エンベロープ＋連続ノート間グライド）を新設。`stepTechno` のフックを `vSuper`→`vAcid` に置換し、直前ノートが2ステップ以内なら `glideFrom` でスライド（`RAVE.acidPrev`/`acidStep` で追跡、会場/曲切替時にリセット）
  - `vReese`（デチューン4声サウ＋動くLPF＋歪み＋サブ）を新設。`stepDrumBass` のドロップ主ベースを `vReese` でうならせる（ビルド/ブレイクは従来 `vBass`）
- **B-1 最終サビの転調（key change）**
  - `KEYCHANGE`（neon/forest/future/laser のみ）。スケジューラで**1サイクル(32小節)おきに、ビルド〜サビ(12-23小節)を半音2つ上げる**（`RAVE.pitchMul = 2^(2/12)`）。ピッチ系 voice（`vBass`/`vSuper`/`vStab`/`vVocalChop`/`vWobble`）に `f *= RAVE.pitchMul` を通して全パートを同時に転調（打楽器は対象外）
- **B-3 ドロップ2回目に変化（カウンターメロディ）**
  - `RAVE.cycle` をスケジューラで算出。アンセム系リード（trance/eurobeat/future/dnb）で**2サイクル目以降のサビに3度上(deg+2)のハモリ**を重ね、B-1の転調と合わさって“最終サビ”の厚いクライマックスを作る

確認: モジュール構文OK／`git diff --check` OK／転調ゲーティングをNode単体検証（cycle0=±0・cycle1の12-23小節で+2・classicは常時0）。ブラウザで全会場切替＋スウィング会場（P/U）＋アシッド(R)＋リース(O)、さらに T を**64秒走らせて2サイクル目の転調＋ハモリのドロップ**まで到達、いずれもコンソールエラーゼロ。音は要試聴。

### パフォーマンス修正（会場で時間が経つと重くなる／音が途切れる）

「音楽会場を出現させて流していると途切れたり重くなってくる」というフィードバックを受けて、Three.js 側のメモリリークと生成スパイクを修正。音源（オシレーター）は全て `.stop()` 済みで問題なし、ダンサーのフレームもキャッシュ再利用、DOMポップアップも単一要素の使い回しで、**リークは Three.js のジオメトリ/マテリアルだけ**だった。

- **原因1：音の途切れ＝花火の生成スパイク**。`launchFireworks()` が1発ごとに `SphereGeometry`＋material を35個その場で生成。HYPE MAX では4発＝**1フレームで140ジオメトリを構築**してフレームが詰まり、音楽スケジューラの先読み（当時 `0.12秒`）の隙に音が途切れていた。
- **原因2：だんだん重くなる＝破棄漏れ**。`updateFireworks()` は消えた花火をシーンから外すだけで `dispose()` していなかった。さらに `raveOff()` は `scene.remove(RAVE.group)` だけで**会場全体のジオメトリ/マテリアル/テクスチャを一切破棄しておらず**、会場を出し直すたびにまるごとリークしていた。

修正点（`index.html`）:
- 花火の火花/ロケットのジオメトリを**共有化**（`FW_ROCKET_GEO`＋`FW_SPARK_GEOS` 3サイズを `fwEnsureGeos()` で1度だけ生成し `FW_SHARED_GEOS` に登録）。毎発の大量生成をやめてスパイクとジオメトリリークを解消。火花数も 34→22（`FW_SPARKS`）に。
- 同時に存在できる花火に上限 `FW_MAX_SHELLS=8`（暴走防止）。
- `updateFireworks()` の消滅時に各 child の `material.dispose()`（ジオメトリは共有なので破棄しない）。
- `raveOff()` に `disposeRaveGroup()` を追加。`RAVE.group` を traverse して geometry/material/`material.map` を破棄。**共有花火ジオメトリだけ `FW_SHARED_GEOS` で除外**（次の会場で使い回すため）。`makeDancer`/`addBox` は毎回新規生成・グローバル共有ジオメトリ（`GEO`/`crossGeo`/`skyGeo` 等）は `RAVE.group` 外なので、traverse 破棄は安全。
- 音楽スケジューラの先読みを `0.12→0.2秒` に（フレームが多少詰まっても音が途切れにくくする保険）。

確認: モジュール構文OK／`git diff --check` OK。localhost:8123 で R 起動OK、**5会場の off→on を繰り返し（`disposeRaveGroup` を実走）＋花火K連打（4連打で上限も検証）してコンソールエラー/警告ゼロ・`gl.getError()=0`・コンテキスト喪失なし**＝会場破棄時に共有花火ジオメトリを誤って捨てていないことを確認。※スクリーンショットはプレビュータブがバックグラウンド（`document.hidden=true`）で描画停止のため取得不可。

### 音楽の本格化 B-2（曲ごとの専用フック — 全8ジャンル完了）

これまで1ジャンル=1フックを3曲で共用していた（例: `forest` の3曲が全部 `TRANCE_LEAD`）のを、**曲2・曲3に別フックを新規作曲して割り当て**、会場を出すたびの新鮮さを上げた。曲1は既存フック据え置き。著作権セーフのため進行は王道＋主旋律はオリジナルを維持。`step***()` 側は無改修（既存どおり `sg.lead`/`hook`/`vox`/`screech` を読むだけ）。

- 追加フック（各ジャンル曲2用=`*2`、曲3用=`*3`）:
  - forest: `TRANCE_LEAD2`（Em C G D・滑らか）/ `TRANCE_LEAD3`（Am F Dm G・16分駆動）
  - classic: `TECHNO_RIFF2` / `TECHNO_RIFF3`（催眠アシッドの別ローリング）
  - neon: `EURO_HOOK2` / `EURO_HOOK3`（別アンセム・トップライン）
  - laser: `DISCO_VOX2` / `DISCO_VOX3`（別ボーカル・チョップ）
  - future: `FLUME_LEAD2` / `FLUME_LEAD3`（別リード）
  - bass: `DNB_LEAD2` / `DNB_LEAD3`（別 soaring リード）
  - chill: `LOFI_MEL2` / `LOFI_MEL3`（ペンタ内の別旋律）
  - dub: `DUB_RIFF2`+`DUB_SCREECH2` / `DUB_RIFF3`+`DUB_SCREECH3`（別グロウル＋叫び）

確認: モジュール構文OK／`git diff --check` OK／**全14新フックの度数→Hz を Node 単体で検証**し、各曲の key/scale で in-key・ジャンル適正レジスタを確認（techno D3–E4、euro A#4–C6、disco C5–A5、flume F4–G5、dnb G4–F5、lofi C4–C5、dub A4–F5）。音そのものは要試聴。

⚠️ 試聴: localhost:8123 をハードリロード → 各会場を**何度か出し直す**と、3曲からランダム選曲され曲1/2/3で別フックが鳴り分かる（EDM系はイントロ無音→ブレイク〜ドロップでフック登場、chill は旋律区間で常時）。

### 音楽の本格化 B-2拡張（曲ごとに“別の曲”＝アレンジ分け — 全8会場完了）

「フックの音程だけ違っても“同じ曲”に聞こえる」というフィードバックを受け、各会場の3曲を**別アーティスト/別サブスタイルの“別の曲”**として、リードだけでなく**ドラム密度・ベースの種類/刻み・リード音色・BPM**まで作り分けた。各 `step***()` に `const arr = sg.arr || '...'` を追加し、常時鳴る芯の要素を `arr` で分岐。各 `SONGS[kind][i]` に `arr` を付与（著作権セーフ：進行は王道＋旋律はオリジナル、有名曲の流用なし。"inspired by" のサブスタイルのみ）。

各会場の3サブスタイル（曲1/2/3）:
- forest: anthem(Armin系) / emotive(Above&Beyond系・8分ベース＋プラック) / driving(テック・16分ローリング＋刻みアシッド)。BPM 138/124/145
- classic: peak(Charlotte de Witte) / rave(ハード・アシッド・16分ハット) / hypno(ミニマル・クラップ無し＋深いロングサブ)。130/140/122
- neon: super(Dave Rodgers・16分走りベース) / night(8分ベース＋triangleの柔らかメロ・残響多め) / power(歪みベース＋明るく硬いリード)。158/145/175
- laser: french(Daft Punk) / nu(クラップ前面＋明るいボコーダー) / funk(16分刻みハット)。124/116/128
- future: flume(Flume) / kawaii(オクターブ上のtriangleベル＋square・16分キラキラ) / melodic(長く温かいコード＋残響リード)。148/156/140
- bass: neuro(Pendulum・歪みリース) / jump(squareの跳ねワブル＋パンチスネア) / liquid(triangleの丸いサブ＋リード前へ・柔らかスネア)。172/178/166
- chill: jazzy(Nujabes) / boombap(J Dilla・効いたスネア＋ゴースト) / sleepy(キック弱・ハット間引き・残響リード)。110/116/100
- dub: brostep(Skrillex・可変ワブル＋スクリーチ) / riddim(一定トリプレット反復・重い) / melodic(歌うスーパーソウのトップライン＋スクリーチ控えめ)。140/150/136

確認: モジュール構文OK／`git diff --check` OK／arrフィールド24個（8会場×3）／各 step に `const arr` 定義あり。音は要試聴。
※注意: arr と曲ごとフックの“密度/音域”を一致させてある（例: rave↔busyリフ, hypno↔sparseリフ, kawaii↔高busy, melodic↔低sparse）。フック割当を変える時は arr の狙いと揃えること。

⚠️ 試聴: 各会場を何度も出し直して曲1/2/3を聴き比べ。BPMからして別物（例: neon は 145/158/175、chill は 100/110/116）。

### 音楽の本格化 B-2拡張2（主旋律をイントロから鳴らす＝“別の曲”として立ち上げる）

「arrで味付けしただけだと“同じ曲の変奏”に聞こえる。まったく別の曲にして」というフィードバックに対し、**曲を識別する主旋律がドロップでしか鳴らず、前半が全曲同じ立ち上がりに聞こえていた**のが根本原因と判明。各会場の主旋律を**イントロ(section<8)から控えめに鳴らし、ブレイク→ビルド→ドロップで全開**にして、出した瞬間に曲を識別できるようにした。トランスでユーザー確認OK→全会場へ展開。

- 実装: 各 `step***()` の主旋律ゲートを `section >= 8` 等から外し、`const im/lvl = section < 8 ? 0.5前後 : 1`（chorusは1）を gain に乗算。これで前半は土台を保ちつつ“顔”を見せる。
  - forest(trance): `im = section<8?0.5:1`（anthem/emotive/driving 各リードに乗算）
  - classic(techno): アシッドを `im=section<8?0.5:1` でイントロから
  - laser(disco): ボーカルチョップを `lvl=chorus?1:section>=8?0.8:0.55` で常時反復（"Around the World"系）
  - future: リードを `lvl=chorus?1:section>=8?0.75:0.5` でイントロから
  - bass(dnb): soaringリードを `lvl=chorus?1:section>=8?0.72:0.48` でイントロから
- 据え置き: chill は元々 section>=4 で常時旋律あり。neon は EUMEL の16分メロが元々常時鳴る。dub はドロップ主役の構造を維持。
- ⚠️ 実装時の落とし穴: stepDisco/stepFutureBass/stepDrumBass のヘッダに `section` が無かったので `section = sectionBeat(bar)` を追加（追加し忘れると実行時 ReferenceError）。

確認: モジュール構文OK／`git diff --check` OK／全 step 関数で `section` の定義・使用整合をNodeで検査（未定義使用なし）。trance はユーザー確認OK、他は要試聴。

### まだやってない（その先の候補）
- C（体験）案: プレイヤーが曲のキー内でソロを弾ける**ジャムモード**、DJブースの**スペクトラム表示**、フックのノートに同期したライト
- ドラムのレイヤー追加、アーティスト別の“音色”側のさらなる寄せ

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

今回の会場キーHUD/クリック操作追加後、以下も確認済み。

```powershell
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8123/).StatusCode
```

結果:

```text
200
```

※ アプリ内ブラウザ確認は `node_repl` 側の環境メタ情報不足で起動できなかったため、ローカル配信応答と構文チェックまで確認。

## 次にやるなら

- ブラウザで実際にスポーン平地で会場を出して、`Q/E/J/K/L` のDJ操作、GROOVEコンボ、画面フラッシュ、ショックウェーブ、CROWD HYPEゲージ、花火、HUDクリック/タップ、NPC入場、サビ/ドロップの観客リアクション、`Z/X/C/V` の参加ダンス、会場固有ギミック、音ブロック演出を目視確認する
- 問題なければ `index.html` と `HANDOFF.md` を commit
- ユーザーが希望したら GitHub に push
