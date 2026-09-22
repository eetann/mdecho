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
  /**
   * クライアントが見ているファイルの集合が変わったときに呼ばれる。
   * タブごとに違うMarkdownを開けるため、監視対象をその集合に追従させるのに使う。
   */
  onWatchTargetsChange?: (paths: Set<string>) => void;
}

export interface LiveReloadHub {
  /** watchPathは、このクライアントが表示しているファイルの絶対パス */
  handleEvents(c: Context<{ Bindings: HttpBindings }>, watchPath: string): Response;
  /** 変更されたファイルを見ているクライアントにだけリロードを伝える */
  notifyChange(path: string): void;
  closeAll(): void;
}

export function createLiveReloadHub(options: LiveReloadHubOptions = {}): LiveReloadHub {
  const { onIdle, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS, onWatchTargetsChange } = options;
  const clients = new Map<SSEStreamingApi, string>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let hasConnectedOnce = false;
  let stopped = false;

  function cancelIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  }

  function notifyWatchTargets() {
    onWatchTargetsChange?.(new Set(clients.values()));
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
    handleEvents(c, watchPath) {
      hasConnectedOnce = true;
      cancelIdleTimer();

      return streamSSE(c, async (stream) => {
        clients.set(stream, watchPath);
        notifyWatchTargets();
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
            notifyWatchTargets();
            scheduleIdleCheck();
            resolve();
          });
        });
      });
    },

    notifyChange(path) {
      const existing = debounceTimers.get(path);
      if (existing) {
        clearTimeout(existing);
      }
      debounceTimers.set(
        path,
        setTimeout(() => {
          debounceTimers.delete(path);
          for (const [stream, watchPath] of clients) {
            if (watchPath !== path) continue;
            stream.writeSSE({ event: "reload", data: String(Date.now()) }).catch(() => {
              clients.delete(stream);
            });
          }
        }, NOTIFY_DEBOUNCE_MS),
      );
    },

    closeAll() {
      stopped = true;
      cancelIdleTimer();
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      for (const stream of clients.keys()) {
        stream.close();
      }
      clients.clear();
    },
  };
}
