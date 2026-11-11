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
  const paidPlans = new Set(["pro","team","organisation","enterprise","company"]);
  const appUrl = path => window.getAppUrl ? window.getAppUrl(path) : path;
  const authReady = new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      resolve(user || null);
    });
  });

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error => {
    console.error("Firebase persistence setup failed:", error);
  });

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
      const response = await fetch("https://interactive-studio-api.convexllc.workers.dev/assertOrganisationAccess", {
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
      const profile = await studioAuth.getProfile(user);
      localStorage.setItem("is_user_email", profile.email);
      localStorage.setItem("is_user_name", profile.name);
      localStorage.setItem("is_user_photo", profile.photoURL);
      localStorage.setItem("is_user_plan", profile.plan);
      localStorage.setItem("is_user_provider", profile.provider);
      window.location.replace(appUrl("/dashboard/"));
    },
    async signInEmail(email, password, organisation = false) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      if (organisation && !studioAuth.isOrganisationEmail(email)) {
        throw new Error("Organisation login requires a corporate email domain. Gmail, Yahoo, Outlook.com and other personal providers are blocked.");
      }
      const credential = await auth.signInWithEmailAndPassword(email.trim(), password);
      if (!credential.user.emailVerified) {
        try { await credential.user.sendEmailVerification(); } catch (_) {}
        await auth.signOut();
        throw new Error("Your email address is not verified yet. We have sent you a fresh verification link. Open it, then sign in again.");
      }
      await studioAuth.finishSignIn(credential.user, organisation);
    },
    async signInGoogle(organisation = false) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await auth.signInWithPopup(provider);
      await studioAuth.finishSignIn(credential.user, organisation);
    },
    async resetPassword(email) {
      if (!email) throw new Error("Enter your email address first.");
      await auth.sendPasswordResetEmail(email.trim());
    },
    async registerOrganisation({ name, email, password }) {
      if (!studioAuth.isOrganisationEmail(email)) throw new Error("Use a corporate email address to register an organisation account.");
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const credential = await auth.createUserWithEmailAndPassword(email.trim(), password);
      await credential.user.updateProfile({ displayName: name.trim() });
      await credential.user.sendEmailVerification();
      await auth.signOut();
      return true;
    },
    async registerPersonal({ name, email, password }) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const credential = await auth.createUserWithEmailAndPassword(email.trim(), password);
      await credential.user.updateProfile({ displayName: name.trim() });
      await credential.user.sendEmailVerification();
      await auth.signOut();
      return true;
    },
    async signOut() {
      await auth.signOut();
      ["is_user_email","is_user_name","is_user_photo","is_user_plan","is_user_provider"].forEach(key => localStorage.removeItem(key));
      localStorage.removeItem("interactive_studio_session");
      window.location.replace(appUrl("/home/"));
    }
  };

  window.studioAuth = studioAuth;
  window.loginWithGoogle = organisation => studioAuth.signInGoogle(!!organisation).catch(showAuthError);
  window.showAuthError = showAuthError;
  function showAuthError(error) {
    const message = document.querySelector("[data-auth-message]");
    if (message) {
      message.textContent = error.message || "Something went wrong. Please try again.";
      message.className = "auth-message error";
    } else {
      console.error(error);
      window.alert(error.message || "Something went wrong. Please try again.");
    }
  }
})();
