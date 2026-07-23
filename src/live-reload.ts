import type { IncomingMessage, ServerResponse } from "node:http";

const NOTIFY_DEBOUNCE_MS = 150;

export interface LiveReloadHub {
  handleRequest(req: IncomingMessage, res: ServerResponse): boolean;
  notifyChange(): void;
  closeAll(): void;
}

export function createLiveReloadHub(): LiveReloadHub {
  const clients = new Set<ServerResponse>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    handleRequest(req, res) {
      if (req.method !== "GET" || req.url !== "/events") {
        return false;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(":ok\n\n");
      clients.add(res);

      const remove = () => {
        clients.delete(res);
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
