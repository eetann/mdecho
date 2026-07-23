export const liveReloadClientScript = `
(() => {
  const source = new EventSource("/events");
  source.addEventListener("open", () => {
    console.info("[mdecho] live reload connected");
  });
  source.addEventListener("reload", () => {
    console.info("[mdecho] change detected, reloading");
    location.reload();
  });
})();
`;
