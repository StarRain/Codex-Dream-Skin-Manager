import test from "node:test";
import assert from "node:assert/strict";
import { choice, clampText, isPresetThemeId, isThemeId, normalizeStatus } from "../src/lib.mjs";

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

test("a live CDP endpoint proves the Codex desktop process is running", () => {
  assert.deepEqual(normalizeStatus({ cdpOk: true, codexRunning: false }), { cdpOk: true, codexRunning: true });
  assert.deepEqual(normalizeStatus({ cdpOk: false, codexRunning: false }), { cdpOk: false, codexRunning: false });
});
