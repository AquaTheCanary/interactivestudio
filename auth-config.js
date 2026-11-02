// Interactive Studio shared authentication configuration.
// Firebase web config is public by design; never place service-account credentials here.
const firebaseConfig = {
    apiKey: "AIzaSyAHQDuRXq77XRZvnE-dDuoy8A1TLtfSy8",
    authDomain: "interactive-studio-convexllc.firebaseapp.com",
    projectId: "interactive-studio-convexllc",
    storageBucket: "interactive-studio-convexllc.firebasestorage.app",
    messagingSenderId: "405382386557",
    appId: "1:405382386557:web:bd91219c8797218fb2b214",
    measurementId: "G-9JSV264WHB"
};

const msalConfig = {
    auth: {
        clientId: "9be15a5a-1acc-4365-bdbd-6f206627af88",
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin + (window.getAppUrl ? window.getAppUrl("/auth/personal/login/") : "/auth/personal/login/")
    },
    cache: { cacheLocation: "localStorage", storeAuthStateInCookie: true }
};

if (!window.firebase) throw new Error("Firebase SDK must load before auth-config.js.");
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

window.studioAuth = window.studioAuth || {};
const studioAuth = window.studioAuth;
studioAuth.auth = firebase.auth();
studioAuth.freeEmailDomains = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
    "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.co.uk", "live.com",
    "live.co.uk", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com",
    "mail.com", "proton.me", "protonmail.com", "gmx.com", "gmx.co.uk",
    "yandex.com", "hey.com", "fastmail.com"
]);

studioAuth.ready = studioAuth.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => console.error("Could not enable persistent Firebase sessions:", error));

studioAuth.isOrganisationEmail = function (email) {
    const value = String(email || "").trim().toLowerCase();
    const parts = value.split("@");
    return parts.length === 2 && parts[0].length > 0 &&
        parts[1].includes(".") && !studioAuth.freeEmailDomains.has(parts[1]);
};

studioAuth.saveSession = function ({ email, name, photoURL, plan = "Basic", provider = "password", uid = "" }) {
    const profile = {
        email: String(email || "").toLowerCase(),
        name: name || email || "Creator",
        photoURL: photoURL || "",
        plan,
        provider,
        uid,
        updatedAt: new Date().toISOString()
    };
    localStorage.setItem("is_user_email", profile.email);
    localStorage.setItem("is_user_name", profile.name);
    localStorage.setItem("is_user_photo", profile.photoURL);
    localStorage.setItem("is_user_plan", profile.plan);
    localStorage.setItem("is_user_provider", profile.provider);
    localStorage.setItem("is_user_uid", profile.uid);
    localStorage.setItem("interactive_studio_session", JSON.stringify(profile));
    return profile;
};

studioAuth.getSession = function () {
    const user = studioAuth.auth.currentUser;
    if (user) {
        return {
            email: user.email || "",
            name: user.displayName || user.email || "Creator",
            photoURL: user.photoURL || "",
            plan: localStorage.getItem("is_user_plan") || "Basic",
            provider: user.providerData?.[0]?.providerId || "firebase",
            uid: user.uid
        };
    }
    try {
        const saved = JSON.parse(localStorage.getItem("interactive_studio_session") || "null");
        return saved && saved.email ? saved : null;
    } catch (_) {
        return null;
    }
};

studioAuth.requireSession = function (redirectPath = "/auth/personal/login/") {
    const session = studioAuth.getSession();
    if (!session) {
        window.location.replace(window.getAppUrl ? window.getAppUrl(redirectPath) : redirectPath);
        return false;
    }
    return true;
};

studioAuth.completeLogin = function (profile, plan) {
    studioAuth.saveSession({
        email: profile.email,
        name: profile.name || profile.displayName || profile.email,
        photoURL: profile.photoURL || "",
        plan,
        provider: profile.provider || "unknown",
        uid: profile.uid || profile.localAccountId || ""
    });
    window.location.replace(window.getAppUrl ? window.getAppUrl("/dashboard/") : "/dashboard/");
};

window.loginWithGoogle = async function (enforceOrg = false) {
    try {
        await studioAuth.ready;
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const credential = await studioAuth.auth.signInWithPopup(provider);
        const user = credential.user;
        if (enforceOrg && !studioAuth.isOrganisationEmail(user.email)) {
            await studioAuth.auth.signOut();
            throw new Error("Organisation access requires a verified corporate Google Workspace email. Free personal email providers are not accepted.");
        }
        studioAuth.completeLogin({
            email: user.email,
            name: user.displayName,
            photoURL: user.photoURL,
            uid: user.uid,
            provider: "google"
        }, enforceOrg ? "Organisation" : "Basic");
    } catch (error) {
        console.error("Google sign-in:", error);
        window.alert("Google sign-in failed: " + (error.message || "Please try again."));
    }
};

window.loginWithMicrosoft = async function (enforceOrg = false) {
    try {
        if (!window.msal) throw new Error("Microsoft sign-in library did not load. Refresh and try again.");
        const instance = new msal.PublicClientApplication(msalConfig);
        await instance.initialize();
        const result = await instance.loginPopup({
            scopes: ["openid", "profile", "email", "User.Read"],
            prompt: "select_account"
        });
        const account = result.account;
        const email = account.username || account.idTokenClaims?.preferred_username || account.idTokenClaims?.email;
        if (!email) throw new Error("Microsoft did not return an email address.");
        if (enforceOrg && !studioAuth.isOrganisationEmail(email)) {
            await instance.logoutPopup({ account });
            throw new Error("Organisation access requires a corporate Microsoft Entra account. Free Outlook, Hotmail and other personal email providers are not accepted.");
        }
        studioAuth.completeLogin({
            email,
            name: account.name || email,
            uid: account.localAccountId,
            provider: "microsoft"
        }, enforceOrg ? "Organisation" : "Basic");
    } catch (error) {
        console.error("Microsoft sign-in:", error);
        window.alert("Microsoft sign-in failed: " + (error.message || "Please try again."));
    }
};

studioAuth.signOut = async function () {
    try { await studioAuth.auth.signOut(); } catch (error) { console.warn(error); }
    localStorage.removeItem("interactive_studio_session");
    ["is_user_email", "is_user_name", "is_user_photo", "is_user_plan", "is_user_provider", "is_user_uid"].forEach(key => localStorage.removeItem(key));
    window.location.replace(window.getAppUrl ? window.getAppUrl("/home/") : "/home/");
};
