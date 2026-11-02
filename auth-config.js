// auth-config.js — Unified Auth & SSO Core
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
        redirectUri: window.location.origin + (window.getAppUrl ? window.getAppUrl('/dashboard/') : '/dashboard/')
    },
    cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'proton.me'];

window.loginWithGoogle = async function (enforceOrg = false) {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const res = await firebase.auth().signInWithPopup(provider);
        const email = res.user.email.toLowerCase();
        const domain = email.split('@')[1];

        if (enforceOrg && freeEmailDomains.includes(domain)) {
            await firebase.auth().signOut();
            alert("Access Denied: Organisation login requires a corporate work domain. Consumer Google accounts are blocked.");
            return;
        }

        sessionStorage.setItem("is_user_email", email);
        sessionStorage.setItem("is_user_name", res.user.displayName || email);
        sessionStorage.setItem("is_user_plan", enforceOrg ? "Organisation" : "Free");
        window.location.href = window.getAppUrl('/dashboard/');
    } catch (err) {
        alert("Google Sign-In Failed: " + err.message);
    }
};

window.loginWithMicrosoft = async function (enforceOrg = false) {
    try {
        const msalInstance = new msal.PublicClientApplication(msalConfig);
        await msalInstance.initialize();
        const res = await msalInstance.loginPopup({ scopes: ["user.read"] });
        const email = res.account.username.toLowerCase();
        const domain = email.split('@')[1];

        if (enforceOrg && freeEmailDomains.includes(domain)) {
            alert("Access Denied: Organisation login requires a corporate work domain.");
            return;
        }

        sessionStorage.setItem("is_user_email", email);
        sessionStorage.setItem("is_user_name", res.account.name || email);
        sessionStorage.setItem("is_user_plan", enforceOrg ? "Organisation" : "Team");
        window.location.href = window.getAppUrl('/dashboard/');
    } catch (err) {
        alert("Microsoft Sign-In Failed: " + err.message);
    }
};
