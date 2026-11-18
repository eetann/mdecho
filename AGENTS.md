Default to using Bun instead of Node.js for development tooling (running scripts, tests, package management).

**However, `mdecho` is published to npm and must run under plain Node.js too**, so runtime code under `src/` must not depend on Bun-only globals (`Bun.serve`, `Bun.file`, `Bun.$`, etc.) — use `node:*` APIs there instead (e.g. `node:http`, `node:fs/promises`, `node:child_process`). Bun-only APIs are fine in tests (`bun:test`) since tests never ship.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.


## ディレクトリ構成

`src/`はドメインごとにディレクトリを切る。フラットに戻さないこと。

```
src/
  index.ts            CLIのエントリ(binの実体)。gunshiの配線だけ
  agent-hint.ts       AIエージェント向けの案内文(CLIとサーバー双方から使う)
  package-root.ts     同梱docs/やdist/client/を解決するためのパッケージルート
  cli/                gunshiのサブコマンド定義と、その入力元
  config/             設定の型と既定値(defaults.ts)、読み込み(load.ts)、保存(save.ts)
                      defaults.tsは設定モーダルの「デフォルトに戻す」からも使うためfrontend/が読む。
                      node依存(c12やnode:fs)を持ち込まないこと
  git/                git差分からの対象ファイル収集(--git)
  markdown/           MarkdownからHTMLへの変換。remark/rehypeプラグインはplugins/配下
  server/             HTTPサーバー、ライブリロード、HTMLシェル、パス解決
  styles/             <head>へ注入するCSSの組み立て。frontend/からも型と定数を共有する
  system/             OS依存の処理(フォント列挙、ブラウザ起動、WSL判定)
```

テストは対象ファイルの隣に`*.test.ts`として置く。

`src/package-root.ts`は`import.meta.dirname`の1つ上をパッケージルートとみなす。
開発時は`src/`直下、`bun run build:cli`後は1ファイルに畳まれて`dist/`直下に置かれるため
どちらも1つ上で正しい。この前提があるのでこのファイルは`src/`直下から動かさないこと。
同梱ファイルへのパスは必ず`PACKAGE_ROOT`経由で組み立て、各モジュールで
`import.meta.dirname`を直接使わない(階層が深いと開発時だけ壊れる)。

## APIs

These Bun-only APIs are fine for dev tooling/tests, but avoid them under `src/` (see note above):

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- `Bun.file` for reading/writing files.
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

`frontend/`はReact + Tailwind。サーバーはビルド済みの`dist/client/`を配信するだけで、HMRは無い。

`frontend/`や`src/`を変更したら、作業の最後に必ず`bun run build`を実行すること(`dist/`を更新しないと`mdecho`コマンドに反映されない)。

## CLI Development

When creating command-line interfaces, use the `use-gunshi-cli` skill.
