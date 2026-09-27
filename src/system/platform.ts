import { readFileSync } from "node:fs";

/**
 * WSL上で動いているか。WSLではブラウザやフォントがWindows側のものになるため、
 * ブラウザの起動(open-browser.ts)とフォント一覧(system-fonts.ts)の両方で分岐に使う。
 */
export function isWsl(): boolean {
  if (process.platform !== "linux") {
    return false;
  }
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
    return true;
  }
  try {
    const release = readFileSync("/proc/version", "utf-8").toLowerCase();
    return release.includes("microsoft");
  } catch {
    return false;
  }
}
