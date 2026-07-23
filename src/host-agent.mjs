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
  normalizeStatus,
  themeGroup,
  themeImageExtension,
  themeImportOptions
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
  "load-image-theme-macos.sh",
  "install-dream-skin-macos.sh"
]);
const logEntries = [];
let themeSwitchRunning = false;
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
      stdio: ["ignore", "pipe", "pipe"],
      detached: true
    });
    let output = "";
    let settled = false;
    const action = [name, ...args].join(" ");
    const collect = chunk => {
      if (output.length < 1024 * 1024) output += chunk.toString("utf8");
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      addLog(action, { exitCode: 1, output: error.message });
      reject(error);
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const message = `${name} timed out after ${Math.ceil(timeoutMs / 1000)} seconds`;
      addLog(action, { exitCode: 124, output: `${output.trim()}\n${message}`.trim() });
      try { process.kill(-child.pid, "SIGTERM"); } catch {}
      const forceTimer = setTimeout(() => {
        try { process.kill(-child.pid, "SIGKILL"); } catch {}
      }, 2000);
      forceTimer.unref();
      reject(new Error(`${name} timed out`));
    }, timeoutMs);
    timer.unref();
    child.on("close", exitCode => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = { exitCode: exitCode ?? 1, output: output.trim() };
      addLog(action, result);
      resolve(result);
    });
  });
}

function runFixedCommand(executable, args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: { ...process.env, PATH: "/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true
    });
    let output = "";
    let settled = false;
    const collect = chunk => { if (output.length < 1024 * 1024) output += chunk.toString("utf8"); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { process.kill(-child.pid, "SIGTERM"); } catch {}
      reject(new Error(`${path.basename(executable)} timed out`));
    }, timeoutMs);
    timer.unref();
    child.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", exitCode => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = { exitCode: exitCode ?? 1, output: output.trim() };
      if (result.exitCode === 0) resolve(result);
      else reject(new Error(result.output || `${path.basename(executable)} failed`));
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

async function receiveThemeImage(request, fileName) {
  const maximumBytes = 50 * 1024 * 1024;
  const announcedBytes = Number(request.headers["content-length"] || 0);
  if (announcedBytes > maximumBytes) {
    throw Object.assign(new Error("Theme image is larger than 50 MB"), { statusCode: 413 });
  }
  const extension = themeImageExtension(fileName, request.headers["content-type"] || "");
  if (!extension) {
    throw Object.assign(new Error("Unsupported image type. Use PNG, JPEG, WebP, HEIC, or TIFF"), { statusCode: 415 });
  }

  const uploadRoot = path.join(runtimeRoot, "uploads");
  await fsp.mkdir(uploadRoot, { recursive: true, mode: 0o700 });
  const uploadPath = path.join(uploadRoot, `${crypto.randomUUID()}${extension}`);
  const upload = await fsp.open(uploadPath, "wx", 0o600);
  let receivedBytes = 0;
  try {
    for await (const chunk of request) {
      receivedBytes += chunk.length;
      if (receivedBytes > maximumBytes) {
        throw Object.assign(new Error("Theme image is larger than 50 MB"), { statusCode: 413 });
      }
      await upload.write(chunk);
    }
  } catch (error) {
    await upload.close().catch(() => {});
    await fsp.rm(uploadPath, { force: true }).catch(() => {});
    throw error;
  }
  await upload.close();
  if (!receivedBytes) {
    await fsp.rm(uploadPath, { force: true });
    throw Object.assign(new Error("Theme image is empty"), { statusCode: 400 });
  }
  return uploadPath;
}

