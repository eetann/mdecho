import type { IncomingMessage, ServerResponse } from "node:http";

const NOTIFY_DEBOUNCE_MS = 150;
// ページリロード(通常のリロードやlive reloadによる自動リロード)ではSSE接続が
// 一瞬切れてすぐ再接続されるため、即座にonIdleを発火せずこの猶予時間だけ待つ。
const DEFAULT_IDLE_TIMEOUT_MS = 3000;

export interface LiveReloadHubOptions {
  /** 一度でも接続したクライアントが全員いなくなったときに呼ばれる */
  onIdle?: () => void;
  idleTimeoutMs?: number;
}

export interface LiveReloadHub {
  handleRequest(req: IncomingMessage, res: ServerResponse): boolean;
  notifyChange(): void;
  closeAll(): void;
}

export function createLiveReloadHub(options: LiveReloadHubOptions = {}): LiveReloadHub {
  const { onIdle, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS } = options;
  const clients = new Set<ServerResponse>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let hasConnectedOnce = false;
  let stopped = false;

  function cancelIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  }

  function scheduleIdleCheck() {
    if (stopped || !onIdle || !hasConnectedOnce || clients.size > 0) {
      return;
    }
    cancelIdleTimer();
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      if (!stopped && clients.size === 0) {
        onIdle();
      }
    }, idleTimeoutMs);
  }

  return {
    handleRequest(req, res) {
      if (req.method !== "GET" || req.url !== "/events") {
        return false;
      }

      hasConnectedOnce = true;
      cancelIdleTimer();

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(":ok\n\n");
      clients.add(res);

      const remove = () => {
        clients.delete(res);
        scheduleIdleCheck();
      };
      req.on("close", remove);
      res.on("error", remove);

      return true;
    },

    notifyChange() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        for (const res of clients) {
          try {
            res.write(`event: reload\ndata: ${Date.now()}\n\n`);
          } catch {
            clients.delete(res);
          }
        }
      }, NOTIFY_DEBOUNCE_MS);
    },

    closeAll() {
      stopped = true;
      cancelIdleTimer();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      for (const res of clients) {
        res.end();
      }
      clients.clear();
    },
  };
}
