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

  // Interactive Studio uses one consistent, light appearance across every page.
  // Preserve the old preference key for compatibility, but always apply light mode.
  try { localStorage.setItem("is-theme", "light"); } catch (_) {}
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
})();
