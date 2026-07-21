import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { contentTypeFor } from "./lib.mjs";

const securityHeaders = {
  "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};

export function createStaticHandler({ publicRoot }) {
  const resolvedPublicRoot = path.resolve(publicRoot);
  const packagedEntry = path.join(resolvedPublicRoot, "management.html");
  const sourceEntry = path.join(resolvedPublicRoot, "index.html");

  return async function serveStatic(request, response) {
    const requestUrl = new URL(request.url, "http://localhost");
    if (requestUrl.pathname === "/") {
      response.writeHead(302, {
        location: "/management.html",
        "cache-control": "no-store",
        ...securityHeaders
      });
      return response.end();
    }
    if (requestUrl.pathname === "/healthz") {
      response.writeHead(200, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        ...securityHeaders
      });
      return response.end("ok");
    }

    const entryFile = fs.existsSync(packagedEntry) ? packagedEntry : sourceEntry;
    const isAppEntry = requestUrl.pathname === "/management.html";
    const relative = isAppEntry ? path.basename(entryFile) : decodeURIComponent(requestUrl.pathname.slice(1));
    const candidate = path.resolve(resolvedPublicRoot, relative);
    if (!candidate.startsWith(`${resolvedPublicRoot}${path.sep}`)) {
      response.writeHead(400, securityHeaders);
      return response.end("Bad request");
    }

    let filePath = candidate;
    try {
      const stat = await fsp.stat(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    } catch {
      filePath = entryFile;
    }

    const stat = await fsp.stat(filePath);
    response.writeHead(200, {
      "content-type": contentTypeFor(filePath),
      "content-length": stat.size,
      "cache-control": filePath === entryFile ? "no-cache" : "public, max-age=300",
      ...securityHeaders
    });
    if (request.method === "HEAD") return response.end();
    fs.createReadStream(filePath).pipe(response);
  };
}
