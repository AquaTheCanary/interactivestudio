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
})();
