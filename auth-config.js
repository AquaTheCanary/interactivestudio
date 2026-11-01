// auth-config.js — SSO & Firebase Configuration

// 1. Firebase Configuration (Google SSO + Email Verification)
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAHQDuRXq77XRZvnE-dDuoy8A1TLLtfSy8",
  authDomain: "interactive-studio-convexllc.firebaseapp.com",
  projectId: "interactive-studio-convexllc",
  storageBucket: "interactive-studio-convexllc.firebasestorage.app",
  messagingSenderId: "405382386557",
  appId: "1:405382386557:web:bd91219c8797218fb2b214",
  measurementId: "G-9JSV264WHB"
};

// 2. Microsoft MSAL Configuration (Enterprise SSO)
const msalConfig = {
    auth: {
        clientId: "9be15a5a-1acc-4365-bdbd-6f206627af88", // Azure AD Application (client) ID
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin + (window.getAppUrl ? window.getAppUrl('/dashboard/') : '/dashboard/')
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
    }
};

// Global helper for Microsoft Login
window.loginWithMicrosoft = async function () {
    try {
        const msalInstance = new msal.PublicClientApplication(msalConfig);
        await msalInstance.initialize();
        const loginResponse = await msalInstance.loginPopup({
            scopes: ["user.read"]
        });
        sessionStorage.setItem("is_user_email", loginResponse.account.username);
        sessionStorage.setItem("is_user_name", loginResponse.account.name || loginResponse.account.username);
        window.location.href = window.getAppUrl('/dashboard/');
    } catch (error) {
        console.error("Microsoft SSO Error:", error);
        alert("Microsoft SSO failed: " + error.message);
    }
};
