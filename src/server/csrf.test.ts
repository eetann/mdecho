import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { csrfGuard, isLoopbackHostname } from "./csrf.ts";

const BASE = "http://localhost:31234";

/** ガードを通り抜けたかどうかだけを見たいので、後段はOKを返すだけにする */
function createApp() {
  const app = new Hono();
  app.use("*", csrfGuard);
  app.all("*", (c) => c.json({ ok: true }));
  return app;
}

/** ブラウザが正規のfetchで付けるヘッダ */
const BROWSER_HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  origin: BASE,
};

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

describe("csrfGuard", () => {
  test("GETは何も付いていなくても通す", async () => {
    const res = await createApp().request(`${BASE}/api/config`);
    expect(res.status).toBe(200);
  });

  test("別サイトの文書からの遷移でも、GETなら見られる", async () => {
    const res = await createApp().request(`${BASE}/doc.md`, {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(res.status).toBe(200);
  });

  test("ブラウザからの同一オリジンのPOSTは通す", async () => {
    const res = await createApp().request(`${BASE}/api/config`, {
      method: "POST",
      headers: BROWSER_HEADERS,
      body: "{}",
    });
    expect(res.status).toBe(200);
  });

  test("Content-Typeにcharsetが付いていても通す", async () => {
    const res = await createApp().request(`${BASE}/api/config`, {
      method: "POST",
      headers: { ...BROWSER_HEADERS, "content-type": "application/json; charset=utf-8" },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });

  test("ヘッダを付けないPOST(curlなどブラウザ以外)は通す", async () => {
    const res = await createApp().request(`${BASE}/api/config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });

  // プリフライトが要らない単純リクエストの形。ここを塞ぐのがこのガードの主目的。
  test("JSON以外のContent-TypeのPOSTは415で弾く", async () => {
    for (const contentType of [
      "text/plain;charset=UTF-8",
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "application/jsonx",
    ]) {
      const res = await createApp().request(`${BASE}/api/config`, {
        method: "POST",
        headers: { "content-type": contentType },
        body: "{}",
      });
      expect(res.status).toBe(415);
    }
  });

  test("Content-Typeの無いPOSTは415で弾く", async () => {
    const res = await createApp().request(`${BASE}/api/config`, { method: "POST" });
    expect(res.status).toBe(415);
  });

  test("別オリジンのOriginが付いたPOSTは403で弾く", async () => {
    for (const origin of ["https://evil.example", "http://localhost:31235", "null"]) {
      const res = await createApp().request(`${BASE}/api/config`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: "{}",
      });
      expect(res.status).toBe(403);
    }
  });

  test("Sec-Fetch-Siteがsame-origin以外のPOSTは403で弾く", async () => {
    for (const secFetchSite of ["cross-site", "same-site", "none"]) {
      const res = await createApp().request(`${BASE}/api/config`, {
        method: "POST",
        headers: { "content-type": "application/json", "sec-fetch-site": secFetchSite },
        body: "{}",
      });
      expect(res.status).toBe(403);
    }
  });

  // DNS rebindingだとOriginもSec-Fetch-Siteも同一オリジンになるため、Host側で落とす。
  test("Hostがループバックでないなら、同一オリジンに見えても403で弾く", async () => {
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
