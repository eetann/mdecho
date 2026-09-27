# mdecho

AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール。

単なるMarkdownビューアではなく、AIとのやり取り(レビュー・質問・フィードバック)を行いやすくすることを目的としています。CLIから実行するとlocalhostでレンダリングされたMarkdownが開き、行頭の吹き出しアイコンや範囲選択でその箇所への返信をAI向けの形式でクリップボードにコピーできます。

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

## 設定

ツールバー右上の歯車アイコンから、配色・改行の扱い・本文の見え方(幅/文字サイズ/行の高さ)・本文とコードブロックのフォントを変更できます。保存すると `~/.config/mdecho/config.jsonc` に書き込まれます。

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

## 開発

```bash
bun install
bun run start -- -f examples/sample.md
```

| コマンド | 内容 |
| --- | --- |
| `bun test` | テスト |
| `bun run lint` | Lint (oxlint) |
| `bun run format:check` | フォーマット確認 (oxfmt) |
| `bun run typecheck` | 型チェック |
| `bun run build` | `dist/` の生成 |

## リリース

npmへの公開はGitHub Actionsから行います。長期のnpmトークンはどこにも置かず、
Trusted Publishing (OIDC) とnpmのStaged Publishingを組み合わせているため、
GitHubとnpmの両方の権限がないと公開まで到達しません。

### 初回セットアップ

npmのTrusted Publisherは既に存在するパッケージにしか設定できないため、
最初の1回だけはローカルから手動で公開してパッケージを作ります。

1. リポジトリをpublicにする (provenanceの生成にはpublicリポジトリが必要)
2. ローカルから `npm publish --access public` で最初のバージョンを公開する (2FAが必要)
3. npmjs.comのパッケージ設定 → Trusted Publisher に以下を登録する

   | 項目 | 値 |
   | --- | --- |
   | Organization or user | `eetann` |
   | Repository | `mdecho` |
   | Workflow filename | `publish.yml` |
   | Environment name | `npm` |

4. Allowed actionsは `npm stage publish` のみにして、CIからの直接公開を塞ぐ
5. GitHubの Settings → Environments で `npm` を作り、required reviewersに自分を設定する

### 2回目以降

1. `package.json` の `version` を上げてコミットする
2. 同じバージョンのタグを打ってpushする (`git tag v0.1.0 && git push origin v0.1.0`)
3. GitHubの `npm` environmentで承認する (1つ目のゲート)
4. CIがテスト・ビルド・publintを通して `npm stage publish` まで進める (この時点ではまだ公開されていない)
5. npmjs.comのStaged Packagesで中身を確認し、2FA付きでapproveすると公開される (2つ目のゲート)

`npm stage list` / `npm stage view <stage-id>` / `npm stage approve <stage-id>` でCLIからも確認・承認できます。
