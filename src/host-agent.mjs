import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  choice,
  clampText,
  contentTypeFor,
  isThemeId,
  isPresetThemeId,
  normalizeStatus
} from "./lib.mjs";
import { createStaticHandler } from "./static-server.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "..");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const managerVersion = clampText(packageMetadata.version || "unknown", 40);
const nativeMode = process.env.MANAGER_MODE === "native";
const repositories = {
  engine: "https://github.com/Fei-Away/Codex-Dream-Skin",
  webui: "https://github.com/StarRain/Codex-Dream-Skin-Manager"
};
const runtimeRoot = path.resolve(process.env.MANAGER_RUNTIME_DIR || path.join(projectRoot, ".runtime"));
const agentHost = process.env.MANAGER_AGENT_HOST || (nativeMode ? "127.0.0.1" : "0.0.0.0");
const agentPort = Number(process.env.MANAGER_AGENT_PORT || (nativeMode ? 19341 : 4174));
const tokenPath = path.resolve(process.env.MANAGER_AGENT_TOKEN_FILE || path.join(runtimeRoot, "agent.token"));
const publicRoot = path.resolve(process.env.MANAGER_PUBLIC_ROOT || path.join(projectRoot, "public"));
const stateRoot = path.resolve(process.env.DREAM_SKIN_STATE_ROOT || path.join(os.homedir(), "Library/Application Support/CodexDreamSkinStudio"));
const installedEngine = path.join(os.homedir(), ".codex/codex-dream-skin-studio");
const siblingEngine = path.resolve(projectRoot, "../Codex-Dream-Skin/macos");
const requestedEngine = process.env.DREAM_SKIN_ENGINE?.trim();
const scriptNames = new Set([
  "status-dream-skin-macos.sh",
  "start-dream-skin-macos.sh",
  "pause-dream-skin-macos.sh",
  "restore-dream-skin-macos.sh",
  "switch-theme-macos.sh",
  "install-dream-skin-macos.sh"
]);
const logEntries = [];
const agentToken = nativeMode ? "" : fs.readFileSync(tokenPath, "utf8").trim();
if (!nativeMode && agentToken.length < 32) throw new Error("Host Agent token is missing or too short");
const serveStatic = createStaticHandler({ publicRoot });

function engineRoot() {
  if (requestedEngine) return path.resolve(requestedEngine.replace(/^~/, os.homedir()));
  if (fs.existsSync(path.join(installedEngine, "scripts/status-dream-skin-macos.sh"))) return installedEngine;
  return siblingEngine;
}

function engineAvailable() {
  return fs.existsSync(path.join(engineRoot(), "scripts/status-dream-skin-macos.sh"));
}

function addLog(action, result) {
  logEntries.unshift({
    time: new Date().toISOString(),
    action,
    exitCode: result.exitCode,
    output: result.output.slice(-5000)
  });
  logEntries.splice(80);
}

