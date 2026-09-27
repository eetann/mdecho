import { join } from "node:path";

/**
 * パッケージのルート。同梱の`docs/`やビルド済みの`dist/client/`を指すのに使う。
 *
 * 開発時はこのファイルが`src/`直下、`bun run build:cli`後は1ファイルに畳まれて
 * `dist/`直下に置かれる。どちらも1つ上がパッケージルートなので`".."`で済む。
 * この前提があるため、このモジュールは`src/`直下から動かさないこと。
 */
export const PACKAGE_ROOT = join(import.meta.dirname, "..");
