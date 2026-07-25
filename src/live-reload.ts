import type { HttpBindings } from "@hono/node-server";
import type { Context } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";

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
  handleEvents(c: Context<{ Bindings: HttpBindings }>): Response;
  notifyChange(): void;
  closeAll(): void;
}

export function createLiveReloadHub(options: LiveReloadHubOptions = {}): LiveReloadHub {
  const { onIdle, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS } = options;
  const clients = new Set<SSEStreamingApi>();
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
    handleEvents(c) {
      hasConnectedOnce = true;
      cancelIdleTimer();

      return streamSSE(c, async (stream) => {
        clients.add(stream);
        // Bun上の@hono/node-serverではstream.onAbortが発火しないことがあるため、
        // Node.js標準のincoming(IncomingMessage)のcloseイベントで明示的に検知する。
        const onIncomingClose = () => {
          if (!stream.closed) stream.abort();
        };
        c.env.incoming.on("close", onIncomingClose);
        await new Promise<void>((resolve) => {
          stream.onAbort(() => {
            c.env.incoming.off("close", onIncomingClose);
            clients.delete(stream);
            scheduleIdleCheck();
            resolve();
          });
        });
      });
    },

    notifyChange() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        for (const stream of clients) {
          stream.writeSSE({ event: "reload", data: String(Date.now()) }).catch(() => {
            clients.delete(stream);
          });
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
      for (const stream of clients) {
        stream.close();
      }
      clients.clear();
    },
  };
}
