# mdecho

AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール。

単なるMarkdownビューアではなく、AIとのやり取り(レビュー・質問・フィードバック)を行いやすくすることを目的としています。CLIから実行するとlocalhostでレンダリングされたMarkdownが開き、行頭の吹き出しアイコンや範囲選択でその箇所への返信をAI向けの形式でクリップボードにコピーできます。

## インストール

```bash
bun install
```

## 使い方

```bash
bun run start -- -f <file>
```

詳細なオプションは `mdecho --help` または `mdecho docs show cli-reference` を参照してください。

`./foo.md` のような他のMarkdownへのリンクを辿ると、同じディレクトリのファイルをその場で読み進められます。リンク先でもコメントを書け、ツールバー左のホームアイコンで最初のファイルへ戻れます。

## 設定

ツールバー右上の歯車アイコンから、改行の扱い・本文の見え方(幅/文字サイズ/行の高さ)・本文とコードブロックのフォントを変更できます。保存すると `~/.config/mdecho/config.jsonc` に書き込まれます。

設定ファイルを直接書くこともできます。

```jsonc
{
  "font": {
    // 前から順に試して、無ければ次のフォントが使われる
    "body": ["Inter", "BIZ UDPGothic"],
    "code": ["JetBrains Mono"],
  },
  "lineBreak": {
    // 句点(。)ごとに表示上の改行を入れる
    "splitSentences": true,
    // 単一改行(Enterキー1回)をそのまま表示上の改行にする
    "singleNewline": true,
  },
  "layout": {
    // 本文の幅(px)。右の目次を除いた残りの幅に対して中央寄せされる
    "contentWidth": 1024,
    // 本文の文字サイズ(px)
    "fontSize": 16,
    // 本文の行の高さ(文字サイズに対する倍率)
    "lineHeight": 1.75,
  },
}
```

改行まわりは `--no-split-sentences` / `--no-single-newline` でも切り替えられ、コマンドラインでの指定が設定ファイルより優先されます。使えるフォント名は `mdecho font-ls` で確認できます。詳細は [docs/configuration.md](docs/configuration.md) を参照してください。

## AIエージェント向け

このツールはコーディングエージェントがMarkdownを生成したあとに呼び出し、人間にレビューを依頼する用途を想定しています。

```bash
mdecho docs list
mdecho docs show agent-workflow
```

`mdecho docs list` で利用可能なドキュメント一覧を、`mdecho docs show <name>` でその内容を確認できます。AIエージェントとの連携方法の詳細は [docs/agent-workflow.md](docs/agent-workflow.md) を参照してください。
