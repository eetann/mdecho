---
description: mdechoの全コマンド・全オプション一覧
---

# CLIリファレンス

## `mdecho -f <file>` / `mdecho <file>...`

指定したMarkdownファイルを表示するローカルサーバーを起動する。ファイルは1つ以上必要。

| オプション | 説明 |
| --- | --- |
| `-f, --file <path>` | 表示するMarkdownファイルのパス。複数回指定できる |
| `<file>...` (位置引数) | 表示するMarkdownファイルのパス。`docs/*.md` のようにシェルのglobが使える。`-f` と併用でき、`-f` の後ろに並ぶ |
| `--git <base>` | `<base>` とHEADのmerge-baseから作業ツリーまでに変更・追加されたMarkdownをまとめて開く。untrackedのファイルも含み、削除されたファイルは含まない。`-f` や位置引数と併用でき、その後ろにパス順で並ぶ |
| `--open` / `--no-open` | 起動後にブラウザを自動で開く(既定: 有効) |
| `--split-sentences` / `--no-split-sentences` | 句点(。)ごとに表示上の改行を入れる(既定: 有効) |
| `--single-newline` / `--no-single-newline` | 単一改行(Enterキー1回)をそのまま表示上の改行にする(既定: 有効) |

複数のファイルを指定すると、1つのタブの中でファイル一覧から切り替えて読める。先頭のファイルが最初に開く。

```bash
mdecho docs/*.md
mdecho -f plan.md -f review.md
```

`--git` の `<base>` には比べたい相手を指定する。`@` はgitが標準で持つ `HEAD` の別名。

```bash
# 未コミットの変更(AIがたった今書いたもの)をまとめて読む
mdecho --git @

# PRで変更されたMarkdownをまとめて読む。mainとのmerge-baseから比べるので、main側で進んだ分は混ざらない
gh pr checkout 123 && mdecho --git main
```

`--git` で開いたときは、`<base>` から追加・変更された行の行番号の横に緑の縦棒が付く。削除された行には印を付けない。untrackedのファイルや `<base>` に無かったファイルは全行が新しいので、印を付けない。

## 設定ファイル

コマンドラインオプションとは別に、ツールバーの歯車アイコンまたは `~/.config/mdecho/config.jsonc` でフォント・改行の扱い・本文の見え方(幅/文字サイズ/行の高さ)を変更できます。詳細は `mdecho docs show configuration` を参照。

改行まわりの2つのオプションは設定ファイルの `lineBreak` と同じ項目です。**コマンドラインで明示したときだけ設定ファイルより優先されます**。指定しなければ設定ファイルの値(無ければ既定値)を使います。

## `mdecho font-ls`

そのマシンでブラウザが使えるフォント名を一覧表示する。設定ファイルの `font` に書く名前を調べるのに使う。

括弧内は同じフォントを指す別名で、設定に書くのは括弧の前の名前。ヘッダーを出さないため、そのままgrepなどに流せる。

## `mdecho docs list`

利用可能なドキュメント一覧を表示する。

## `mdecho docs show <name>`

指定したドキュメントの内容を表示する。`<name>` は `mdecho docs list` に表示される名前(拡張子なし)。

## `mdecho --help`

コマンド一覧とオプションの概要を表示する。

## `mdecho --version`

バージョン番号を表示する。
