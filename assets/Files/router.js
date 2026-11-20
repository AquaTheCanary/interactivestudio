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

  const key = "is-theme";
  const readTheme = () => {
    try { return localStorage.getItem(key) === "dark" ? "dark" : "light"; }
    catch (_) { return "light"; }
  };
  const applyTheme = theme => {
    const value = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = value;
    document.documentElement.style.colorScheme = value;
    return value;
  };
  applyTheme(readTheme());

  function installThemeControl() {
    const footer = document.querySelector("footer");
    if (!footer || footer.querySelector("[data-theme-toggle]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.themeToggle = "";
    button.className = "theme-toggle";
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(key, next); } catch (_) {}
      render();
    });
    function render() {
      const dark = document.documentElement.dataset.theme === "dark";
      button.textContent = dark ? "☼ Light appearance" : "◐ Dark appearance";
      button.setAttribute("aria-label", dark ? "Switch to light appearance" : "Switch to dark appearance");
      button.setAttribute("aria-pressed", String(dark));
    }
    render();
    const inner = footer.querySelector(".footer-inner");
    (inner || footer).append(button);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installThemeControl);
  else installThemeControl();
  window.addEventListener("storage", event => {
    if (event.key === key) {
      applyTheme(event.newValue);
      const button = document.querySelector("[data-theme-toggle]");
      if (button) {
        const dark = document.documentElement.dataset.theme === "dark";
        button.textContent = dark ? "☼ Light appearance" : "◐ Dark appearance";
        button.setAttribute("aria-label", dark ? "Switch to light appearance" : "Switch to dark appearance");
        button.setAttribute("aria-pressed", String(dark));
      }
    }
  });
})();