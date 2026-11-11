const PROJECT = "interactive-studio-convexllc";
const ALLOWED_ORIGINS = new Set([
  "https://interactivestudio.abrdns.com",
  "https://aquathecanary.github.io"
]);

function response(res, status, origin) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://interactivestudio.abrdns.com");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(res.body);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://interactivestudio.abrdns.com");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (!ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: "Origin not allowed." });
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Vercel is missing the FIREBASE_API_KEY environment variable." });
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in before requesting email verification." });
  const idToken = authorization.slice(7);
  try {
    const lookup = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    const account = await lookup.json().catch(() => ({}));
    const user = account.users && account.users[0];
    if (!lookup.ok || !user) return res.status(401).json({ error: "Your session has expired. Sign in again." });
    if (user.emailVerified) return res.status(200).json({ ok: true, alreadyVerified: true });
    const sent = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "VERIFY_EMAIL",
        idToken,
        continueUrl: "https://interactivestudio.abrdns.com/auth/personal/login/?verified=1",
        canHandleCodeInApp: false
      })
    });
    const result = await sent.json().catch(() => ({}));
    if (!sent.ok) return res.status(400).json({ error: result.error && result.error.message || "Firebase could not send the verification email." });
    return res.status(200).json({ ok: true, email: user.email || "" });
  } catch (error) {
    console.error("Verification email request failed:", error);
    return res.status(502).json({ error: "The verification email service is temporarily unavailable." });
  }
}
