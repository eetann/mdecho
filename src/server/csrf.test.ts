import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { csrfGuard } from "./csrf.ts";

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
});
