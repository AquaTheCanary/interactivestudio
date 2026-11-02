// auth-config.js — Complete SSO & Firebase Authentication Handlers
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

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'protonmail.com'];

// Microsoft SSO Handler (Works for Personal & Org)
window.loginWithMicrosoft = async function (enforceOrgDomain = false) {
    try {
        const msalInstance = new msal.PublicClientApplication(msalConfig);
        await msalInstance.initialize();
        const res = await msalInstance.loginPopup({ scopes: ["user.read"] });
        const email = res.account.username.toLowerCase();
        const domain = email.split('@')[1];

        if (enforceOrgDomain && freeDomains.includes(domain)) {
            alert("Access Denied: Organisation login requires a corporate email domain. Please use a work address or sign in via Personal Login.");
            return;
        }

        sessionStorage.setItem("is_user_email", email);
        sessionStorage.setItem("is_user_name", res.account.name || email);
        sessionStorage.setItem("is_user_plan", enforceOrgDomain ? "Organisation" : "Team");
        window.location.href = window.getAppUrl('/dashboard/');
    } catch (err) {
        console.error("Microsoft SSO Error:", err);
        alert("Microsoft Sign-In Error: " + err.message);
    }
};

// Google SSO Handler (Works for Personal & Org)
window.loginWithGoogle = async function (enforceOrgDomain = false) {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const res = await firebase.auth().signInWithPopup(provider);
        const email = res.user.email.toLowerCase();
        const domain = email.split('@')[1];

        if (enforceOrgDomain && freeDomains.includes(domain)) {
            await firebase.auth().signOut();
            alert("Access Denied: Organisation login requires a valid work email domain (e.g., name@company.com). Generic consumer Google accounts are restricted.");
            return;
        }

        sessionStorage.setItem("is_user_email", email);
        sessionStorage.setItem("is_user_name", res.user.displayName || email);
        sessionStorage.setItem("is_user_plan", enforceOrgDomain ? "Organisation" : "Free");
        window.location.href = window.getAppUrl('/dashboard/');
    } catch (err) {
        console.error("Google SSO Error:", err);
        alert("Google Sign-In Error: " + err.message);
    }
};
