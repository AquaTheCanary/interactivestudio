const PROJECT = "interactive-studio-convexllc";
const PLATFORM = "is-sites.abrdns.com";
const SERVICE_HOST = "interactivestudio.vercel.app";

function escapeHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}
function safeColour(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}
function safeLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : "";
  } catch (_) { return ""; }
}
async function readDocument(collection, id) {
  const key = process.env.FIREBASE_API_KEY;
  if (!key) throw new Error("The website publishing service is not configured.");
  const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
    "/databases/(default)/documents/" + collection + "/" + encodeURIComponent(id) +
    "?key=" + encodeURIComponent(key);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not read the published website record.");
  const doc = await response.json();
  return decodeFields(doc.fields || {});
}
function decodeValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeValue);
  if (v.mapValue) return decodeFields(v.mapValue.fields || {});
  return null;
}
function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) out[key] = decodeValue(value);
  return out;
}
function render(site) {
  const title = escapeHTML(site.siteName || site.title || "Website");
  const description = escapeHTML(site.description || "");
  const accent = safeColour(site.accent, "#635bff");
  const background = safeColour(site.background, "#f7f8fc");
  const text = safeColour(site.textColour, "#252638");
  const sections = Array.isArray(site.sections) && site.sections.length ? site.sections : [
    { type:"hero", eyebrow:site.eyebrow || "", title:site.headline || title, text:site.subheadline || "", background, accent, align:"center" },
    ...(site.body ? [{ type:"text", title:"About", text:site.body }] : []),
    ...(site.buttonLabel ? [{ type:"button", title:"", buttonLabel:site.buttonLabel, buttonUrl:site.buttonUrl }] : [])
  ];
  const renderSection = section => {
    const bg = safeColour(section.background, "#ffffff");
    const colour = safeColour(section.accent, accent);
    const align = ["left","center","right"].includes(section.align) ? section.align : "center";
    if (section.type === "hero") return '<section style="padding:76px 7%;background:'+bg+';color:'+text+';text-align:'+align+'"><div style="color:'+colour+';font-size:11px;font-weight:850;letter-spacing:.16em">'+escapeHTML(section.eyebrow || "")+'</div><h1 style="font-size:clamp(38px,7vw,82px);line-height:1.03;letter-spacing:-.07em;margin:18px 0">'+escapeHTML(section.title || title)+'</h1><p style="font-size:clamp(17px,2.2vw,23px);line-height:1.65;max-width:760px;margin:0 auto">'+escapeHTML(section.text || "")+'</p></section>';
    if (section.type === "text") return '<section style="padding:54px 8%;background:'+bg+';color:'+text+';text-align:'+align+'"><h2>'+escapeHTML(section.title || "")+'</h2><p style="font-size:16px;line-height:1.8;white-space:pre-wrap">'+escapeHTML(section.text || "")+'</p></section>';
    if (section.type === "image") {
      let src = "";
      try { const image = new URL(section.imageUrl || ""); if (image.protocol === "https:") src = image.href; } catch (_) {}
      return '<section style="padding:46px 8%;background:'+bg+';color:'+text+';text-align:'+align+'"><h2>'+escapeHTML(section.title || "")+'</h2>'+(src ? '<img src="'+escapeHTML(src)+'" alt="" style="display:block;max-width:100%;max-height:440px;object-fit:cover;border-radius:14px;margin:18px auto">' : "")+'<p>'+escapeHTML(section.text || "")+'</p></section>';
    }
    if (section.type === "button") {
      const href = safeLink(section.buttonUrl);
      return '<section style="padding:48px 8%;background:'+bg+';color:'+text+';text-align:'+align+'"><h2>'+escapeHTML(section.title || "")+'</h2>'+(href ? '<a href="'+escapeHTML(href)+'" style="display:inline-block;margin-top:14px;padding:13px 20px;background:'+colour+';color:white;text-decoration:none;border-radius:10px;font-weight:750">'+escapeHTML(section.buttonLabel || "Learn more")+'</a>' : "")+'</section>';
    }
    if (section.type === "features") return '<section style="padding:50px 7%;background:'+bg+';color:'+text+';text-align:'+align+'"><h2>'+escapeHTML(section.title || "Features")+'</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px">'+(Array.isArray(section.features) ? section.features.slice(0,6) : []).map(item => '<div style="padding:20px;border:1px solid #e7e8f0;border-radius:12px;font-weight:700">'+escapeHTML(item)+'</div>').join("")+'</div></section>';
    return "";
  };
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="'+description+'"><meta name="theme-color" content="'+background+'"><title>'+title+'</title><style>*{box-sizing:border-box}body{margin:0;background:'+background+';color:'+text+';font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}img{height:auto}footer{text-align:center;padding:25px;color:#9295a5;font-size:11px}@media(max-width:600px){section{padding-left:22px!important;padding-right:22px!important}}</style></head><body>'+sections.map(renderSection).join("")+'<footer>Published with <a href="https://is-sites.abrdns.com/">Interactive Studio</a></footer></body></html>';
}
module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method not allowed.");
  }
  try {
    const hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "";
    const host = String(hostHeader).split(",")[0].trim().toLowerCase().split(":")[0];

    // The Vercel project hostname is a service health-check address, not a published site.
    if (host === SERVICE_HOST) {
      const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Interactive Studio Publishing</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f8fc;color:#252638;font-family:Inter,system-ui,sans-serif}.card{max-width:560px;margin:24px;padding:42px;border:1px solid #e7e8f0;border-radius:22px;background:white;box-shadow:0 18px 60px #25263812}h1{margin:0 0 12px;font-size:clamp(30px,6vw,44px);letter-spacing:-.05em}.status{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:99px;background:#e9f9ef;color:#18733a;font-size:13px;font-weight:750}.dot{width:8px;height:8px;border-radius:50%;background:#20a45a}p{line-height:1.7;color:#656879}a{color:#635bff;font-weight:700}</style></head><body><main class="card"><div class="status"><span class="dot"></span> Publishing service online</div><h1>Interactive Studio</h1><p>This address is the publishing service health check. Published websites use their own address, such as <strong>your-site.is-sites.abrdns.com</strong>.</p><p>To test a published website, publish it in the Interactive Studio website builder and open its assigned website address.</p><p><a href="https://is-sites.abrdns.com/">Return to Interactive Studio</a></p></main></body></html>';
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (req.method === "HEAD") return res.status(200).end();
      return res.status(200).send(page);
    }

    let slug = "";
    if (host.endsWith("." + PLATFORM)) {
      slug = host.slice(0, -("." + PLATFORM).length);
      if (!slug || slug.includes(".")) return res.status(404).send("Website not found.");
    } else {
      const mapping = await readDocument("websiteDomains", host);
      if (!mapping || mapping.status !== "active" || !mapping.websiteSlug) return res.status(404).send("This website is not connected or published.");
      slug = String(mapping.websiteSlug);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return res.status(404).send("Website not found.");
    const site = await readDocument("websites", slug);
    if (!site || site.status !== "published") return res.status(404).send("This website isn't published yet.");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(render(site));
  } catch (error) {
    console.error("Published website error:", error);
    return res.status(500).send("The publishing service could not load this website.");
  }
};
