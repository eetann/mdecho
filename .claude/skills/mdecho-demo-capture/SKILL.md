---
name: mdecho-demo-capture
description: mdechoのブログ・README・SNS用のスクリーンショットや操作動画をplaywright-cliで撮る。「mdechoのスクショ/動画/デモを撮って」「紹介用の素材を作って」と頼まれたときに使う。
---

# mdechoのデモ素材を撮る

素材は `.mywork/<作業名>/` に置く(gitignore済み)。構成は `sample/`(撮影用Markdown)、`sample-orig/`(その控え)、`scenes/*.js`、`shots/`、`videos/`、`videos/raw/`。

## 流れ

1. 見せる機能と順番を決め、`plan.md` に書く
2. 撮影用Markdownを用意する(下の「サンプルの条件」)。日本語はnatural-japaneseで整える
3. サーバーとブラウザを起動する
4. シーンごとにスクリプトを書いて撮る
5. ffmpegで切り出して、コンタクトシートで自分の目で確かめてからユーザーに見せる

## 起動

```sh
bun run build:client   # 撮影前にクライアントを最新にする
XDG_CONFIG_HOME=$PWD/.mywork/<作業名>/xdg bun run src/index.ts -f .mywork/<作業名>/sample/xxx.md --no-open
playwright-cli -s=blog open http://localhost:<出力されたポート>/
```

- `XDG_CONFIG_HOME` を作業ディレクトリに向けて、ユーザーの `~/.config/mdecho/config.jsonc` を読まない・書かない。既定の設定で撮れる
- ブラウザは自動で開かない(`--no-open`)。サーバーはバックグラウンドで動かしておく

## スクリプト

`scripts/` を使う。シーンファイルは `async page => {` を書かず、中身だけを書く。

```sh
S=.claude/skills/mdecho-demo-capture/scripts
$S/run.sh .mywork/<作業名> http://localhost:<port>/ 02-line-comment 03-multiline
$S/convert.sh .mywork/<作業名> 02-line-comment 03-multiline   # 引数なしなら全部
```

`_head.js` が用意するもの: `ROOT` `URL` `REC` `SHOT`、`prepare({clear})`、`record(name)`、`shot(name)`、`moveTo`、`centerOf`、`clickOn`、`press`、`hideDecor`。
`examples/` は実際に使ったシーン。書き始めはここから写す。

- `_head.js` を変えたら `playwright-cli -s=blog close` してから開き直す。初期化スクリプトはページに1回しか登録されない
- コメントはsessionStorageに残り、シーンをまたいで引き継がれる。`prepare()` は既定で消す。前のシーンのコメントを見せたいときは `prepare({ clear: false })` にして、前のシーンから続けて流す

## 試行錯誤で分かったこと

### 録画の下端に灰色の帯が出る

`page.screencast` の録画は、下端の約87pxが灰色になる。そこで録画は1440x990で撮り、`convert.sh` で上の1440x900を切り出す。静止画は `shot()` が1440x900に切り替えて撮る。

この縦のずれが原因の副作用が2つあり、`_head.js` で対処してある。

- j/kのカーソル行は990pxに収まるようにスクロールするので、切り落とす90pxに入ると動画から消える → `scroll-padding-bottom`
- 表の拡大モーダルは `fixed inset-0` なので、下の縁が切れる → 録画の高さのときだけ `bottom` を詰める

画面の下端まで届く固定UIを撮るときは、同じ対処が要る。

### マウスとキーは自前で映す

`page.screencast.showActions` は操作名の吹き出しを消せないので使わない。`_head.js` が偽カーソル、クリックの波紋、押している間の赤い輪、キーのバッジ(j/k/Enter/Esc/Ctrl+…)を差し込む。

- 行番号の吹き出しのドラッグは `pointerdown` で `preventDefault` されるので、mouse系のイベントが来ない。偽カーソルはpointer系で追う
- カーソルを映したくないシーン(キー操作だけのもの)は `#__cursor` を `display:none` にする。静止画は `hideDecor(true)` で隠す

### ユーザーに言われた見せ方

- 1行へのコメントは、吹き出しではなく本文をダブルクリックして開く。「吹き出しを押さないといけない」と思わせないため
- 複数行へのコメントは、1行目の吹き出しを押したまま最終行まで引っ張る。1行ずつ止めて、範囲が伸びるのを見せる
- 現在行は、jで上から下まで順に下り、下の方で「少し前から読み直そう」とkで2行戻る。行が画面からはみ出さないことを確かめる
- コピーとライブリロードは不要と言われたことがある。入れるかどうかは先に聞く

### mdechoの仕様で撮り方が変わるところ

- 1行だけを選んで引用すると、インラインコードとしてコメント本文の先頭にくっつく。コメントは引用に続く文として書く(例: 「` はどのオプションで設定する？`」)
- ライブリロード後はスクロール位置とカーソル行が復元される。最初から見せたいなら `mdecho:scroll:*` と `mdecho:cursorLine:*` を消してから開く
- Outdatedのコメントはページ末尾に出て見切れるので、`body` に下の余白を足してからスクロールする
- ファイルを書き換えて撮ったら、`sample-orig/` から戻す

## サンプルの条件

- 「AIエージェントが書いた設計メモ」のように、指摘を返したくなる文書にする。80行ほどで足りる
- 1行に2文ある行を入れる(句点で表示上だけ改行され、行番号が2つ並ぶ)
- 8列ほどの横に長い表を入れる(拡大表示が映える)
- 目次との連動が見えるよう、スクロールが要る長さと見出し5つ以上
- Mermaid、コードブロック、別のmdへのリンクがあると全体像が賑やかになる

## 要素の探し方

| 対象 | ロケーター |
| --- | --- |
| 行の本文 | `[data-line="13"]` |
| 行番号 | `.mdecho-line-number` (hasText `/^13$/`) |
| 行の吹き出し | `getByRole('button', { name: '13行目にコメントする' })` |
| 現在のカーソル行 | `[data-mdecho-cursor]` の `data-line` |
| 表の拡大ボタン | `.mdecho-table-expand` |
| 引用ボタン | `.mdecho-reply-button` |
| Outdated | `.mdecho-outdated-comments` |
| 配色の切り替え | `[aria-label^='color theme']` (押すたびにlight/dark/systemを巡る。aria-labelで現在値が分かる) |
| 設定、ヘルプ | `getByRole('button', { name: 'settings' })`、`{ name: 'keyboard shortcuts' }` |
| コメントの保存 | `getByRole('button', { name: 'save' })` か `Control+Enter` |

## 確認

ユーザーに渡す前に、動画をコマ割りにして自分で見る。

```sh
ffmpeg -loglevel error -y -i videos/03-multiline.mp4 -vf "fps=2,scale=480:-1,tile=4x3" -frames:v 1 <scratchpad>/03.png
```

カーソルが動いて見えるか、見せたい行が切り出し範囲に収まっているかを確かめる。
