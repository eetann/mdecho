# mdecho

AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール。

単なるMarkdownビューアではなく、AIとのやり取り(レビュー・質問・フィードバック)を行いやすくすることを目的としています。CLIから実行するとlocalhostでレンダリングされたMarkdownが開き、行頭の吹き出しアイコンや範囲選択でその箇所への返信をAI向けの形式でクリップボードにコピーできます。

<img width="3200" height="1800" alt="Image" src="https://github.com/user-attachments/assets/f6aa5097-3663-4c43-9328-aa3bc49a3cd8" />
<img width="3200" height="1800" alt="Image" src="https://github.com/user-attachments/assets/13105ec9-1cce-4f90-bb95-2a737c9b69b3" />

## インストール

Node.js 20.19.0以降が必要です。

```bash
npm install -g mdecho
```

インストールせずに実行することもできます。

```bash
npx mdecho -f <file>
# bunなら
bunx mdecho -f <file>
```

## 使い方

```bash
mdecho -f <file>
```

詳細なオプションは `mdecho --help` または `mdecho docs show cli-reference` を参照してください。

`./foo.md` のような他のMarkdownへのリンクを辿ると、同じディレクトリのファイルをその場で読み進められます。リンク先でもコメントを書け、ツールバー左のホームアイコンで最初のファイルへ戻れます。

> [!NOTE]
> `-f` で指定したファイルと同じディレクトリの配下は、Markdownと画像がlocalhostから読める状態になります(サーバーは `127.0.0.1` だけで待ち受け、ブラウザの全タブを閉じると終了します)。それ以外の拡張子のファイルは配信しません。リポジトリのルートにある `README.md` を開くときなど、配下に見せたくないMarkdownや画像がある場合は気に留めておいてください。詳細は `mdecho docs show getting-started` の「公開される範囲」を参照してください。

## 設定

ツールバー右上の歯車アイコンから、配色・改行の扱い・本文の見え方(幅/文字サイズ/行の高さ)・本文とコードブロックのフォントを変更できます。保存すると `~/.config/mdecho/config.jsonc` に書き込まれます。いじりすぎたときは「デフォルトに戻す」でまとめて既定値へ戻せます。

配色はツールバーのアイコンからも `OSに合わせる` / `ライト` / `ダーク` を切り替えられます。本文だけでなくコードブロック(Shiki)とMermaidの図も一緒に切り替わります。

設定ファイルを直接書くこともできます。

```jsonc
{
  "theme": {
    // "system"(OSに合わせる) / "light" / "dark"
    "mode": "system",
    // 書いた色だけが上書きされる。キー名はdaisyUIの色トークンと同じ
    "dark": {
      "base-100": "#000000",
      "base-content": "#f0f6fc",
    },
  },
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
