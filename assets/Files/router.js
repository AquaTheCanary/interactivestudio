// Shared route resolver for GitHub Pages project subpaths and custom domains.
(function () {
    const isGitHubPages = window.location.hostname.toLowerCase().endsWith(".github.io");
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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => applyRoutes());
    } else {
        applyRoutes();
    }
    window.applyStudioRoutes = applyRoutes;

  // Apply the saved appearance before paint, then expose the toggle in every page footer.
  const themeKey = "is-theme";
  document.documentElement.dataset.theme = localStorage.getItem(themeKey) === "light" ? "light" : "dark";
  function installThemeToggle() {
    let footer = document.querySelector("footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "site-footer";
      document.body.appendChild(footer);
    }
    if (footer.querySelector("[data-theme-toggle]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.themeToggle = "";
    button.className = "theme-toggle";
    const render = () => {
      const light = document.documentElement.dataset.theme === "light";
      button.textContent = light ? "☾ Dark mode" : "☀ Light mode";
      button.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
    };
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(themeKey, next);
      render();
    });
    render();
    (footer.querySelector(".footer-inner") || footer).append(button);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installThemeToggle);
  else installThemeToggle();
})();