async function libraryThemeIds() {
  try {
    return new Set((await fsp.readdir(path.join(stateRoot, "themes"), { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && isThemeId(entry.name))
      .map(entry => entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function writeManifestAtomic(themeDirectory, manifest) {
  const temporary = path.join(themeDirectory, `.theme-${crypto.randomUUID()}.json`);
  await fsp.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  try {
    await fsp.rename(temporary, path.join(themeDirectory, "theme.json"));
  } finally {
    await fsp.rm(temporary, { force: true }).catch(() => {});
  }
}

async function importTheme(request, requestUrl) {
  const options = themeImportOptions({
    name: requestUrl.searchParams.get("name"),
    group: requestUrl.searchParams.get("group"),
    appearance: requestUrl.searchParams.get("appearance"),
    safeArea: requestUrl.searchParams.get("safeArea"),
    taskMode: requestUrl.searchParams.get("taskMode"),
    focusX: requestUrl.searchParams.get("focusX"),
    focusY: requestUrl.searchParams.get("focusY"),
    applyNow: requestUrl.searchParams.get("applyNow")
  });
  const themesBefore = await libraryThemeIds();
  const uploadPath = await receiveThemeImage(request, requestUrl.searchParams.get("fileName") || "");
  try {
    const args = [
      "--file", uploadPath,
      "--name", options.name,
      "--appearance", options.appearance,
      "--safe-area", options.safeArea,
      "--task-mode", options.taskMode
    ];
    if (options.focusX !== null) args.push("--focus-x", String(options.focusX));
    if (options.focusY !== null) args.push("--focus-y", String(options.focusY));
    if (!options.applyNow) args.push("--no-apply");
    const result = await runScript("load-image-theme-macos.sh", args, 180000);
    const themesAfter = await libraryThemeIds();
    const themeId = [...themesAfter].find(id => !themesBefore.has(id)) || null;
    if (themeId) {
      const themeDirectory = path.join(stateRoot, "themes", themeId);
      const manifest = JSON.parse(await fsp.readFile(path.join(themeDirectory, "theme.json"), "utf8"));
      manifest.managerGroup = options.group;
      await writeManifestAtomic(themeDirectory, manifest);
    }
    if (result.exitCode !== 0) throw Object.assign(new Error(result.output || "Theme import failed"), { statusCode: 502 });
    return { ...result, themeId };
  } finally {
    await fsp.rm(uploadPath, { force: true }).catch(() => {});
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
      const themeDirectory = path.join(themesRoot, entry.name);
      const manifest = JSON.parse(await fsp.readFile(path.join(themeDirectory, "theme.json"), "utf8"));
      const preset = isPresetThemeId(entry.name) || isPresetThemeId(manifest.id);
      const hasImage = typeof manifest.image === "string" && path.basename(manifest.image) === manifest.image;
      let imageVersion = 0;
      if (hasImage) imageVersion = Math.trunc((await fsp.stat(path.join(themeDirectory, manifest.image))).mtimeMs);
      const art = manifest.art && typeof manifest.art === "object" && !Array.isArray(manifest.art) ? manifest.art : {};
      const unit = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
      themes.push({
        id: entry.name,
        manifestId: clampText(manifest.id || "", 100),
        name: clampText(manifest.name || entry.name, 120),
        tagline: clampText(manifest.tagline || "", 240),
        group: preset ? "预设主题" : themeGroup(manifest.managerGroup),
        appearance: choice(manifest.appearance, ["auto", "light", "dark"], "auto"),
        safeArea: choice(art.safeArea, ["auto", "left", "right", "center", "none"], "auto"),
        taskMode: choice(art.taskMode, ["auto", "ambient", "banner", "off"], "auto"),
        focusX: unit(art.focusX),
        focusY: unit(art.focusY),
        hasImage,
        imageUrl: `/api/themes/${encodeURIComponent(entry.name)}/image?v=${imageVersion}`
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

function queueThemeSwitch(themeId) {
  if (themeSwitchRunning) return false;
  themeSwitchRunning = true;
  runScript("switch-theme-macos.sh", ["--id", themeId], 150000)
    .catch(error => console.error(`Theme switch failed: ${error.message}`))
    .finally(() => { themeSwitchRunning = false; });
  return true;
}

async function editableTheme(themeId) {
  if (!isThemeId(themeId)) throw Object.assign(new Error("Invalid theme id"), { statusCode: 400 });
  if (isPresetThemeId(themeId)) throw Object.assign(new Error("预设主题不能编辑"), { statusCode: 403 });
  const themesRoot = path.join(stateRoot, "themes");
  const themeDirectory = path.join(themesRoot, themeId);
  let stat;
  try {
    stat = await fsp.lstat(themeDirectory);
  } catch (error) {
    if (error.code === "ENOENT") throw Object.assign(new Error("Theme not found"), { statusCode: 404 });
    throw error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Object.assign(new Error("Invalid theme directory"), { statusCode: 400 });
  const [realRoot, realDirectory] = await Promise.all([fsp.realpath(themesRoot), fsp.realpath(themeDirectory)]);
  if (!realDirectory.startsWith(`${realRoot}${path.sep}`)) throw Object.assign(new Error("Theme directory escapes the library"), { statusCode: 400 });
  const manifest = JSON.parse(await fsp.readFile(path.join(themeDirectory, "theme.json"), "utf8"));
  if (isPresetThemeId(manifest.id)) throw Object.assign(new Error("预设主题不能编辑"), { statusCode: 403 });
  if (typeof manifest.image !== "string" || path.basename(manifest.image) !== manifest.image) {
    throw Object.assign(new Error("Theme image is invalid"), { statusCode: 400 });
  }
  const imagePath = path.join(themeDirectory, manifest.image);
  const imageStat = await fsp.lstat(imagePath);
  if (!imageStat.isFile() || imageStat.isSymbolicLink()) throw Object.assign(new Error("Theme image is invalid"), { statusCode: 400 });
  return { themeDirectory, manifest, imagePath };
}

async function updateTheme(request, requestUrl, themeId) {
  const { themeDirectory, manifest, imagePath } = await editableTheme(themeId);
  const options = themeImportOptions({
    name: requestUrl.searchParams.get("name"),
    group: requestUrl.searchParams.get("group"),
    appearance: requestUrl.searchParams.get("appearance"),
    safeArea: requestUrl.searchParams.get("safeArea"),
    taskMode: requestUrl.searchParams.get("taskMode"),
    focusX: requestUrl.searchParams.get("focusX"),
    focusY: requestUrl.searchParams.get("focusY"),
    applyNow: requestUrl.searchParams.get("applyNow")
  });
  const replaceImage = requestUrl.searchParams.get("replaceImage") === "true";
  let uploadPath = null;
  const stageRoot = await fsp.mkdtemp(path.join(runtimeRoot, "theme-update-"));
  await fsp.chmod(stageRoot, 0o700);
  try {
    const imageName = replaceImage ? "background.jpg" : manifest.image;
    const stagedImage = path.join(stageRoot, imageName);
    if (replaceImage) {
      uploadPath = await receiveThemeImage(request, requestUrl.searchParams.get("fileName") || "");
      if (/\.jpe?g$/i.test(uploadPath)) {
        await fsp.copyFile(uploadPath, stagedImage);
      } else {
        await runFixedCommand("/usr/bin/sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", "2400", uploadPath, "--out", stagedImage], 90000);
      }
    } else {
      await fsp.copyFile(imagePath, stagedImage);
    }
    await fsp.chmod(stagedImage, 0o600);
    const imageStat = await fsp.stat(stagedImage);
    if (!imageStat.size || imageStat.size > 16 * 1024 * 1024) {
      throw Object.assign(new Error("Prepared image must be between 1 byte and 16 MB"), { statusCode: 400 });
    }

    const updated = structuredClone(manifest);
    updated.name = options.name;
    updated.appearance = options.appearance;
    updated.image = imageName;
    updated.managerGroup = options.group;
    updated.art = updated.art && typeof updated.art === "object" && !Array.isArray(updated.art) ? updated.art : {};
    updated.art.safeArea = options.safeArea;
    updated.art.taskMode = options.taskMode;
    if (options.focusX === null) delete updated.art.focusX;
    else updated.art.focusX = options.focusX;
    if (options.focusY === null) delete updated.art.focusY;
    else updated.art.focusY = options.focusY;
    await fsp.writeFile(path.join(stageRoot, "theme.json"), `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600 });

    await runFixedCommand(process.execPath, [path.join(engineRoot(), "scripts", "injector.mjs"), "--check-payload", "--theme-dir", stageRoot], 30000);
    if (replaceImage) {
      const temporaryImage = path.join(themeDirectory, `.background-${crypto.randomUUID()}.jpg`);
      await fsp.copyFile(stagedImage, temporaryImage);
      await fsp.chmod(temporaryImage, 0o600);
      await fsp.rename(temporaryImage, path.join(themeDirectory, imageName));
    }
    await writeManifestAtomic(themeDirectory, updated);
    if (replaceImage && manifest.image !== imageName) await fsp.rm(imagePath, { force: true });

    const result = { exitCode: 0, output: `Updated theme ${themeId}` };
    addLog(`update-theme ${themeId}`, result);
    const pending = options.applyNow ? queueThemeSwitch(themeId) : false;
    return { ...result, pending, applyDeferred: options.applyNow && !pending };
  } finally {
    if (uploadPath) await fsp.rm(uploadPath, { force: true }).catch(() => {});
    await fsp.rm(stageRoot, { recursive: true, force: true }).catch(() => {});
  }
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
      themeImportAvailable: fs.existsSync(path.join(engineRoot(), "scripts/load-image-theme-macos.sh")),
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

  if (request.method === "POST" && route === "/api/actions/start") {
    const result = await runScript("start-dream-skin-macos.sh", ["--restart-existing"]);
    return result.exitCode === 0 ? sendJson(response, 200, { ok: true, output: result.output }) : sendError(response, 502, result.output);
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
    if (!queueThemeSwitch(body.id)) return sendError(response, 409, "A theme switch is already running");
    return sendJson(response, 202, { ok: true, pending: true, output: "Theme switch is running in the background" });
  }
  if (request.method === "POST" && route === "/api/themes/import") {
    if (!fs.existsSync(path.join(engineRoot(), "scripts/load-image-theme-macos.sh"))) {
      return sendError(response, 501, "The installed theme engine does not support image themes");
    }
    const result = await importTheme(request, requestUrl);
    return sendJson(response, 200, { ok: true, output: result.output, themeId: result.themeId });
  }
  const updateThemeMatch = route.match(/^\/api\/themes\/([^/]+)\/update$/);
  if (request.method === "POST" && updateThemeMatch) {
    const result = await updateTheme(request, requestUrl, decodeURIComponent(updateThemeMatch[1]));
    return sendJson(response, result.pending ? 202 : 200, { ok: true, ...result });
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
