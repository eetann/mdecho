import { relative, resolve } from "node:path";
import { isMarkdownPath } from "../server/doc-path.ts";
import { git } from "./exec.ts";

function splitNul(stdout: string): string[] {
  return stdout.split("\0").filter((path) => path !== "");
}

/**
 * `<base>`とHEADのmerge-baseから作業ツリーまでに変更・追加されたMarkdownを、cwdからの相対パスで返す。
 * untrackedのファイルも含め、削除されたファイルは含めない。並びはパス順。
 *
 * merge-baseから比べるのは、`--git main`でPRを読むときにmain側の進んだ分を混ぜないため。
 * 作業ツリーまで比べるのは、`--git @`でAIが書いた未コミットの変更を拾うため。
 */
export async function listChangedMarkdown(base: string, cwd = process.cwd()): Promise<string[]> {
  const toplevel = (await git(["rev-parse", "--show-toplevel"], cwd)).trim();
  const mergeBase = (await git(["merge-base", base, "HEAD"], cwd)).trim();
  // git diffの出力はリポジトリルート基準なので、ls-filesもルートで実行して揃える。
  const [changed, untracked] = await Promise.all([
    git(["diff", "--name-only", "-z", "--diff-filter=d", mergeBase], toplevel),
    git(["ls-files", "--others", "--exclude-standard", "-z"], toplevel),
  ]);

  const paths = new Set([...splitNul(changed), ...splitNul(untracked)]);
  return [...paths]
    .filter(isMarkdownPath)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => relative(cwd, resolve(toplevel, path)));
}
