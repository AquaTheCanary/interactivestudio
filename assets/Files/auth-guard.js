// Shared protection for all authenticated workspace routes.
(function () {
  const current = location.pathname + location.search + location.hash;
  const safeReturn = current.startsWith("/") && !current.startsWith("//") && !current.startsWith("/auth/");
  document.documentElement.style.visibility = "hidden";
  const goToLogin = () => {
    if (safeReturn) {
      try { sessionStorage.setItem("studio_return_to", current); } catch (_) {}
    }
    const login = (window.getAppUrl ? window.getAppUrl("/auth/personal/login/") : "/auth/personal/login/");
    location.replace(login);
  };
  const authCheck = Promise.resolve(window.studioAuth && studioAuth.currentUser());
  const fallback = new Promise(resolve => setTimeout(() => resolve("__auth_timeout__"), 10000));
  Promise.race([authCheck, fallback])
    .then(user => {
      if (user === "__auth_timeout__") {
        console.error("Workspace auth check timed out. Showing recovery UI instead of leaving the page blank.");
        document.documentElement.style.visibility = "";
        document.documentElement.dataset.authCheckTimeout = "true";
        return;
      }
      if (!user) { goToLogin(); return; }
      document.documentElement.style.visibility = "";
      document.documentElement.dataset.authenticated = "true";
    })
    .catch(error => {
      console.error("Workspace authentication check failed:", error);
      goToLogin();
    });
})();
