import { useCallback, useSyncExternalStore } from "react";

/** メディアクエリが今一致しているか。画面幅などが変わると追従して描き直す。 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
