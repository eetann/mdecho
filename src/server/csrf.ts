import type { MiddlewareHandler } from "hono";

/**
 * 設定を書き換えないメソッド。閲覧のためのリクエストなのでそのまま通す。
 * これ以外(POSTなど)は副作用があるものとして扱う。
 */
const SAFE_METHODS = new Set(["GET", "HEAD"]);

/** Content-Typeは`application/json; charset=utf-8`のようにパラメータが付く */
const JSON_CONTENT_TYPE = /^application\/json\s*(?:;|$)/i;

/**
 * 外部サイトのJSから設定を書き換えられないようにする。
 *
 * `POST /api/config`は`~/.config/mdecho/config.jsonc`を書き換えるため、素のままだと
 * mdechoを起動している間に別のサイトを開いているだけで設定を改変できてしまう。
 * 待ち受けポートは起動ごとにランダム(port 0)だが、総当たりで到達はできる。
 *
 * 次の2つで塞ぐ。ブラウザからの正規のリクエストは2つとも満たす。
 *
 * 1. Content-Typeを`application/json`に限る。
 *    Honoの`c.req.json()`はContent-Typeを見ずにbodyを`JSON.parse`するだけなので、
 *    `text/plain`のCORS単純リクエストがプリフライト無しでハンドラまで届く
 *    (レスポンスが読めなくても、書き込みの副作用だけは成立してしまう)。
 *    `application/json`を必須にするとブラウザはプリフライトを強制され、
 *    mdechoはCORSヘッダを返さないので実リクエストそのものが飛ばなくなる。
 * 2. `Sec-Fetch-Site`と`Origin`が付いていれば、同一オリジンからのものだけ通す。
 *    どちらも無いリクエストはcurlなどブラウザ以外からのものとして通す。
 *    ブラウザは別オリジンからのfetchには必ず`Origin`を付けるため、CSRFの経路にはならない。
 *
 * DNS rebinding(攻撃者のドメインを127.0.0.1へ向ける)だと`Origin`も`Sec-Fetch-Site`も
 * 同一オリジン扱いになり通り抜けてしまうため、前段にhostGuardを置くこと。
 */
export const csrfGuard: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    return next();
  }

  const contentType = c.req.header("content-type");
  if (contentType === undefined || !JSON_CONTENT_TYPE.test(contentType)) {
    return c.json({ message: "Content-Typeはapplication/jsonにしてください" }, 415);
  }

  const secFetchSite = c.req.header("sec-fetch-site");
  if (secFetchSite !== undefined && secFetchSite !== "same-origin") {
    return c.json({ message: `別サイトからのリクエストは受け付けません (${secFetchSite})` }, 403);
  }

  const origin = c.req.header("origin");
  if (origin !== undefined && origin !== new URL(c.req.url).origin) {
    return c.json({ message: `別オリジンからのリクエストは受け付けません (${origin})` }, 403);
  }

  return next();
};