function runScript(name, args = [], timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    if (!scriptNames.has(name)) return reject(new Error("Unsupported engine action"));
    const script = path.join(engineRoot(), "scripts", name);
    if (!fs.existsSync(script)) return reject(new Error(`Engine script not found: ${name}`));

    const child = spawn(script, args, {
      env: { ...process.env, PATH: "/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const collect = chunk => {
      if (output.length < 1024 * 1024) output += chunk.toString("utf8");
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${name} timed out`));
    }, timeoutMs);
    child.on("close", exitCode => {
      clearTimeout(timer);
      const result = { exitCode: exitCode ?? 1, output: output.trim() };
      addLog([name, ...args].join(" "), result);
      resolve(result);
    });
  });
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  response.end(body);
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { ok: false, error: clampText(message, 1200) });
}

async function readBody(request, maximumBytes) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximumBytes) throw Object.assign(new Error("Request body is too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request, maximumBytes = 32 * 1024) {
  const body = await readBody(request, maximumBytes);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 });
  }
}

async function listThemes() {
  const themesRoot = path.join(stateRoot, "themes");
  let entries = [];
  try {
    entries = await fsp.readdir(themesRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const themes = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isThemeId(entry.name)) continue;
    try {
      const manifest = JSON.parse(await fsp.readFile(path.join(themesRoot, entry.name, "theme.json"), "utf8"));
      themes.push({
        id: entry.name,
        manifestId: clampText(manifest.id || "", 100),
        name: clampText(manifest.name || entry.name, 120),
        tagline: clampText(manifest.tagline || "", 240),
        appearance: choice(manifest.appearance, ["auto", "light", "dark"], "auto"),
        hasImage: typeof manifest.image === "string" && path.basename(manifest.image) === manifest.image,
        imageUrl: `/api/themes/${encodeURIComponent(entry.name)}/image`
      });
    } catch {
      // Ignore incomplete packs; the engine would reject these too.
    }
  }
  return themes.sort((a, b) => {
    const presetOrder = Number(b.id.startsWith("preset-")) - Number(a.id.startsWith("preset-"));
    return presetOrder || a.name.localeCompare(b.name, "zh-CN");
  });
}

async function serveThemeImage(themeId, response) {
  if (!isThemeId(themeId)) return sendError(response, 400, "Invalid theme id");
  const themeDirectory = path.join(stateRoot, "themes", themeId);
  const manifest = JSON.parse(await fsp.readFile(path.join(themeDirectory, "theme.json"), "utf8"));
  if (typeof manifest.image !== "string" || path.basename(manifest.image) !== manifest.image) {
    return sendError(response, 404, "Theme image not found");
  }
  const imagePath = path.join(themeDirectory, manifest.image);
  const stat = await fsp.lstat(imagePath);
  if (!stat.isFile() || stat.isSymbolicLink()) return sendError(response, 404, "Theme image not found");
  response.writeHead(200, {
    "content-type": contentTypeFor(imagePath),
    "content-length": stat.size,
    "cache-control": "private, max-age=30"
  });
  fs.createReadStream(imagePath).pipe(response);
}

async function activeThemeId() {
  try {
    const manifest = JSON.parse(await fsp.readFile(path.join(stateRoot, "theme", "theme.json"), "utf8"));
    return isThemeId(manifest.id) ? manifest.id : null;
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function deleteTheme(themeId) {
  if (!isThemeId(themeId)) throw Object.assign(new Error("Invalid theme id"), { statusCode: 400 });
  if (isPresetThemeId(themeId)) throw Object.assign(new Error("预设主题不能删除"), { statusCode: 403 });

  const themesRoot = path.join(stateRoot, "themes");
  const themeDirectory = path.join(themesRoot, themeId);
  let stat;
  try {
    stat = await fsp.lstat(themeDirectory);
  } catch (error) {
    if (error.code === "ENOENT") throw Object.assign(new Error("Theme not found"), { statusCode: 404 });
    throw error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw Object.assign(new Error("Theme path is not a removable directory"), { statusCode: 400 });
  }

  let manifest;
  try {
    manifest = JSON.parse(await fsp.readFile(path.join(themeDirectory, "theme.json"), "utf8"));
  } catch {
    throw Object.assign(new Error("Theme manifest is missing or invalid"), { statusCode: 400 });
  }
  const manifestId = isThemeId(manifest.id) ? manifest.id : null;
  if (isPresetThemeId(manifestId)) {
    throw Object.assign(new Error("预设主题不能删除"), { statusCode: 403 });
  }
  if (manifestId && manifestId === await activeThemeId()) {
    throw Object.assign(new Error("当前主题不能删除，请先切换到其他主题"), { statusCode: 409 });
  }

  const [realThemesRoot, realThemeDirectory] = await Promise.all([
    fsp.realpath(themesRoot),
    fsp.realpath(themeDirectory)
  ]);
  if (!realThemeDirectory.startsWith(`${realThemesRoot}${path.sep}`)) {
    throw Object.assign(new Error("Theme directory escapes the library"), { statusCode: 400 });
  }

  const quarantine = path.join(themesRoot, `.${themeId}.deleting-${crypto.randomUUID()}`);
  await fsp.rename(themeDirectory, quarantine);
  try {
    await fsp.rm(quarantine, { recursive: true });
  } catch (error) {
    try { await fsp.rename(quarantine, themeDirectory); } catch {}
    throw error;
  }
  const result = { exitCode: 0, output: `Deleted theme ${themeId}` };
  addLog(`delete-theme ${themeId}`, result);
  return result;
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, "http://agent.local");
  const route = requestUrl.pathname;

  if (!nativeMode) {
    const suppliedToken = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const expected = Buffer.from(agentToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      return sendError(response, 401, "Unauthorized");
    }
  }
  if (request.method !== "GET" && request.headers["x-manager-request"] !== "1") {
    return sendError(response, 403, "Missing manager request marker");
  }

  if (request.method === "GET" && (route === "/api/health" || route === "/health")) {
    return sendJson(response, 200, { ok: true, engineAvailable: engineAvailable() });
  }
  if (request.method === "GET" && route === "/api/config") {
    return sendJson(response, 200, {
      ok: true,
      platform: process.platform,
      version: managerVersion,
      enginePath: engineRoot(),
      engineAvailable: engineAvailable(),
      stateRoot,
      repositories
    });
  }
  if (request.method === "GET" && route === "/api/status") {
    if (!engineAvailable()) return sendJson(response, 200, { ok: true, engineAvailable: false, status: null });
    const result = await runScript("status-dream-skin-macos.sh", ["--json", "--deep"], 15000);
    if (result.exitCode !== 0) return sendError(response, 502, result.output || "Status check failed");
    return sendJson(response, 200, { ok: true, engineAvailable: true, status: normalizeStatus({ ...JSON.parse(result.output), themeId: await activeThemeId() }) });
  }
  if (request.method === "GET" && route === "/api/themes") {
    return sendJson(response, 200, { ok: true, themes: await listThemes() });
  }
  if (request.method === "GET" && route === "/api/logs") {
    return sendJson(response, 200, { ok: true, logs: logEntries });
  }
  const imageMatch = route.match(/^\/api\/themes\/([^/]+)\/image$/);
  if (request.method === "GET" && imageMatch) {
    return await serveThemeImage(decodeURIComponent(imageMatch[1]), response);
  }

  if (request.method === "POST" && route === "/api/actions/apply") {
    const result = await runScript("start-dream-skin-macos.sh", ["--restart-existing"]);
    return result.exitCode === 0 ? sendJson(response, 200, { ok: true, output: result.output }) : sendError(response, 502, result.output);
  }
  if (request.method === "POST" && route === "/api/actions/pause") {
    const result = await runScript("pause-dream-skin-macos.sh");
    return result.exitCode === 0 ? sendJson(response, 200, { ok: true, output: result.output }) : sendError(response, 502, result.output);
  }
  if (request.method === "POST" && route === "/api/actions/restore") {
    const result = await runScript("restore-dream-skin-macos.sh", ["--restore-base-theme", "--restart-codex"]);
    return result.exitCode === 0 ? sendJson(response, 200, { ok: true, output: result.output }) : sendError(response, 502, result.output);
  }
  if (request.method === "POST" && route === "/api/actions/switch") {
    const body = await readJson(request);
    if (!isThemeId(body.id)) return sendError(response, 400, "Invalid theme id");
    const result = await runScript("switch-theme-macos.sh", ["--id", body.id]);
    return result.exitCode === 0 ? sendJson(response, 200, { ok: true, output: result.output }) : sendError(response, 502, result.output);
  }
  const deleteThemeMatch = route.match(/^\/api\/themes\/([^/]+)$/);
  if (request.method === "DELETE" && deleteThemeMatch) {
    const result = await deleteTheme(decodeURIComponent(deleteThemeMatch[1]));
    return sendJson(response, 200, { ok: true, output: result.output });
  }

  return sendError(response, 404, "Not found");
}

await fsp.mkdir(runtimeRoot, { recursive: true, mode: 0o700 });

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, "http://localhost");
  if (nativeMode && !requestUrl.pathname.startsWith("/api/") && requestUrl.pathname !== "/health") {
    return serveStatic(request, response).catch(error => {
      console.error(error);
      if (!response.headersSent) response.writeHead(500);
      response.end("Internal server error");
    });
  }
  handleRequest(request, response).catch(error => {
    console.error(error);
    if (!response.headersSent) sendError(response, error.statusCode || 500, error.message || "Internal error");
    else response.destroy();
  });
});

server.listen(agentPort, agentHost, () => {
  const mode = nativeMode ? "native manager" : "host agent";
  const protection = nativeMode ? "loopback only" : "token protected";
  console.log(`Codex Dream Skin Manager ${mode} ready: http://${agentHost}:${agentPort}/management.html (${protection})`);
  console.log(`Engine: ${engineRoot()}`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
