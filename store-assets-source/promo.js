(() => {
  "use strict";

  const parameters = new URLSearchParams(location.search);
  const requestedAsset = parameters.get("asset");
  const asset = requestedAsset === "marquee" ? "marquee" : "small";

  document.body.dataset.asset = asset;
  document.title = asset === "small"
    ? "PastePort — bloco promocional pequeno"
    : "PastePort — letreiro promocional";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.dataset.ready = "true";
    });
  });
})();
