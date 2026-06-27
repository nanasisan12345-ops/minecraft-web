# music

Suno で生成した mp3 をこのフォルダに置く。ファイル名は下記に合わせる（ゲーム統合がこの名前を参照する）。

`index.html` と同じ階層 = `D:\ChatGPTProjects\マインクラフト\music\` に配置。

| 会場キー | ジャンル | ファイル名 |
|---|---|---|
| R | TECHNO | `classic-1.mp3` / `classic-2.mp3` / `classic-3.mp3` |
| T | EUROBEAT | `neon-1.mp3` / `neon-2.mp3` / `neon-3.mp3` |
| Y | TRANCE | `forest-1.mp3` / `forest-2.mp3` / `forest-3.mp3` |
| U | DISCO HOUSE | `laser-1.mp3` / `laser-2.mp3` / `laser-3.mp3` |
| I | FUTURE BASS | `future-1.mp3` / `future-2.mp3` / `future-3.mp3` |
| O | DRUM & BASS | `bass-1.mp3` / `bass-2.mp3` / `bass-3.mp3` |
| P | LOFI | `chill-1.mp3` / `chill-2.mp3` / `chill-3.mp3` |
| [ | DUBSTEP | `dub-1.mp3` / `dub-2.mp3` / `dub-3.mp3` |

## 屋外環境BGM

屋外で流す環境BGMは前回決めたテーマ順で扱う。

| テーマ | ファイル名 |
|---|---|
| 草原・昼 | `ambient-grass-1.mp3` |
| 夜・星空 | `ambient-night-1.mp3` |
| 雨の日 | `ambient-rain-1.mp3` |
| 洞窟・地下 | `ambient-cave-1.mp3` |
| 雪原 | `ambient-snow-1.mp3` |
| 夕方・冒険の終わり | `ambient-sunset-1.mp3` |
| 少し現代風の街外れ | `ambient-modern-1.mp3` |

同じテーマで複数曲を置く場合は `ambient-rain-2.mp3` のように連番で追加できる。
ゲーム側は雨、地下、雪原などの状況に合わせてテーマ曲を選ぶ。
屋外BGMは常時ループではなく、Minecraftのようにしばらく無音の探索時間を挟んでたまに流れる。
会場中は屋外BGMを止め、屋外に戻った後に少し待ってから再開候補になる。
旧形式の `ambient-1.mp3` から `ambient-7.mp3` も互換用に読み込めるが、今後はテーマ名付きファイル名を推奨。

## メモ
- 全部揃わなくてもOK。あるファイルだけ読み込む実装にする。
- `Q/E` で同じ会場の曲を前後に切り替え（-1/-2/-3）。
- まず1曲（例 `forest-1.mp3`）だけ置けば、その会場で鳴らす動作確認ができる。
