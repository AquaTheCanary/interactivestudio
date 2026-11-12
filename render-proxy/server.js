const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const WORKER_ORIGIN = "https://interactive-studio.convexllc.workers.dev";
const PROXY_TOKEN = process.env.IS_PROXY_TOKEN;

const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    return res.end("ok");
  }

  if (!PROXY_TOKEN) {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Proxy is not configured.");
  }

  const originalHost = String(req.headers.host || "").toLowerCase().replace(/:\\d+$/, "");
  const suffix = ".is-sites.abrdns.com";
  const isPlatformRoot = originalHost === "is-sites.abrdns.com";
  const label = originalHost.endsWith(suffix) ? originalHost.slice(0, -suffix.length) : "";
  if (!isPlatformRoot && (!label || label.includes(".") || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Unknown website hostname.");
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value == null || ["host", "connection", "content-length", "transfer-encoding", "upgrade"].includes(name)) continue;
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    headers.set("X-IS-Proxy-Token", PROXY_TOKEN);
    headers.set("X-IS-Original-Host", originalHost);

    const upstream = await fetch(WORKER_ORIGIN + req.url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body
    });
    const responseHeaders = {};
    upstream.headers.forEach((value, name) => {
      if (!["transfer-encoding", "connection", "content-length"].includes(name.toLowerCase())) responseHeaders[name] = value;
    });
    const responseBody = req.method === "HEAD" ? null : Buffer.from(await upstream.arrayBuffer());
    if (responseBody) responseHeaders["content-length"] = String(responseBody.length);
    res.writeHead(upstream.status, responseHeaders);
    res.end(responseBody);
  } catch (error) {
    console.error("Upstream request failed:", error);
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end("The website gateway could not reach Interactive Studio.");
  }
});

server.listen(PORT, "0.0.0.0", () => console.log("Interactive Studio sites proxy listening on " + PORT));
