import path from "node:path";

export const THEME_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export function isThemeId(value) {
  return typeof value === "string" && THEME_ID_PATTERN.test(value);
}

export function isPresetThemeId(value) {
  return isThemeId(value) && value.startsWith("preset-");
}

export function choice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js": case ".mjs": return "text/javascript; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

export function clampText(value, maximum = 120) {
  return String(value ?? "").replace(/[\r\n\0]/g, " ").trim().slice(0, maximum);
}

export function normalizeStatus(value = {}) {
  const cdpOk = value.cdpOk === true;
  return {
    ...value,
    cdpOk,
    codexRunning: value.codexRunning === true || cdpOk
  };
}
