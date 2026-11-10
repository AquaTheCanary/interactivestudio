const ALLOWED_ORIGINS = new Set([
  "https://aquathecanary.github.io",
  "https://interactivestudio.abrdns.com",
  "https://is-sites.abrdns.com"
]);
const SYSTEM_PROMPT = "You are Interactive Studio's creative presentation assistant. Help users plan, write and improve clear, accurate, engaging presentations. Be concise and practical.";
const FREE_DOMAINS = new Set(["gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","ymail.com","hotmail.com","hotmail.co.uk","outlook.com","outlook.co.uk","live.com","live.co.uk","msn.com","icloud.com","me.com","mac.com","aol.com","mail.com","proton.me","protonmail.com","gmx.com","gmx.co.uk","yandex.com","hey.com","fastmail.com","pm.me","zoho.com"]);

const PLATFORM_HOST = "is-sites.abrdns.com";
const API_HOST = "interactive-studio.convexllc.workers.dev";
const FIREBASE_PROJECT_ID = "interactive-studio-convexllc";

function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if (value.mapValue) return decodeFirestoreFields(value.mapValue.fields || {});
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  return null;
}
function decodeFirestoreFields(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields || {})) result[key] = decodeFirestoreValue(value);
  return result;
}
async function readPublicDocument(collection, id, env) {
  if (!env.FIREBASE_API_KEY) throw new Error("Website publishing is not configured: FIREBASE_API_KEY is missing.");
  const endpoint = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" + collection + "/" + encodeURIComponent(id) +
    "?key=" + encodeURIComponent(env.FIREBASE_API_KEY);
  const response = await fetch(endpoint, { headers: { "Accept": "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load the published website.");
  const document = await response.json();
  return decodeFirestoreFields(document.fields || {});
}
function escapeHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[character]);
}
function safeColour(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}
function safeLink(value) {
  const link = String(value || "").trim();
  if (!link) return "";
  try {
    const parsed = new URL(link);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol) ? link : "";
  } catch (_) { return ""; }
}
function renderPublishedSite(site, hostname) {
  const title=escapeHTML(site.siteName||site.title||"Website"),description=escapeHTML(site.description||"");
  const accent=safeColour(site.accent,"#635bff"),background=safeColour(site.background,"#f7f8fc"),textColour=safeColour(site.textColour,"#252638");
  const sections=Array.isArray(site.sections)&&site.sections.length?site.sections:[{type:"hero",eyebrow:site.eyebrow||"",title:site.headline||title,text:site.subheadline||"",background,accent,align:"center"},...(site.body?[{type:"text",title:"About",text:site.body}]:[]),...(site.buttonLabel?[{type:"button",title:"",buttonLabel:site.buttonLabel,buttonUrl:site.buttonUrl}]:[])];
  const render=s=>{
    const bg=safeColour(s.background,"#fff"),c=safeColour(s.accent,accent),a=["left","center","right"].includes(s.align)?s.align:"center";
    if(s.type==="hero")return '<section style="padding:76px 7%;background:'+bg+';color:'+textColour+';text-align:'+a+'"><div style="color:'+c+';font-size:11px;font-weight:850;letter-spacing:.16em">'+escapeHTML(s.eyebrow||"")+'</div><h1 style="font-size:clamp(38px,7vw,82px);line-height:1.03;letter-spacing:-.07em;margin:18px 0">'+escapeHTML(s.title||title)+'</h1><p style="font-size:clamp(17px,2.2vw,23px);line-height:1.65;max-width:760px;margin:0 auto">'+escapeHTML(s.text||"")+'</p></section>';
    if(s.type==="text")return '<section style="padding:54px 8%;background:'+bg+';color:'+textColour+';text-align:'+a+'"><h2>'+escapeHTML(s.title||"")+'</h2><p style="font-size:16px;line-height:1.8;white-space:pre-wrap">'+escapeHTML(s.text||"")+'</p></section>';
    if(s.type==="image"){let src="";try{const u=new URL(s.imageUrl||"");if(u.protocol==="https:")src=u.href}catch(_){}return '<section style="padding:46px 8%;background:'+bg+';color:'+textColour+';text-align:'+a+'"><h2>'+escapeHTML(s.title||"")+'</h2>'+(src?'<img src="'+escapeHTML(src)+'" alt="" style="display:block;max-width:100%;max-height:440px;object-fit:cover;border-radius:14px;margin:18px auto">':"")+'<p>'+escapeHTML(s.text||"")+'</p></section>'}
    if(s.type==="button"){const href=safeLink(s.buttonUrl);return '<section style="padding:48px 8%;background:'+bg+';color:'+textColour+';text-align:'+a+'"><h2>'+escapeHTML(s.title||"")+'</h2>'+(href?'<a href="'+escapeHTML(href)+'" style="display:inline-block;margin-top:14px;padding:13px 20px;background:'+c+';color:white;text-decoration:none;border-radius:10px;font-weight:750">'+escapeHTML(s.buttonLabel||"Learn more")+'</a>':"")+'</section>'}
    if(s.type==="features")return '<section style="padding:50px 7%;background:'+bg+';color:'+textColour+';text-align:'+a+'"><h2>'+escapeHTML(s.title||"Features")+'</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px">'+(Array.isArray(s.features)?s.features.slice(0,6):[]).map(x=>'<div style="padding:20px;border:1px solid #e7e8f0;border-radius:12px;font-weight:700">'+escapeHTML(x)+'</div>').join("")+'</div></section>';
    return "";
  };
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="'+description+'"><title>'+title+'</title><style>*{box-sizing:border-box}body{margin:0;background:'+background+';color:'+textColour+';font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}img{height:auto}footer{text-align:center;padding:25px;color:#9295a5;font-size:11px}@media(max-width:600px){section{padding-left:22px!important;padding-right:22px!important}}</style></head><body>'+sections.map(render).join("")+'<footer>Published with <a href="https://is-sites.abrdns.com/">Interactive Studio</a></footer></body></html>';
  return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=60, s-maxage=60","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
function notPublished(hostname) {
  const html = "<!doctype html><html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Website not found</title><body style='font:16px system-ui;background:#f7f8fc;color:#252638;display:grid;place-items:center;min-height:100vh;margin:0'><main style='max-width:520px;padding:32px;text-align:center;background:white;border:1px solid #e7e8f0;border-radius:18px'><h1 style='letter-spacing:-.05em'>This website isn't published yet.</h1><p style='color:#73788a'>The address <b>" + escapeHTML(hostname) + "</b> is not connected to a published Interactive Studio website.</p><a href='https://is-sites.abrdns.com/websites/' style='color:#635bff;font-weight:700'>Create a website with Interactive Studio</a></main></body></html>";
  return new Response(html, {status:404,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
async function serveWebsite(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed.", {status:405});
  const host = new URL(request.url).hostname.toLowerCase();
  let slug = "";
  if (host.endsWith("." + PLATFORM_HOST)) {
    slug = host.slice(0, -("." + PLATFORM_HOST).length);
    if (!slug || slug.includes(".")) return notPublished(host);
  } else {
    const mapping = await readPublicDocument("websiteDomains", host, env);
    if (!mapping || mapping.status !== "active" || !mapping.websiteSlug) return notPublished(host);
    slug = String(mapping.websiteSlug);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return notPublished(host);
  const site = await readPublicDocument("websites", slug, env);
  if (!site || site.status !== "published") return notPublished(host);
  const response = renderPublishedSite(site, host);
  if (request.method === "HEAD") return new Response(null, {status:response.status,headers:response.headers});
  return response;
}
async function proxyStudioApp(request) {
  const incoming = new URL(request.url);
  const target = new URL("https://aquathecanary.github.io/interactivestudio" + incoming.pathname + incoming.search);
  return fetch(new Request(target.toString(), request));
}
function normaliseHostname(value) {
  const input = String(value || "").trim().toLowerCase();
  if (!input || input.length > 253 || input.includes("/") || input.includes("@")) throw new Error("Enter a valid domain name, without https:// or a path.");
  let hostname;
  try { hostname = new URL("https://" + input).hostname.toLowerCase(); } catch (_) { throw new Error("Enter a valid domain name."); }
  if (hostname !== input || !hostname.includes(".") ||
      !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname) ||
      hostname === PLATFORM_HOST || hostname.endsWith("." + PLATFORM_HOST)) {
    throw new Error("That domain name cannot be connected. Use a domain you control, such as www.example.com.");
  }
  return hostname;
}
async function cloudflareRequest(path, options, env) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) throw new Error("Custom-domain setup is not configured yet. Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID to the Worker secrets.");
  const response = await fetch("https://api.cloudflare.com/client/v4/zones/" + env.CLOUDFLARE_ZONE_ID + path, {
    ...options, headers: {"Authorization":"Bearer " + env.CLOUDFLARE_API_TOKEN,"Content-Type":"application/json",...(options && options.headers || {})}
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.errors?.map(error => error.message).join("; ") || "Cloudflare could not configure this domain.");
  return data.result;
}
async function connectCustomDomain(hostnameInput, env) {
  const hostname = normaliseHostname(hostnameInput);
  if (!env.CLOUDFLARE_SAAS_TARGET) throw new Error("Set CLOUDFLARE_SAAS_TARGET to your Cloudflare for SaaS CNAME target first.");
  const result = await cloudflareRequest("/custom_hostnames", {method:"POST",body:JSON.stringify({hostname,ssl:{method:"http",type:"dv",min_tls_version:"1.2"}})}, env);
  let details = result;
  if (result && result.id) {
    await new Promise(resolve => setTimeout(resolve, 900));
    try { details = await cloudflareRequest("/custom_hostnames/" + result.id, {method:"GET"}, env); } catch (_) {}
  }
  return {hostname,id:details.id||result.id,status:details.status||result.status||"pending",sslStatus:details.ssl?.status||result.ssl?.status||"pending",validationRecords:details.ssl?.validation_records||result.ssl?.validation_records||[],cnameTarget:env.CLOUDFLARE_SAAS_TARGET};
}
async function checkCustomDomain(hostnameInput, hostnameId, env) {
  const hostname = normaliseHostname(hostnameInput);
  if (!/^[a-f0-9-]{20,}$/i.test(String(hostnameId || ""))) throw new Error("The Cloudflare hostname ID is invalid.");
  const details = await cloudflareRequest("/custom_hostnames/" + encodeURIComponent(hostnameId), {method:"GET"}, env);
  if (String(details.hostname || "").toLowerCase() !== hostname) throw new Error("That Cloudflare hostname does not match this domain.");
  return {hostname,id:details.id,status:details.status||"pending",sslStatus:details.ssl?.status||"pending",validationRecords:details.ssl?.validation_records||[],ownershipVerification:details.ownership_verification||null,cnameTarget:env.CLOUDFLARE_SAAS_TARGET||""};
}


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
async function planFor() {
  // Interactive Studio is free for every account. Entitlements no longer gate features.
  return "free";
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
    const hostname = url.hostname.toLowerCase();
    if (hostname === PLATFORM_HOST) return proxyStudioApp(request);
    if (hostname !== API_HOST) return serveWebsite(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
    try {
      const token = (request.headers.get("Authorization") || "").slice(7);
      const user = await authenticatedUser(request, env);
      if (url.pathname === "/connectCustomDomain") {
        if (!user.emailVerified) return json({ error: "Verify your email before connecting a custom domain." }, 403, origin);
        const body = await request.json();
        return json(await connectCustomDomain(body.hostname, env), 200, origin);
      }
      if (url.pathname === "/checkCustomDomain") {
        if (!user.emailVerified) return json({ error: "Verify your email before checking a custom domain." }, 403, origin);
        const body = await request.json();
        return json(await checkCustomDomain(body.hostname, body.hostnameId, env), 200, origin);
      }
      if (url.pathname === "/assertOrganisationAccess") {
        if (!user.emailVerified) return json({ error: "Verify your corporate email before continuing." }, 403, origin);
        const domain = user.email.toLowerCase().split("@").pop();
        if (!domain || !domain.includes(".") || FREE_DOMAINS.has(domain)) return json({ error: "A corporate email domain is required for organisation access." }, 403, origin);
        return json({ ok: true, domain }, 200, origin);
      }
      if (url.pathname === "/aiStatus") {
        if (!user.emailVerified) return json({ error: "Verify your email address before using AI features." }, 403, origin);
        return json({ providers: { gemini: !!env.GEMINI_API_KEY, chatgpt: !!env.OPENAI_API_KEY, claude: !!env.ANTHROPIC_API_KEY, copilot: !!(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_DEPLOYMENT) } }, 200, origin);
      }
      if (url.pathname === "/getEntitlements") {
        if (!user.emailVerified) return json({ error: "Verify your email address before accessing account services." }, 403, origin);
        const plan = await planFor(user, env, token);
        return json({ plan: plan.charAt(0).toUpperCase() + plan.slice(1) }, 200, origin);
      }
      if (url.pathname === "/generateAI") {
        if (!user.emailVerified) return json({ error: "Verify your email address before using AI features." }, 403, origin);
        const body = await request.json();
        const model = String(body.model || "gemini").toLowerCase();
        const prompt = String(body.prompt || "").trim().slice(0, 16000);
        if (!prompt) return json({ error: "Enter a prompt." }, 400, origin);
        if (!["gemini", "copilot", "chatgpt", "claude"].includes(model)) return json({ error: "Unknown AI model." }, 400, origin);
        const plan = await planFor(user, env, token);
        const text = await generate(model, prompt, env);
        if (!text) throw new Error("The AI provider returned an empty response.");
        return json({ text, model, plan }, 200, origin);
      }
      return json({ error: "Endpoint not found." }, 404, origin);
    } catch (error) {
      const message = error?.message || "Request failed.";
      const status = /sign in|session is invalid|expired/i.test(message) ? 401 : (/not configured|needs AZURE_OPENAI/i.test(message) ? 503 : 502);
      return json({ error: message }, status, origin);
    }
  }
};
