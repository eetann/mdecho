import { spawn } from "node:child_process";

export async function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  const [cmd, ...args] = command;
  if (!cmd) {
    return;
  }
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}
