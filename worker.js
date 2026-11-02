const ALLOWED_ORIGINS = new Set([
  "https://aquathecanary.github.io",
  "https://interactivestudio.abrdns.com"
]);
const SYSTEM_PROMPT = "You are Interactive Studio's creative presentation assistant. Help users plan, write and improve clear, accurate, engaging presentations. Be concise and practical.";
const FREE_DOMAINS = new Set(["gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","ymail.com","hotmail.com","hotmail.co.uk","outlook.com","outlook.co.uk","live.com","live.co.uk","msn.com","icloud.com","me.com","mac.com","aol.com","mail.com","proton.me","protonmail.com","gmx.com","gmx.co.uk","yandex.com","hey.com","fastmail.com","pm.me","zoho.com"]);
const PAID_PLANS = new Set(["pro","team","organisation","enterprise","company"]);

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
async function authenticatedUser(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("Sign in is required.");
  if (!env.FIREBASE_API_KEY) throw new Error("Worker setup incomplete: FIREBASE_API_KEY is missing.");
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(env.FIREBASE_API_KEY), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: header.slice(7) })
  });
  const data = await response.json();
  if (!response.ok || !data.users?.[0]) throw new Error("Your sign-in session is invalid or expired. Please sign in again.");
  const user = data.users[0];
  return { uid: user.localId, email: user.email || "", emailVerified: !!user.emailVerified };
}
async function planFor(user, env, token) {
  // Firestore rules allow each signed-in user to read only their own entitlement document.
  const url = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(env.FIREBASE_PROJECT_ID || "interactive-studio-convexllc") +
    "/databases/(default)/documents/userEntitlements/" + encodeURIComponent(user.uid) +
    "?key=" + encodeURIComponent(env.FIREBASE_API_KEY);
  try {
    const response = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (!response.ok) return "basic";
    const doc = await response.json();
    return String(doc.fields?.plan?.stringValue || "Basic").toLowerCase();
  } catch (_) { return "basic"; }
}
function extractGemini(data) {
  return data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
}
async function generate(model, prompt, env) {
  if (model === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("Gemini isn't configured yet. Add GEMINI_API_KEY in Cloudflare Worker secrets.");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1800 } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Gemini request failed.");
    return extractGemini(data);
  }
  if (model === "chatgpt") {
    if (!env.OPENAI_API_KEY) throw new Error("ChatGPT isn't configured yet. Add OPENAI_API_KEY in Cloudflare Worker secrets.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.OPENAI_API_KEY },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }], temperature: 0.7, max_tokens: 1800 })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed.");
    return data.choices?.[0]?.message?.content || "";
  }
  if (model === "claude") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("Claude isn't configured yet. Add ANTHROPIC_API_KEY in Cloudflare Worker secrets.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", system: SYSTEM_PROMPT, max_tokens: 1800, messages: [{ role: "user", content: prompt }] })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Anthropic request failed.");
    return (data.content || []).map(item => item.text || "").join("\n");
  }
  if (model === "copilot") {
    if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY || !env.AZURE_OPENAI_DEPLOYMENT) {
      throw new Error("Copilot Mini needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT in Cloudflare.");
    }
    const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
    const url = endpoint + "/openai/deployments/" + encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT) + "/chat/completions?api-version=2024-10-21";
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json", "api-key": env.AZURE_OPENAI_API_KEY },
      body: JSON.stringify({ messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }], temperature: 0.7, max_tokens: 1800 })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Azure OpenAI request failed.");
    return data.choices?.[0]?.message?.content || "";
  }
  throw new Error("Unknown AI model.");
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
    try {
      const token = (request.headers.get("Authorization") || "").slice(7);
      const user = await authenticatedUser(request, env);
      if (url.pathname === "/assertOrganisationAccess") {
        if (!user.emailVerified) return json({ error: "Verify your corporate email before continuing." }, 403, origin);
        const domain = user.email.toLowerCase().split("@").pop();
        if (!domain || !domain.includes(".") || FREE_DOMAINS.has(domain)) return json({ error: "A corporate email domain is required for organisation access." }, 403, origin);
        return json({ ok: true, domain }, 200, origin);
      }
      if (url.pathname === "/getEntitlements") {
        const plan = await planFor(user, env, token);
        return json({ plan: plan.charAt(0).toUpperCase() + plan.slice(1) }, 200, origin);
      }
      if (url.pathname === "/generateAI") {
        const body = await request.json();
        const model = String(body.model || "gemini").toLowerCase();
        const prompt = String(body.prompt || "").trim().slice(0, 16000);
        if (!prompt) return json({ error: "Enter a prompt." }, 400, origin);
        if (!["gemini", "copilot", "chatgpt", "claude"].includes(model)) return json({ error: "Unknown AI model." }, 400, origin);
        const plan = await planFor(user, env, token);
        if (["chatgpt", "claude"].includes(model) && !PAID_PLANS.has(plan)) return json({ error: "Upgrade to Pro or above to use this model." }, 403, origin);
        const text = await generate(model, prompt, env);
        if (!text) throw new Error("The AI provider returned an empty response.");
        return json({ text, model, plan }, 200, origin);
      }
      return json({ error: "Endpoint not found." }, 404, origin);
    } catch (error) {
      const message = error?.message || "Request failed.";
      const status = /sign in|session is invalid|expired/i.test(message) ? 401 : 500;
      return json({ error: message }, status, origin);
    }
  }
};
