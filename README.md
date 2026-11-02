# Interactive Studio

Interactive Studio is a browser-based creative workspace for building presentations, exploring ideas with AI and sharing work.

## Hosting

The frontend is static and supports both:

- GitHub Pages: `https://aquathecanary.github.io/interactivestudio/`
- Custom domain: `https://interactivestudio.abrdns.com/`

The shared `router.js` detects the GitHub Pages repository subpath and generates the correct internal links.

## Frontend pages

- `/home/` — marketing homepage
- `/products/` — product overview
- `/solutions/` — use cases
- `/resources/` — guides and FAQs
- `/pricing/` — subscription plans
- `/contact/` — support and sales
- `/auth/personal/login/` and `/auth/personal/register/`
- `/auth/organisation/login/` and `/auth/organisation/register/`
- `/dashboard/` — account workspace
- `/editor/` — presentation canvas
- `/ai/` — integrated AI workspace

## Firebase authentication setup

The frontend uses Firebase Authentication for a single consistent user session. Google and Microsoft sign-in both use Firebase OAuth providers, so they share the same Firebase user/session and do not create a separate MSAL-only browser session.

In Firebase Console for project `interactive-studio-convexllc`:

1. Open **Authentication → Sign-in method**.
2. Enable **Email/Password**, **Google**, and **Microsoft**.
3. For Microsoft, create/configure an Entra app registration and enter its client ID and client secret in Firebase's Microsoft provider configuration. Add the Firebase-provided redirect URI to the Entra app registration.
4. Add these authorised domains in **Authentication → Settings → Authorised domains**:
   - `aquathecanary.github.io`
   - `interactivestudio.abrdns.com`
5. Ensure email verification is enabled and test with accounts you control.

Organisation login rejects common consumer email providers in the browser and then calls the server-side `assertOrganisationAccess` function. The server checks the verified Firebase ID token and corporate email domain. This is a corporate-domain filter, not a company-domain allowlist or proof of employment; for a stricter tenant policy, maintain an approved-domain collection and add an administrator provisioning workflow.

## Deploy the secure Firebase backend

The `functions/` directory contains the server-side AI proxy and organisation verification endpoints. Provider keys are read from Firebase Secret Manager and are never shipped to the browser.

Requirements: Node.js 20, Firebase CLI, access to the Firebase project, and a Firestore database.

Install and deploy:

```bash
npm install --prefix functions
firebase login
firebase use interactive-studio-convexllc
firebase deploy --only functions,firestore:rules
```

Set provider secrets before using each live model:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set AZURE_OPENAI_ENDPOINT
firebase functions:secrets:set AZURE_OPENAI_API_KEY
firebase functions:secrets:set AZURE_OPENAI_DEPLOYMENT
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set ANTHROPIC_API_KEY
```

Deploy functions again after setting or rotating secrets:

```bash
firebase deploy --only functions
```

Endpoints:

- `https://us-central1-interactive-studio-convexllc.cloudfunctions.net/assertOrganisationAccess`
- `https://us-central1-interactive-studio-convexllc.cloudfunctions.net/getEntitlements`
- `https://us-central1-interactive-studio-convexllc.cloudfunctions.net/generateAI`

### AI provider notes

- **Gemini Flash** uses the Gemini API and requires `GEMINI_API_KEY`.
- **Copilot Mini** is wired to an Azure OpenAI deployment alias. Microsoft does not provide a general public API endpoint named “Copilot Mini”; configure the Azure deployment you want to use with the three Azure secrets above. Azure usage may incur charges.
- **ChatGPT-4o** uses OpenAI's API and requires `OPENAI_API_KEY`.
- **Claude 3.5 Sonnet** uses Anthropic's Messages API and requires `ANTHROPIC_API_KEY`.

Provider API usage is subject to provider pricing, quotas, account eligibility and model availability. A free Interactive Studio plan does not guarantee a provider will supply unlimited free API usage.

The AI endpoint requires a valid Firebase ID token. It allows Gemini and the configured Azure model on Basic accounts; ChatGPT-4o and Claude require a server-managed paid entitlement.

## Subscription entitlements

The backend reads subscription plans from Firestore collection `userEntitlements`, document ID equal to the Firebase Auth UID:

```json
{
  "plan": "Pro"
}
```

Create/update these documents only through trusted administrator tooling or a secure billing webhook. Firestore rules deliberately deny client writes. Do not use localStorage or browser-supplied plan names to grant paid access.

This repository does not yet include a payment checkout or billing webhook. Until those are implemented, entitlements must be provisioned by an administrator in a trusted environment.

## Current implementation boundaries

- Dashboard/editor drafts are saved in the current browser's localStorage. Cloud project sync is not implemented.
- The editor exports a single slide to PNG/JPEG. Multi-slide export and native installers are not implemented.
- The Share action copies the editor URL; it does not create a secure share token or real-time multiplayer session.
- Organisation checks reject common consumer domains and require verified email. A managed approved-domain registry and administrator provisioning interface remain future work.
- The frontend can be deployed to GitHub Pages independently. Firebase Functions and Firestore rules must be deployed separately using the Firebase CLI.

## Security

Never commit provider API keys, Microsoft client secrets, Firebase service-account JSON, private signing keys or other credentials to this repository. Use Firebase Secret Manager for backend provider credentials.
