import test from "node:test";
import assert from "node:assert/strict";
import {
  choice,
  clampText,
  isPresetThemeId,
  isThemeId,
  normalizeStatus,
  themeGroup,
  themeImageExtension,
  themeImportOptions
} from "../src/lib.mjs";

test("theme ids match the engine contract", () => {
  assert.equal(isThemeId("preset-midnight-aurora"), true);
  assert.equal(isThemeId("img_20260721"), true);
  assert.equal(isThemeId("../escape"), false);
  assert.equal(isThemeId("theme name"), false);
  assert.equal(isThemeId("x".repeat(81)), false);
});

test("preset themes are protected from deletion", () => {
  assert.equal(isPresetThemeId("preset-midnight-aurora"), true);
  assert.equal(isPresetThemeId("custom-midnight-aurora"), false);
  assert.equal(isPresetThemeId("../preset-escape"), false);
});

test("options use safe fallbacks", () => {
  assert.equal(choice("dark", ["auto", "dark"], "auto"), "dark");
  assert.equal(choice("system", ["auto", "dark"], "auto"), "auto");
});

test("display text cannot inject control lines", () => {
  assert.equal(clampText("hello\nworld\0", 20), "hello world");
  assert.equal(clampText("abcdef", 4), "abcd");
});

test("theme groups are safe and have a stable fallback", () => {
  assert.equal(themeGroup("  工作主题  "), "工作主题");
  assert.equal(themeGroup("团队\n主题\0"), "团队 主题");
  assert.equal(themeGroup(""), "未分组");
  assert.equal(themeGroup("x".repeat(60)).length, 40);
});

test("a live CDP endpoint proves the Codex desktop process is running", () => {
  assert.deepEqual(normalizeStatus({ cdpOk: true, codexRunning: false }), { cdpOk: true, codexRunning: true });
  assert.deepEqual(normalizeStatus({ cdpOk: false, codexRunning: false }), { cdpOk: false, codexRunning: false });
});

test("theme import options accept only the upstream engine contract", () => {
  assert.deepEqual(themeImportOptions({
    name: "  My theme  ", group: "Work", appearance: "auto", safeArea: "left", taskMode: "banner",
    focusX: "0.72", focusY: "", applyNow: "false"
  }), {
    name: "My theme", group: "Work", appearance: "auto", safeArea: "left", taskMode: "banner",
    focusX: 0.72, focusY: null, applyNow: false
  });
  assert.throws(() => themeImportOptions({ name: "x", appearance: "system", safeArea: "auto", taskMode: "auto" }), /Invalid appearance/);
  assert.throws(() => themeImportOptions({ name: "x", appearance: "auto", safeArea: "auto", taskMode: "auto", focusX: 1.1 }), /Invalid focusX/);
});

test("theme imports accept only image formats supported by the engine", () => {
  assert.equal(themeImageExtension("photo.unknown", "image/png"), ".png");
  assert.equal(themeImageExtension("photo.HEIC", ""), ".heic");
  assert.equal(themeImageExtension("payload.svg", "image/svg+xml"), null);
});
