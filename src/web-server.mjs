import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentTypeFor } from "./lib.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(moduleDir, "../public");
const agentHost = process.env.MANAGER_AGENT_HOST || "host.docker.internal";
const agentPort = Number(process.env.MANAGER_AGENT_PORT || 4174);
const tokenPath = process.env.MANAGER_AGENT_TOKEN_FILE || "/run/secrets/agent.token";
const agentToken = fs.readFileSync(tokenPath, "utf8").trim();
const port = Number(process.env.PORT || 19341);

function proxyToAgent(request, response) {
  const upstream = http.request({
    host: agentHost,
    port: agentPort,
    path: request.url,
    method: request.method,
    headers: {
      ...request.headers,
      host: "agent.local",
      authorization: `Bearer ${agentToken}`
    }
  }, upstreamResponse => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", error => {
    if (response.headersSent) return response.destroy();
    const body = JSON.stringify({ ok: false, error: `Host agent unavailable: ${error.message}` });
    response.writeHead(503, { "content-type": "application/json; charset=utf-8" });
    response.end(body);
  });
  request.pipe(upstream);
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, "http://localhost");
  if (requestUrl.pathname === "/") {
    response.writeHead(302, {
      location: "/management.html",
      "cache-control": "no-store"
    });
    return response.end();
  }
  if (requestUrl.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    return response.end("ok");
  }
  const isAppEntry = requestUrl.pathname === "/management.html";
  const relative = isAppEntry ? "index.html" : decodeURIComponent(requestUrl.pathname.slice(1));
  const candidate = path.resolve(publicRoot, relative);
  if (!candidate.startsWith(`${publicRoot}${path.sep}`)) {
    response.writeHead(400);
    return response.end("Bad request");
  }
  let filePath = candidate;
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    filePath = path.join(publicRoot, "index.html");
  }
  const stat = await fsp.stat(filePath);
  response.writeHead(200, {
    "content-type": contentTypeFor(filePath),
    "content-length": stat.size,
    "cache-control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=300",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) return proxyToAgent(request, response);
  serveStatic(request, response).catch(error => {
    console.error(error);
    response.writeHead(500);
    response.end("Internal server error");
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Codex Dream Skin Manager web listening on http://0.0.0.0:${port}`);
});
