---
description: mdechoの全コマンド・全オプション一覧
---

# CLIリファレンス

## `mdecho -f <file>`

指定したMarkdownファイルを表示するローカルサーバーを起動する。

| オプション | 説明 |
| --- | --- |
| `-f, --file <path>` (必須) | 表示するMarkdownファイルのパス |
| `--open` / `--no-open` | 起動後にブラウザを自動で開く(既定: 有効) |
| `--split-sentences` / `--no-split-sentences` | 句点(。)ごとに表示上の改行を入れる(既定: 有効) |

## `mdecho docs list`

利用可能なドキュメント一覧を表示する。

## `mdecho docs show <name>`

指定したドキュメントの内容を表示する。`<name>` は `mdecho docs list` に表示される名前(拡張子なし)。

## `mdecho --help`

コマンド一覧とオプションの概要を表示する。

## `mdecho --version`

バージョン番号を表示する。
