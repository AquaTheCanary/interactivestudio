# Interactive Studio published websites

This folder is a separate Vercel project used only to serve published customer websites.

## Vercel project setup

1. Import the GitHub repository `AquaTheCanary/interactivestudio` into Vercel.
2. Set the project's **Root Directory** to `published-sites`.
3. Leave the build command empty; Vercel will deploy the Node.js function in `api/site.js`.
4. Add the environment variable `FIREBASE_API_KEY` using the Firebase Web API key from the existing app configuration.
5. Deploy the project.
6. In the Vercel project's Domains settings, add the wildcard domain `*.is-sites.abrdns.com`. Choose the Nameservers method. Vercel will show the authoritative nameservers for the delegated zone.
7. In ClouDNS, create NS records for the child zone `is-sites.abrdns.com` pointing to the exact Vercel nameservers shown in the Vercel dashboard. Do not replace the nameservers for `abrdns.com`.
8. After the child zone is active in Vercel, recreate the root app DNS record in the Vercel DNS zone: an A record for `@` pointing to Netlify's standard load balancer IP `75.2.60.5`. This keeps `https://is-sites.abrdns.com` serving the main Interactive Studio app on Netlify.
9. Vercel's wildcard domain and certificate will then serve `https://<slug>.is-sites.abrdns.com`.

The wildcard project reads published website documents from the existing Firestore database. Drafts remain private because the handler only serves documents whose status is `published`.

The main app stays on Netlify. The existing Cloudflare Worker remains the API for AI and custom-domain connection; it is not the wildcard website host.
