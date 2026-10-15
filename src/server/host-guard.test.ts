import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { hostGuard, isLoopbackHostname } from "./host-guard.ts";

/** ガードを通り抜けたかどうかだけを見たいので、後段はOKを返すだけにする */
function createApp() {
  const app = new Hono();
  app.use("*", hostGuard);
  app.all("*", (c) => c.json({ ok: true }));
  return app;
}

describe("isLoopbackHostname", () => {
  test("ループバックのホスト名", () => {
    for (const hostname of ["localhost", "127.0.0.1", "127.1.2.3", "[::1]"]) {
      expect(isLoopbackHostname(hostname)).toBe(true);
    }
  });

  test("ループバック以外のホスト名", () => {
    for (const hostname of [
      "evil.example",
      "localhost.evil.example",
      "127.0.0.1.evil.example",
      "192.168.1.5",
      "0.0.0.0",
      "[::ffff:127.0.0.1]",
    ]) {
      expect(isLoopbackHostname(hostname)).toBe(false);
    }
  });
});

describe("hostGuard", () => {
  // WSLではWindows側のブラウザから127.0.0.1で開くため、localhostと両方通す必要がある。
  test("ループバックのHostならポートに関わらず通す", async () => {
    for (const base of [
      "http://localhost:31234",
      "http://127.0.0.1:31234",
      "http://127.0.0.1:5000",
      "http://[::1]:31234",
    ]) {
      const res = await createApp().request(`${base}/doc.md`);
      expect(res.status).toBe(200);
    }
  });

  test("Hostがループバックでなければ、GETでも403で弾く", async () => {
    for (const base of ["http://evil.example:31234", "http://192.168.1.5:31234"]) {
      for (const path of ["/", "/doc.md", "/pic.png", "/events", "/api/fonts"]) {
        const res = await createApp().request(`${base}${path}`);
        expect(res.status).toBe(403);
      }
    }
  });

  // DNS rebindingだとOriginもSec-Fetch-Siteも同一オリジンになるため、Host側で落とす。
  test("Hostがループバックでないなら、同一オリジンに見えるPOSTも403で弾く", async () => {
    const res = await createApp().request("http://evil.example:31234/api/config", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        origin: "http://evil.example:31234",
      },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });
});
