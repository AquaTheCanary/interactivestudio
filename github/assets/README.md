# Interactive Studio

Interactive Studio is a browser-based creative workspace for building presentations, sharing interactive sessions and publishing websites.

## Hosting

The frontend is static and supports:

- GitHub Pages: `https://aquathecanary.github.io/interactivestudio/`
- Custom domain: `https://interactivestudio.abrdns.com/`

The shared `router.js` detects the GitHub Pages repository subpath and generates the correct internal links.

## Frontend pages

- `/home/` — homepage
- `/products/` — product overview
- `/solutions/` — use cases
- `/resources/` — guides and FAQs
- `/pricing/` — confirms the free-forever policy; no paid tiers are offered
- `/contact/` — support and partnerships
- `/auth/personal/login/` and `/auth/personal/register/`
- `/auth/organisation/login/` and `/auth/organisation/register/`
- `/dashboard/` — account workspace
- `/editor/` — presentation canvas
- `/websites/` — website builder and publishing

The former `/ai/` route redirects to the presentation editor. Built-in AI integrations and provider API calls have been removed.

## Firebase authentication

The frontend uses Firebase Authentication for a consistent user session. Google and Microsoft sign-in use Firebase OAuth providers.

In Firebase Console for project `interactive-studio-convexllc`:

1. Open **Authentication → Sign-in method**.
2. Enable **Email/Password**, **Google**, and **Microsoft** as required.
3. For Microsoft, configure an Entra app registration and enter its client ID and client secret in Firebase.
4. Add the authorised domains:
   - `aquathecanary.github.io`
   - `interactivestudio.abrdns.com`
5. Enable email verification and test with accounts you control.

Organisation login applies a corporate-domain check and calls the server-side `assertOrganisationAccess` endpoint. This is a corporate-domain filter, not proof of employment or a company-domain allowlist.

## Cloudflare Worker and website publishing

The `assets/files/worker.js` file contains the all-in-one Cloudflare Worker for the platform API and published website routing. It uses Firebase Authentication and Firestore to verify ownership and read published website records.

Worker configuration may include:

- `FIREBASE_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_SAAS_TARGET`

Only configure the Cloudflare values needed by the enabled publishing and custom-domain routes. Keep all secrets in Cloudflare Worker secrets, never in frontend files or Git.

The Worker deployment workflow is in `.github/workflows/worker.yml`. It requires GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Firebase backend

The `functions/` directory contains the organisation access verification endpoint. The built-in AI proxy and paid subscription entitlement functions have been removed.

Requirements: Node.js 20, Firebase CLI and access to the Firebase project.

Install and deploy:

```bash
npm install --prefix functions
firebase login
firebase use interactive-studio-convexllc
firebase deploy --only functions,firestore:rules
```

If Firebase reports that previously deployed `generateAI` or `getEntitlements` functions are no longer present, approve their deletion. They are obsolete and are not used by the current app.

## Product policy

- Interactive Studio is free for every account.
- There are no paid plans, subscriptions, billing webhooks or paid feature gates.
- No built-in AI model integrations or AI provider API keys are required.
- Website publishing and custom-domain availability still depend on the relevant DNS, Cloudflare and provider configuration.

## Current implementation boundaries

- Presentation drafts are saved in the current browser's localStorage.
- The editor exports a single slide to PNG/JPEG; multi-slide export is not implemented.
- Website records and publishing are account-backed through Firebase and the Cloudflare Worker.
- Organisation checks reject common consumer email domains and require verified email; a managed approved-domain registry remains future work.
- GitHub Pages and the Cloudflare Worker are deployed separately.

## Security

Never commit API keys, Microsoft client secrets, Firebase service-account JSON, private signing keys or other credentials to this repository. Keep backend credentials in the relevant provider's secret manager.
