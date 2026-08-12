import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

function isWsl(): boolean {
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

export async function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32" || isWsl()
        ? ["cmd.exe", "/c", "start", "", url]
        : ["xdg-open", url];

  const [cmd, ...args] = command;
  if (!cmd) {
    return;
  }
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}
