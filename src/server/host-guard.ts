import type { MiddlewareHandler } from "hono";

/**
 * ループバック宛てのリクエストか。
 * `new URL(...).hostname`はIPv6を`[::1]`の形へ正規化するため、その形だけを見れば足りる。
 * WSLではWindows側のブラウザから`127.0.0.1`で、それ以外では`localhost`で開くため両方を許す。
 * ポートは起動ごとにランダムなので見ない。
 */
export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/**
 * DNS rebindingで外部サイトからmdechoを読み書きされないようにする。
 *
 * 攻撃者のドメインを127.0.0.1へ再解決させると、そのページはmdechoと同一オリジンになり、
 * CORSの壁を越えてMarkdownや画像を読めてしまう(POSTならOriginもSec-Fetch-Siteも同一オリジンに見える)。
 * ループバックだけで待ち受けていても、ブラウザ自身が127.0.0.1へ繋ぐので防げない。
 * このときブラウザが送るHostは攻撃者のドメインのままなので、Hostがループバックでなければ弾く。
 *
 * 設定を書き換えるAPIも含め、全リクエストに掛けること。
 */
export const hostGuard: MiddlewareHandler = async (c, next) => {
  // @hono/node-serverはHostヘッダからc.req.urlを組み立てるため、ここで見るのは実際のHost。
  // Hostが無いリクエスト(HTTP/1.0)は待ち受けアドレスで補われるので、ここでは通る。
  const requestUrl = new URL(c.req.url);
  if (!isLoopbackHostname(requestUrl.hostname)) {
    return c.text(`${requestUrl.host} からのリクエストは受け付けません`, 403);
  }
  return next();
};
