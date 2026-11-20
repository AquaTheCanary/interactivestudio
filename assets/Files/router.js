// Shared route resolver and appearance controller for Interactive Studio.
(function () {
  "use strict";
  const isGitHubPages = location.hostname.toLowerCase().endsWith(".github.io");
  const repositoryBase = isGitHubPages ? "/interactivestudio" : "";
  window.APP_BASE_PATH = repositoryBase;
  window.getAppUrl = function (path) {
    const value = String(path || "/").trim();
    const clean = "/" + value.replace(/^\/+/, "");
    return repositoryBase + (clean === "/" ? "/" : clean);
  };
  function applyRoutes(root = document) {
    root.querySelectorAll("a[data-route]").forEach(anchor => {
      const route = anchor.getAttribute("data-route");
      if (route) anchor.href = window.getAppUrl(route);
    });
  }
  window.applyStudioRoutes = applyRoutes;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => applyRoutes());
  else applyRoutes();

  // Light mode is the platform-wide default and is intentionally not user-toggleable.
  function enforceLightAppearance() {
    const root = document.documentElement;
    if (root.dataset.theme !== "light") root.dataset.theme = "light";
    if (root.style.colorScheme !== "light") root.style.colorScheme = "light";
    try { if (localStorage.getItem("is-theme") !== "light") localStorage.setItem("is-theme", "light"); } catch (_) {}
  }
  enforceLightAppearance();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enforceLightAppearance, { once: true });
  }
  // Prevent older page scripts or stored preferences from re-applying dark mode.
  try {
    new MutationObserver(enforceLightAppearance).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "style"]
    });
  } catch (_) {}
  window.addEventListener("storage", event => {
    if (event.key === "is-theme" && event.newValue !== "light") enforceLightAppearance();
  });
})();
