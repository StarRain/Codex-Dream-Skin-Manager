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

export function themeGroup(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, " ")
    .trim()
    .slice(0, 40) || "未分组";
}

export function themeImportOptions(value = {}) {
  const name = clampText(value.name, 80);
  if (!name) throw Object.assign(new Error("Theme name is required"), { statusCode: 400 });

  const validateChoice = (field, allowed) => {
    const selected = String(value[field] ?? "");
    if (!allowed.includes(selected)) {
      throw Object.assign(new Error(`Invalid ${field}`), { statusCode: 400 });
    }
    return selected;
  };
  const validateFocus = field => {
    if (value[field] === "" || value[field] === null || value[field] === undefined) return null;
    const number = Number(value[field]);
    if (!Number.isFinite(number) || number < 0 || number > 1) {
      throw Object.assign(new Error(`Invalid ${field}`), { statusCode: 400 });
    }
    return number;
  };

  return {
    name,
    group: themeGroup(value.group),
    appearance: validateChoice("appearance", ["auto", "light", "dark"]),
    safeArea: validateChoice("safeArea", ["auto", "left", "right", "center", "none"]),
    taskMode: validateChoice("taskMode", ["auto", "ambient", "banner", "off"]),
    focusX: validateFocus("focusX"),
    focusY: validateFocus("focusY"),
    applyNow: value.applyNow !== false && value.applyNow !== "false"
  };
}

export function themeImageExtension(fileName, contentType = "") {
  const mimeExtensions = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heic",
    "image/tiff": ".tiff"
  };
  const byMime = mimeExtensions[String(contentType).split(";", 1)[0].trim().toLowerCase()];
  if (byMime) return byMime;
  const extension = path.extname(String(fileName)).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".heic", ".tif", ".tiff"].includes(extension) ? extension : null;
}

export function normalizeStatus(value = {}) {
  const cdpOk = value.cdpOk === true;
  return {
    ...value,
    cdpOk,
    codexRunning: value.codexRunning === true || cdpOk
  };
}
