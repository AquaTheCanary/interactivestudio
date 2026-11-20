# Project Firebase backend

This repository uses one Firebase project for the Project platform and its four products.

- Firebase project ID: `interactive-studio-convexllc` (the Firebase display name can be Project).
- Project: user profiles, workspaces and organisations.
- Presentr: `presentations` and nested `slides`.
- Siteify: `siteProjects` and nested `pages`.
- Formr: `formProjects` and nested `responses`.
- Cloudbase: `cloudbaseFiles` metadata; file bytes are stored in Firebase Storage at `users/{uid}/cloudbase/**`.

## Local setup

1. Install Node.js 20 and the Firebase CLI.
2. From the repository root run `npm install -g firebase-tools`.
3. Sign in with `firebase login`.
4. Confirm the selected project with `firebase projects:list`.
5. Deploy rules first: `firebase deploy --only firestore:rules,storage`.
6. Deploy Functions separately after reviewing required secrets and billing: `firebase deploy --only functions`.

The root `firebase.json` and `.firebaserc` select the existing Firebase project. The Firebase web configuration remains in `assets/Files/auth-config.js`; the API key there is a public web-app identifier, not a server secret.

## Important

- Do not put Admin SDK credentials or service-account JSON in the website.
- Firestore and Storage rules are the security boundary. Keep new collections private by default.
- The current legacy collections (`rooms`, `forms`, `websites`, and related collections) are retained while the product apps migrate to the product-specific collections above.
- **Billing constraint (important):** Firebase Cloud Storage requires the Blaze plan to provision or access buckets (requirement effective February 3, 2026). Cloud Functions deployment also requires Blaze. Do not upgrade or add billing unless you explicitly choose to. On Spark, the Cloudbase Storage rules can be prepared in this repository, but Firebase Storage uploads/downloads will not work. We can keep Cloudbase metadata in Firestore and later connect a no-Blaze object-storage provider such as Cloudflare R2 for file bytes.
- Authentication providers (Google, email/password, Microsoft if configured through OIDC) must be enabled in Firebase Console. Rules do not enable providers automatically.
