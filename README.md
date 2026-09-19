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

## 設定

ツールバー右上の歯車アイコンから、本文・コードブロックのフォントを変更できます。選ぶとその場で表示に反映され、保存すると `~/.config/mdecho/config.jsonc` に書き込まれます。

設定ファイルを直接書くこともできます。

```jsonc
{
  "font": {
    // 前から順に試して、無ければ次のフォントが使われる
    "body": ["Inter", "BIZ UDPGothic"],
    "code": ["JetBrains Mono"],
  },
}
```

使えるフォント名は `mdecho font-ls` で確認できます。詳細は [docs/configuration.md](docs/configuration.md) を参照してください。

## AIエージェント向け

このツールはコーディングエージェントがMarkdownを生成したあとに呼び出し、人間にレビューを依頼する用途を想定しています。

```bash
mdecho docs list
mdecho docs show agent-workflow
```

`mdecho docs list` で利用可能なドキュメント一覧を、`mdecho docs show <name>` でその内容を確認できます。AIエージェントとの連携方法の詳細は [docs/agent-workflow.md](docs/agent-workflow.md) を参照してください。
