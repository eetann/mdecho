import { useEffect } from "react";

export function useLiveReload(): void {
  useEffect(() => {
    // タブごとに違うMarkdownを開けるため、見ているファイルをサーバーに伝えて
    // そのファイルが変わったときだけリロードしてもらう。
    const source = new EventSource(`/events?path=${encodeURIComponent(location.pathname)}`);

    const handleOpen = () => {
      console.info("[mdecho] live reload connected");
    };
    const handleReload = () => {
      console.info("[mdecho] change detected, reloading");
      location.reload();
    };

    source.addEventListener("open", handleOpen);
    source.addEventListener("reload", handleReload);

    return () => {
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("reload", handleReload);
      source.close();
    };
  }, []);
}
