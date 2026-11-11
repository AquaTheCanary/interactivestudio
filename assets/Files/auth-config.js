// Interactive Studio authentication shared by every account page.
// Google and email/password are the supported sign-in methods.
const firebaseConfig = {
  apiKey: "AIzaSyAHQDuRXq77XRZvnE-dDuoy8A1TLLtfSy8",
  authDomain: "interactive-studio-convexllc.firebaseapp.com",
  projectId: "interactive-studio-convexllc",
  storageBucket: "interactive-studio-convexllc.firebasestorage.app",
  messagingSenderId: "405382386557",
  appId: "1:405382386557:web:bd91219c8797218fb2b214",
  measurementId: "G-9JSV264WHB"
};
if (!window.firebase) throw new Error("Load Firebase App and Auth compat SDK before auth-config.js.");
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

(function () {
  const auth = firebase.auth();
  const freeDomains = new Set([
    "gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","ymail.com",
    "hotmail.com","hotmail.co.uk","outlook.com","outlook.co.uk","live.com",
    "live.co.uk","msn.com","icloud.com","me.com","mac.com","aol.com",
    "mail.com","proton.me","protonmail.com","gmx.com","gmx.co.uk",
    "yandex.com","hey.com","fastmail.com","pm.me","zoho.com"
  ]);
  const paidPlans = new Set(); // No paid tiers: every feature is included in the free plan.
  const appUrl = path => window.getAppUrl ? window.getAppUrl(path) : path;
  // Set durable browser persistence before resolving the initial auth state.
  // This prevents page guards from briefly treating a returning user as signed out.
  const authReady = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => {
      console.error("Firebase persistence setup failed:", error);
    })
    .then(() => new Promise(resolve => {
      const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe();
        resolve(user || null);
      });
    }));

  // Shared session policy: 60 minutes without activity, or 30 minutes after
  // the last open app tab is closed. Activity is synchronised across tabs.
  const SESSION_KEY = "interactive_studio_session_v2";
  const TAB_KEY = "interactive_studio_tab_v2";
  const IDLE_LIMIT = 60 * 60 * 1000;
  const CLOSED_LIMIT = 30 * 60 * 1000;
  const HEARTBEAT = 15000;
  let sessionTimer = null;
  let sessionTabId = null;
  let sessionEnding = false;
  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}"); }
    catch (_) { return {}; }
  }
  function writeSession(value) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch (_) {}
  }
  function beginFreshSession() {
    const now = Date.now();
    writeSession({ lastActivity: now, lastSeen: now, closedAt: 0, tabs: {} });
  }
  function sessionTabs(state, now) {
    const tabs = state.tabs && typeof state.tabs === "object" ? state.tabs : {};
    Object.keys(tabs).forEach(id => { if (!tabs[id] || now - tabs[id] > 60000) delete tabs[id]; });
    state.tabs = tabs;
    return tabs;
  }
  async function expireSession(reason) {
    if (sessionEnding) return;
    sessionEnding = true;
    const accountType = localStorage.getItem("is_user_account_type") === "organisation" ? "organisation" : "personal";
    if (sessionTimer) clearInterval(sessionTimer);
    const state = readSession();
    state.tabs = {};
    state.closedAt = Date.now();
    writeSession(state);
    try { await auth.signOut(); } catch (_) {}
    ["is_user_email","is_user_name","is_user_photo","is_user_plan","is_user_provider","is_user_account_type"].forEach(key => localStorage.removeItem(key));
    sessionEnding = false;
    if (location.pathname.indexOf("/auth/") !== 0) {
      const target = appUrl("/auth/" + accountType + "/login/") + "?reason=" + encodeURIComponent(reason || "session-ended");
      location.replace(target);
    }
  }
  function startSessionLifecycle(user) {
    if (!user || sessionTimer) return;
    const now = Date.now();
    const state = readSession();
    const tabs = sessionTabs(state, now);
    const otherTabsOpen = Object.keys(tabs).length > 0;
    const lastActivity = Number(state.lastActivity || state.lastSeen || now);
    const closedAt = Number(state.closedAt || 0);
    const lastSeen = Number(state.lastSeen || 0);
    const closedTooLong = !otherTabsOpen && ((closedAt && now - closedAt >= CLOSED_LIMIT) || (!closedAt && lastSeen && now - lastSeen >= CLOSED_LIMIT));
    if (now - lastActivity >= IDLE_LIMIT || closedTooLong) {
      expireSession(closedTooLong ? "tab-closed" : "inactivity");
      return;
    }
    sessionTabId = sessionStorage.getItem(TAB_KEY);
    if (!sessionTabId) {
      sessionTabId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "tab-" + Math.random().toString(36).slice(2);
      sessionStorage.setItem(TAB_KEY, sessionTabId);
    }
    tabs[sessionTabId] = now;
    state.tabs = tabs;
    state.lastSeen = now;
    state.lastActivity = lastActivity;
    state.closedAt = 0;
    writeSession(state);
    const markActivity = () => {
      const current = readSession();
      current.tabs = sessionTabs(current, Date.now());
      current.tabs[sessionTabId] = Date.now();
      current.lastActivity = Date.now();
      current.lastSeen = Date.now();
      current.closedAt = 0;
      writeSession(current);
    };
    let lastActivityWrite = 0;
    const onActivity = () => {
      if (Date.now() - lastActivityWrite < 10000) return;
      lastActivityWrite = Date.now();
      markActivity();
    };
    ["pointerdown","pointermove","mousemove","keydown","touchstart","scroll","wheel","input","click"].forEach(type => addEventListener(type, onActivity, { passive: true }));
    addEventListener("storage", event => {
      if (event.key !== SESSION_KEY || !event.newValue) return;
      const latest = readSession();
      if (Date.now() - Number(latest.lastActivity || 0) >= IDLE_LIMIT) expireSession("inactivity");
    });
    addEventListener("pagehide", () => {
      if (sessionEnding) return;
      const current = readSession();
      current.tabs = sessionTabs(current, Date.now());
      delete current.tabs[sessionTabId];
      current.lastSeen = Date.now();
      if (!Object.keys(current.tabs).length) current.closedAt = Date.now();
      writeSession(current);
    });
    sessionTimer = setInterval(() => {
      const current = readSession();
      const stamp = Date.now();
      current.tabs = sessionTabs(current, stamp);
      current.tabs[sessionTabId] = stamp;
      current.lastSeen = stamp;
      if (stamp - Number(current.lastActivity || current.lastSeen || stamp) >= IDLE_LIMIT) {
        writeSession(current);
        expireSession("inactivity");
        return;
      }
      writeSession(current);
    }, HEARTBEAT);
  }

  const studioAuth = {
    auth,
    ready: authReady,
    freeDomains,
    paidPlans,
    isOrganisationEmail(email) {
      const value = String(email || "").trim().toLowerCase();
      const at = value.lastIndexOf("@");
      if (at < 1) return false;
      const domain = value.slice(at + 1);
      return domain.includes(".") && !freeDomains.has(domain) &&
        !domain.startsWith(".") && !domain.endsWith(".");
    },
    async currentUser() {
      await authReady;
      if (studioAuth.redirectReady) await studioAuth.redirectReady;
      return auth.currentUser;
    },
    async getProfile(user) {
      const activeUser = user || await studioAuth.currentUser();
      if (!activeUser) return null;
      let claims = {};
      try { claims = (await activeUser.getIdTokenResult()).claims || {}; } catch (_) {}
      const verifiedPlan = "Free";
      return {
        uid: activeUser.uid,
        email: activeUser.email || "",
        name: activeUser.displayName || activeUser.email || "Creator",
        photoURL: activeUser.photoURL || "",
        emailVerified: !!activeUser.emailVerified,
        provider: activeUser.providerData?.[0]?.providerId || "password",
        plan: verifiedPlan,
        organisationId: claims.organisationId || null
      };
    },
    async requireUser(redirect = "/auth/personal/login/") {
      const user = await studioAuth.currentUser();
      if (!user) {
        window.location.replace(appUrl(redirect));
        return null;
      }
      return user;
    },
    async validateOrganisation(user) {
      if (!user || !studioAuth.isOrganisationEmail(user.email)) {
        throw new Error("Use a verified corporate email address. Consumer email providers are not accepted for organisation accounts.");
      }
      if (!user.emailVerified) {
        throw new Error("Verify your corporate email address before accessing an organisation workspace.");
      }
      const token = await user.getIdToken();
      const response = await fetch("https://interactive-studio.convexllc.workers.dev/assertOrganisationAccess", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Organisation verification failed.");
      return true;
    },
    async finishSignIn(user, organisation = false) {
      if (organisation) { try { await studioAuth.validateOrganisation(user); } catch (error) { await auth.signOut(); throw error; } }
      const session = readSession();
      session.lastActivity = Date.now();
      session.lastSeen = Date.now();
      session.closedAt = 0;
      session.tabs = sessionTabs(session, Date.now());
      writeSession(session);
      const profile = await studioAuth.getProfile(user);
      localStorage.setItem("is_user_email", profile.email);
      localStorage.setItem("is_user_name", profile.name);
      localStorage.setItem("is_user_photo", profile.photoURL);
      localStorage.setItem("is_user_plan", profile.plan);
      localStorage.setItem("is_user_provider", profile.provider);
      localStorage.setItem("is_user_account_type", organisation ? "organisation" : "personal");
      window.location.replace(appUrl("/dashboard/"));
    },
    async signInEmail(email, password, organisation = false) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      if (organisation && !studioAuth.isOrganisationEmail(email)) {
        throw new Error("Organisation login requires a corporate email domain. Gmail, Yahoo, Outlook.com and other personal providers are blocked.");
      }
      beginFreshSession();
      const credential = await auth.signInWithEmailAndPassword(email.trim(), password);
      if (!credential.user.emailVerified) {
        let sendError = null;
        try { await studioAuth.sendVerificationEmail(credential.user); } catch (error) { sendError = error; }
        await auth.signOut();
        if (sendError) throw new Error("Your email is not verified, and the verification email could not be sent: " + sendError.message);
        throw new Error(organisation
          ? "Your work email is not verified yet. We sent a fresh verification link. Verify it, then sign in again."
          : "Your email is not verified yet. We sent a fresh verification link. Verify it, then sign in again.");
      }
      await studioAuth.finishSignIn(credential.user, organisation);
    },
    async completeRedirectSignIn() {
      await authReady;
      try {
        const credential = await auth.getRedirectResult();
        if (!credential || !credential.user) return false;
        const organisation = sessionStorage.getItem("studio_sso_organisation") === "true";
        sessionStorage.removeItem("studio_sso_organisation");
        await studioAuth.finishSignIn(credential.user, organisation);
        return true;
      } catch (error) {
        sessionStorage.removeItem("studio_sso_organisation");
        showAuthError(error);
        return false;
      }
    },
    async signInGoogle(organisation = false) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      beginFreshSession();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return studioAuth.runSSO(provider, organisation);
    },
    async runSSO(provider, organisation) {
      try {
        const credential = await auth.signInWithPopup(provider);
        await studioAuth.finishSignIn(credential.user, organisation);
      } catch (error) {
        const redirectCodes = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"];
        if (redirectCodes.includes(error.code)) {
          sessionStorage.setItem("studio_sso_organisation", organisation ? "true" : "false");
          await auth.signInWithRedirect(provider);
          return;
        }
        throw error;
      }
    },
    async sendVerificationEmail(user) {
      const activeUser = user || await studioAuth.currentUser();
      if (!activeUser) throw new Error("Sign in before requesting a verification email.");
      const token = await activeUser.getIdToken(true);
      const response = await fetch("https://interactivestudio.vercel.app/api/send-verification", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "We could not send your verification email. Please try again.");
      return true;
    },
    async resetPassword(email) {
      if (!email) throw new Error("Enter your email address first.");
      await auth.sendPasswordResetEmail(email.trim());
    },
    async registerOrganisation({ name, email, password }) {
      if (!studioAuth.isOrganisationEmail(email)) throw new Error("Use a corporate email address to register an organisation account.");
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      beginFreshSession();
      const credential = await auth.createUserWithEmailAndPassword(email.trim(), password);
      await credential.user.updateProfile({ displayName: name.trim() });
      await studioAuth.sendVerificationEmail(credential.user);
      await auth.signOut();
      return true;
    },
    async registerPersonal({ name, email, password }) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      beginFreshSession();
      const credential = await auth.createUserWithEmailAndPassword(email.trim(), password);
      await credential.user.updateProfile({ displayName: name.trim() });
      await studioAuth.sendVerificationEmail(credential.user);
      await auth.signOut();
      return true;
    },
    async signOut() {
      sessionEnding = true;
      await auth.signOut();
      ["is_user_email","is_user_name","is_user_photo","is_user_plan","is_user_provider","is_user_account_type"].forEach(key => localStorage.removeItem(key));
      localStorage.removeItem("interactive_studio_session");
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(TAB_KEY);
      window.location.replace(appUrl("/home/"));
    }
  };

  // Resolve redirect-based SSO before page guards inspect the signed-in user.
  // Firebase LOCAL persistence survives navigation, reloads and browser restarts.
  studioAuth.redirectReady = Promise.resolve().then(() => studioAuth.completeRedirectSignIn());

  auth.onAuthStateChanged(user => { if (user) startSessionLifecycle(user); else { if (sessionTimer) clearInterval(sessionTimer); sessionTimer = null; } });

  window.studioAuth = studioAuth;
  window.loginWithGoogle = organisation => studioAuth.signInGoogle(!!organisation).catch(showAuthError);
  window.showAuthError = showAuthError;
  function showAuthError(error) {
    const messages = {
      "auth/unauthorized-domain": "This website domain is not authorised in Firebase. Add interactivestudio.abrdns.com and aquathecanary.github.io under Firebase Authentication → Settings → Authorised domains.",
      "auth/operation-not-allowed": "This sign-in provider is not enabled yet. Enable Google in Firebase Authentication → Sign-in method.",
      "auth/popup-closed-by-user": "The sign-in window was closed before sign-in finished. Please try again.",
      "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
      "auth/network-request-failed": "A network error interrupted sign-in. Check your connection and try again.",
      "auth/account-exists-with-different-credential": "An account already exists with this email using another sign-in method. Sign in with that method first."
    };
    const detail = messages[error && error.code] || (error && error.message) || "Something went wrong. Please try again.";
    const message = document.querySelector("[data-auth-message]");
    if (message) {
      message.textContent = detail;
      message.className = "auth-message error";
    } else {
      console.error(error);
      window.alert(detail);
    }
  }
})();
