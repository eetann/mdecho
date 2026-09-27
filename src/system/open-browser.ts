import { spawn } from "node:child_process";
import { isWsl } from "./platform.ts";

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
