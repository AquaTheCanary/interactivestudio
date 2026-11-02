// auth-config.js — Firebase & Microsoft SSO Configuration
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
        // Dynamically adapts whether running on GitHub Pages or custom domain
        redirectUri: window.location.origin + (window.getAppUrl ? window.getAppUrl('/dashboard/') : '/dashboard/')
    },
    cache: { 
        cacheLocation: "sessionStorage", 
        storeAuthStateInCookie: false 
    }
};

window.loginWithMicrosoft = async function () {
    try {
        const msalInstance = new msal.PublicClientApplication(msalConfig);
        await msalInstance.initialize();
        const res = await msalInstance.loginPopup({ 
            scopes: ["user.read"] 
        });
        sessionStorage.setItem("is_user_email", res.account.username);
        sessionStorage.setItem("is_user_name", res.account.name || res.account.username);
        sessionStorage.setItem("is_user_plan", "Team");
        window.location.href = window.getAppUrl ? window.getAppUrl('/dashboard/') : '/dashboard/';
    } catch (err) {
        console.error("Microsoft SSO Error:", err);
        alert("Microsoft SSO Failed: " + err.message);
    }
};
