const ALLOWED_ORIGINS = new Set([
  "https://aquathecanary.github.io",
  "https://interactivestudio.abrdns.com",
  "https://www.interactivestudio.abrdns.com",
  "https://is-sites.abrdns.com"
]);
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
async function readPublicDocument(collection, id, env, authToken) {
  if (!env.FIREBASE_API_KEY) throw new Error("Website publishing is not configured: FIREBASE_API_KEY is missing.");
  const endpoint = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" + collection + "/" + encodeURIComponent(id) +
    "?key=" + encodeURIComponent(env.FIREBASE_API_KEY);
  const response = await fetch(endpoint, { headers: { "Accept": "application/json", ...(authToken ? { "Authorization": "Bearer " + authToken } : {}) } });
  if (response.status === 404) return null;
  if (response.status === 403) return false;
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
    const hostMapping = await readPublicDocument("websiteHosts", host, env);
    if (hostMapping === false) return notPublished(host);
    if (hostMapping) {
      if (hostMapping.status !== "published" || !hostMapping.websiteSlug) return notPublished(host);
      slug = String(hostMapping.websiteSlug);
    } else {
      // Backwards compatibility for older one-label site addresses.
      slug = host.slice(0, -("." + PLATFORM_HOST).length);
      if (!slug || slug.includes(".")) return notPublished(host);
    }
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
  const validationRecords = [...(details.ssl?.validation_records || result.ssl?.validation_records || []), ...((details.ownership_verification || result.ownership_verification) ? [{txt_name:(details.ownership_verification || result.ownership_verification).name,txt_value:(details.ownership_verification || result.ownership_verification).value}] : [])];
  let cloudnsDns = null;
  try {
    cloudnsDns = await ensureCustomDomainDns(hostname, String(env.CLOUDFLARE_SAAS_TARGET).trim().toLowerCase().replace(/\.$/, ""), env);
    if (cloudnsDns.configured) cloudnsDns.txtRecordsAdded = await ensureCloudnsValidationRecords(validationRecords, cloudnsDns.zone, env);
  } catch (error) { cloudnsDns = {configured:false,error:error.message}; }
  return {hostname,id:details.id||result.id,status:details.status||result.status||"pending",sslStatus:details.ssl?.status||result.ssl?.status||"pending",validationRecords,cnameTarget:env.CLOUDFLARE_SAAS_TARGET,cloudnsDns};
}
async function cloudnsRequest(endpoint, parameters, env, zoneName = PLATFORM_HOST) {
  const authId = String(env.CLOUDNS_AUTH_ID || "").trim();
  const authPassword = String(env.CLOUDNS_AUTH_PASSWORD || "");
  if (!authId || !authPassword) {
    throw new Error("ClouDNS automation is not configured. Add CLOUDNS_AUTH_ID and CLOUDNS_AUTH_PASSWORD as Worker secrets.");
  }
  const body = new URLSearchParams({
    "auth-id": authId,
    "auth-password": authPassword,
    ...(zoneName ? {"domain-name": zoneName} : {}),
    ...(parameters || {})
  });
  const response = await fetch("https://api.cloudns.net/dns/" + endpoint + ".json", {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded"},
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || String(data.status || "").toLowerCase() === "failed") {
    throw new Error(data.statusDescription || "ClouDNS could not update the website DNS record.");
  }
  return data;
}
function cloudnsZoneNames(data) {
  const source = data && (data.zones || data.domains || data);
  const values = Array.isArray(source) ? source : (source && typeof source === "object" ? Object.values(source) : []);
  return values.map(item => typeof item === "string" ? item : item && (item.name || item.domain || item.domain_name || item["domain-name"] || item.zone)).filter(value => typeof value === "string" && value.includes(".")).map(value => value.toLowerCase().replace(/\\.$/, ""));
}
async function ensureCustomDomainDns(hostname, target, env) {
  const pages = [];
  for (let page = 1; page <= 10; page++) {
    const result = await cloudnsRequest("list-zones", {page:String(page),"rows-per-page":"100"}, env, null);
    const names = cloudnsZoneNames(result);
    pages.push(...names);
    if (names.length < 100) break;
  }
  const zone = [...new Set(pages)].filter(name => hostname === name || hostname.endsWith("." + name)).sort((a,b) => b.length-a.length)[0];
  if (!zone) return {configured:false,reason:"This domain is not present in the ClouDNS account connected to Interactive Studio. Add the CNAME at its current DNS provider."};
  const host = hostname === zone ? "@" : hostname.slice(0, -(zone.length + 1));
  if (host === "@") return {configured:false,zone,reason:"This is an apex/root domain. Use a www or other subdomain for automatic CNAME setup, or configure CNAME flattening manually."};
  const listed = await cloudnsRequest("records", {host,"rows-per-page":"100",page:"1","include-notes":"0"}, env, zone);
  const matches = cloudnsRecordList(listed).filter(item => String(item.host || item.name || "").toLowerCase() === host.toLowerCase());
  if (matches.some(item => String(item.type || "").toUpperCase() !== "CNAME")) {
    throw new Error("ClouDNS domain " + zone + " already has a non-CNAME record for " + host + ". Remove the conflicting record first.");
  }
  if (matches.length > 1) throw new Error("Multiple ClouDNS DNS records already exist for " + hostname + ". Remove duplicates first.");
  if (matches.length === 1) {
    const current = matches[0];
    const currentTarget = String(current.record || current.content || current.points_to || "").toLowerCase().replace(/\\.$/, "");
    if (currentTarget !== target) {
      const recordId = current.id || current.record_id || current["record-id"];
      if (!recordId) throw new Error("ClouDNS returned the existing CNAME without a record ID, so it cannot be updated safely.");
      await cloudnsRequest("mod-record", {"record-id":String(recordId),host,record:target,ttl:"300"}, env, zone);
    }
  } else {
    await cloudnsRequest("add-record", {"record-type":"CNAME",host,record:target,ttl:"300"}, env, zone);
  }
  return {configured:true,zone,host,type:"CNAME",target};
}
async function ensureCloudnsValidationRecords(validationRecords, zone, env) {
  let added = 0;
  for (const item of Array.isArray(validationRecords) ? validationRecords : []) {
    const rawName = String(item.txt_name || item.name || "").trim().toLowerCase().replace(/\\.$/, "");
    const value = String(item.txt_value || item.value || "").trim();
    if (!rawName || !value) continue;
    const host = rawName === zone ? "@" : rawName.endsWith("." + zone) ? rawName.slice(0, -(zone.length + 1)) : "";
    if (!host) continue;
    const listed = await cloudnsRequest("records", {host,type:"TXT","rows-per-page":"100",page:"1"}, env, zone);
    const records = cloudnsRecordList(listed).filter(record => String(record.host || record.name || "").toLowerCase() === host.toLowerCase() && String(record.type || "").toUpperCase() === "TXT");
    if (records.some(record => String(record.record || record.content || "").replace(/^"|"$/g, "") === value)) continue;
    await cloudnsRequest("add-record", {"record-type":"TXT",host,record:value,ttl:"300"}, env, zone);
    added++;
  }
  return added;
}
function cloudnsRecordList(data) {
  const source = data && data.records && typeof data.records === "object" ? data.records : data;
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") return [];
  return Object.values(source).filter(item => item && typeof item === "object" && ("type" in item || "record" in item || "id" in item));
}
async function ensureBuiltInDnsRecord(hostname, env) {
  const target = String(env.CLOUDFLARE_SAAS_TARGET || "").trim().toLowerCase().replace(/\.$/, "");
  if (!target || target.includes("/") || target.includes(":")) {
    throw new Error("Set CLOUDFLARE_SAAS_TARGET to the Cloudflare for SaaS CNAME target hostname, without https://.");
  }
  const suffix = "." + PLATFORM_HOST;
  if (!hostname.endsWith(suffix)) throw new Error("The website hostname is outside the ClouDNS website zone.");
  const relativeHost = hostname.slice(0, -suffix.length);
  const listed = await cloudnsRequest("records", {
    host: relativeHost,
    "rows-per-page": "100",
    page: "1",
    "include-notes": "0"
  }, env);
  const matches = cloudnsRecordList(listed).filter(item => String(item.host || item.name || "").toLowerCase() === relativeHost.toLowerCase());
  if (matches.some(item => String(item.type || "").toUpperCase() !== "CNAME")) {
    throw new Error("The ClouDNS name " + relativeHost + " already has a non-CNAME record. Remove that conflicting record first.");
  }
  if (matches.length > 1) throw new Error("Multiple DNS records already exist for " + hostname + ". Remove duplicates in ClouDNS first.");
  if (matches.length === 1) {
    const current = matches[0];
    const currentTarget = String(current.record || current.content || current.points_to || "").toLowerCase().replace(/\.$/, "");
    if (currentTarget !== target) {
      const recordId = current.id || current.record_id || current["record-id"];
      if (!recordId) throw new Error("ClouDNS returned an existing CNAME without a record ID, so it cannot be updated safely.");
      await cloudnsRequest("mod-record", {
        "record-id": String(recordId),
        host: relativeHost,
        record: target,
        ttl: "300"
      }, env);
    }
  } else {
    await cloudnsRequest("add-record", {
      "record-type": "CNAME",
      host: relativeHost,
      record: target,
      ttl: "300"
    }, env);
  }
  return {hostname,type:"CNAME",target};
}
async function connectBuiltInHost(hostnameInput, env) {
  const hostname = String(hostnameInput || "").trim().toLowerCase();
  const suffix = "." + PLATFORM_HOST;
  if (!hostname.endsWith(suffix)) throw new Error("A built-in hostname must end in ." + PLATFORM_HOST + ".");
  const labels = hostname.slice(0, -suffix.length).split(".");
  if (labels.length < 1 || labels.length > 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error("The built-in hostname format is invalid.");
  }
  if (!env.CLOUDFLARE_SAAS_TARGET) throw new Error("Set CLOUDFLARE_SAAS_TARGET before automatic HTTPS can be provisioned for built-in addresses.");
  let existing = null;
  try {
    const matches = await cloudflareRequest("/custom_hostnames?hostname=" + encodeURIComponent(hostname), {method:"GET"}, env);
    existing = Array.isArray(matches) ? matches.find(item => String(item.hostname || "").toLowerCase() === hostname) : null;
  } catch (_) {}
  let result;
  if (existing && existing.id) {
    result = await cloudflareRequest("/custom_hostnames/" + existing.id, {method:"GET"}, env);
  } else {
    result = await cloudflareRequest("/custom_hostnames", {method:"POST",body:JSON.stringify({hostname,ssl:{method:"http",type:"dv",min_tls_version:"1.2"}})}, env);
  }
  if (result && result.id) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try { result = await cloudflareRequest("/custom_hostnames/" + result.id, {method:"GET"}, env); } catch (_) {}
  }
  return {hostname,id:result.id,status:result.status||"pending",sslStatus:result.ssl?.status||"pending",validationRecords:result.ssl?.validation_records||[],cnameTarget:env.CLOUDFLARE_SAAS_TARGET};
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    if (hostname === PLATFORM_HOST) return proxyStudioApp(request);
    if (hostname !== API_HOST) return serveWebsite(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed.", receivedOrigin: origin || "(no Origin header)" }, 403, origin);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
    try {
      const token = (request.headers.get("Authorization") || "").slice(7);
      const user = await authenticatedUser(request, env);
      if (url.pathname === "/registerBuiltInHosts") {
        if (!user.emailVerified) return json({ error: "Verify your email before publishing built-in addresses." }, 403, origin);
        const body = await request.json();
        const slug = String(body.websiteSlug || "").toLowerCase();
        const username = String(body.username || "").toLowerCase();
        const subdomain = String(body.subdomain || "").toLowerCase();
        const hostname = String(body.hostname || "").trim().toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain) || username.length > 32 || subdomain.length > 40 || slug.length > 63) {
          return json({ error: "The website ID or public handle is not valid." }, 400, origin);
        }
        const expected = [
          username + "." + subdomain + "." + PLATFORM_HOST,
          subdomain + "." + username + "." + PLATFORM_HOST,
          username + "-" + subdomain + "." + PLATFORM_HOST,
          subdomain + "-" + username + "." + PLATFORM_HOST
        ];
        if (!expected.includes(hostname) || ((hostname.includes(username + "-") || hostname.includes("-" + username + ".")) && username.length + subdomain.length + 1 > 63)) return json({ error: "Choose one of the four supported address formats and keep each hostname label under 64 characters." }, 400, origin);
        const site = await readPublicDocument("websites", slug, env, token);
        if (!site || site.ownerUid !== user.uid || site.username !== username || site.status !== "published" || site.publishedHostname !== hostname) {
          return json({ error: "You can only provision the selected address for your own published website." }, 403, origin);
        }
        // A wildcard CNAME catches future single-label built-in addresses. The
        // exact CNAME is still created for each selected two-label hostname.
        await ensureBuiltInDnsRecord("*." + PLATFORM_HOST, env);
        await ensureBuiltInDnsRecord("*." + username + "." + PLATFORM_HOST, env);
        await ensureBuiltInDnsRecord("*." + subdomain + "." + PLATFORM_HOST, env);
        const dns = await ensureBuiltInDnsRecord(hostname, env);
        const host = await connectBuiltInHost(hostname, env);
        return json({ host: {...host,dnsConfigured:true,dnsTarget:dns.target} }, 200, origin);
      }
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
      return json({ error: "Endpoint not found." }, 404, origin);
    } catch (error) {
      const message = error?.message || "Request failed.";
      const status = /sign in|session is invalid|expired/i.test(message) ? 401 : 502;
      return json({ error: message }, status, origin);
    }
  }
};
