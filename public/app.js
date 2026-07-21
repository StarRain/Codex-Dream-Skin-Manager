function savedPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

const initialLocale = savedPreference("dream-skin-locale") || (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
const systemThemeMedia = matchMedia("(prefers-color-scheme: light)");
const storedColorTheme = savedPreference("dream-skin-color-theme");
const initialColorTheme = ["system", "light", "dark"].includes(storedColorTheme) ? storedColorTheme : "system";
const state = { status: null, themes: [], config: null, logs: [], busy: false, pendingDeleteTheme: null, locale: initialLocale, colorTheme: initialColorTheme };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const pageLabels = { overview: "概览", themes: "主题库", logs: "操作记录", settings: "系统信息" };

const english = {
  "主导航": "Main navigation", "概览": "Overview", "主题库": "Themes", "操作记录": "Activity", "系统信息": "System information",
  "正在连接": "Connecting", "仅在本机": "Local access only", "可访问": "", "检测中": "Checking", "宿主机代理": "Host Agent",
  "刷新数据": "Refresh data", "刷新": "Refresh", "切换语言": "Switch language", "切换亮暗主题": "Toggle color theme", "切换为亮色主题": "Switch to light theme", "切换为暗色主题": "Switch to dark theme", "语言": "Language", "外观": "Appearance",
  "跟随系统": "System", "亮色": "Light", "暗色": "Dark",
  "CODEX 桌面端 · 本地主题引擎": "CODEX DESKTOP · LOCAL THEME ENGINE", "引擎控制": "ENGINE CONTROL", "活动": "ACTIVITY",
  "本地主题库": "LOCAL LIBRARY", "本地操作记录": "LOCAL ACTIVITY", "本地架构": "LOCAL ARCHITECTURE",
  "网页管理界面": "WEB GUI", "皮肤引擎": "SKIN ENGINE", "256 位令牌 · 端口 4174": "256-bit Token · Port 4174", "macOS 脚本 · 本地 CDP": "macOS Scripts · Local CDP",
  "让工作台，拥有": "Give your workspace", "今天的氛围。": "today's atmosphere.",
  "使用 Codex Dream Skin Manager 管理主题，运行状态全部留在你的 Mac。": "Manage themes with Codex Dream Skin Manager. Runtime state stays on your Mac.",
  "应用当前皮肤": "Apply current skin", "暂停注入": "Pause injection", "皮肤状态": "Skin status", "注入器": "Injector", "仅连接本机回环地址": "Local loopback only",
  "快速控制": "Quick controls", "应用皮肤": "Apply skin", "启动或重新连接 Codex Dream Skin 引擎": "Start or reconnect the Codex Dream Skin engine",
  "暂停皮肤": "Pause skin", "移除当前注入，保持 Codex 运行": "Remove injection and keep Codex running",
  "恢复官方外观": "Restore official appearance", "恢复基础配置并正常重启 Codex": "Restore base settings and restart Codex",
  "最近操作": "Recent activity", "查看全部": "View all", "还没有操作记录": "No activity yet",
  "预设与自定义主题都保存在本机。": "Preset and custom themes are stored locally.", "主题库还是空的": "The theme library is empty",
  "请先安装带有预设主题的 Codex Dream Skin 引擎。": "Install the Codex Dream Skin engine with preset themes first.",
  "显示本次宿主机代理运行期间的命令结果。": "Command results from the current Host Agent session.", "刷新记录": "Refresh activity",
  "查看当前版本、运行环境与项目资源。": "View the current version, runtime environment, and project resources.",
  "正在检测": "Checking", "管理器版本": "Manager version", "运行平台": "Platform", "引擎目录": "Engine directory", "状态目录": "State directory",
  "容器无法直接操作 macOS 应用，因此所有系统调用都由带随机密钥认证的最小宿主机代理完成。原项目文件保持不变。": "The container cannot control macOS apps directly, so system calls run through a minimal host agent protected by a random token. Original project files remain unchanged.",
  "快捷链接": "Quick links", "访问项目仓库，获取源码、帮助和更新。": "Visit project repositories for source code, help, and updates.",
  "主程序仓库": "Main repository", "Codex Dream Skin · 主题引擎与预设": "Codex Dream Skin · Engine and presets",
  "WebUI 仓库": "WebUI repository", "Codex Dream Skin Manager · 本地管理界面": "Codex Dream Skin Manager · Local web interface",
  "正在处理": "Processing", "部分操作可能会重启 Codex，请稍候": "Some actions may restart Codex. Please wait.",
  "恢复官方外观？": "Restore official appearance?", "这会停止注入器、恢复基础主题配置并重启 Codex。你的本地主题库不会被删除。": "This stops the injector, restores base theme settings, and restarts Codex. Your local theme library will not be deleted.",
  "取消": "Cancel", "恢复并重启": "Restore and restart", "删除这个主题？": "Delete this theme?", "主题“": "Theme “",
  "”及其本地文件将被永久删除，此操作无法撤销。": "” and its local files will be permanently deleted. This cannot be undone.", "确认删除": "Delete theme",
  "请求失败": "Request failed", "运行中": "Running", "已暂停": "Paused", "状态异常": "Status error", "状态未知": "Unknown", "未启用": "Disabled",
  "引擎已连接": "Engine connected", "引擎未连接": "Engine disconnected", "已找到可用引擎": "Engine available", "未找到 Codex Dream Skin 引擎": "Codex Dream Skin engine not found",
  "宿主机代理就绪": "Host Agent ready", "检查设置": "Check settings", "皮肤在线": "Skin online", "皮肤离线": "Skin offline", "代理离线": "Agent offline",
  "未连接": "Disconnected", "尚未选择主题": "No theme selected", "已打开": "Open", "未运行": "Not running", "本地调试口未连接": "Local debug port disconnected", "守护中": "Watching",
  "当前主题": "Current", "预设": "Preset", "自定义": "Custom", "本地 Codex Dream Skin 主题": "Local Codex Dream Skin theme", "删除": "Delete", "重新应用": "Reapply", "应用主题": "Apply theme",
  "预设主题不能删除": "Preset themes cannot be deleted",
  "应用或切换一次主题后，结果会显示在这里。": "Results appear here after applying or switching a theme.", "完成": "Done",
  "无法连接 Host Agent": "Cannot connect to Host Agent", "读取记录失败": "Failed to load activity", "正在应用皮肤": "Applying skin", "皮肤已应用": "Skin applied",
  "正在暂停皮肤": "Pausing skin", "皮肤已暂停": "Skin paused", "正在恢复官方外观": "Restoring official appearance", "已恢复官方外观": "Official appearance restored",
  "正在切换主题": "Switching theme", "主题已切换": "Theme switched", "操作完成": "Action complete", "操作失败": "Action failed",
  "正在删除主题": "Deleting theme", "主题已删除": "Theme deleted", "删除失败": "Delete failed", "当前主题不能删除，请先切换到其他主题": "The active theme cannot be deleted. Switch to another theme first.",
  "请先切换到其他主题": "Switch to another theme first", "主题背景": "theme background"
};
const originalText = new WeakMap();
const themeButtonIcons = {
  sun: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>`,
  moon: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>`,
  system: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/></svg>`
};

function t(value) {
  return state.locale === "en" ? (english[value] ?? value) : value;
}

function localizeDom(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("script, style")) continue;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const trimmed = source.trim();
    if (!trimmed || !(trimmed in english)) continue;
    const leading = source.match(/^\s*/)?.[0] || "";
    const trailing = source.match(/\s*$/)?.[0] || "";
    node.nodeValue = `${leading}${t(trimmed)}${trailing}`;
  }
}

function savePreference(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function applyPreferences(rerender = true) {
  const effectiveColorTheme = state.colorTheme === "system" ? (systemThemeMedia.matches ? "light" : "dark") : state.colorTheme;
  document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.colorTheme = effectiveColorTheme;
  document.documentElement.dataset.colorThemePreference = state.colorTheme;
  $("#language-toggle").title = t("语言");
  $("#language-toggle").setAttribute("aria-label", state.locale === "zh" ? "切换语言" : "Switch language");
  const themeButtonIcon = state.colorTheme === "system" ? "system" : effectiveColorTheme === "dark" ? "moon" : "sun";
  $("#theme-icon").innerHTML = themeButtonIcons[themeButtonIcon];
  $("#theme-toggle").title = t("外观");
  $("#theme-toggle").setAttribute("aria-label", t("切换亮暗主题"));
  $$(".language-option").forEach(button => {
    const active = button.dataset.locale === state.locale;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  $$(".theme-option").forEach(button => {
    const active = button.dataset.colorTheme === state.colorTheme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  $("nav").setAttribute("aria-label", t("主导航"));
  $("#refresh-button").title = t("刷新");
  $("#refresh-button").setAttribute("aria-label", t("刷新数据"));
  const activeSection = $(".nav-item.active")?.dataset.section || "overview";
  $("#page-name").textContent = t(pageLabels[activeSection]);
  if (rerender && state.config) {
    renderConnection();
    renderStatus();
    renderLogs();
  }
  localizeDom();
}

function closePreferenceMenus(except) {
  [["language", "#language-menu", "#language-toggle"], ["theme", "#theme-menu", "#theme-toggle"]].forEach(([name, menuSelector, buttonSelector]) => {
    if (name === except) return;
    $(menuSelector).classList.add("hidden");
    $(buttonSelector).classList.remove("active");
    $(buttonSelector).setAttribute("aria-expanded", "false");
  });
}

function togglePreferenceMenu(name) {
  const menu = $(`#${name}-menu`);
  const button = $(`#${name}-toggle`);
  const opening = menu.classList.contains("hidden");
  closePreferenceMenus(name);
  menu.classList.toggle("hidden", !opening);
  button.classList.toggle("active", opening);
  button.setAttribute("aria-expanded", String(opening));
}

async function api(path, options = {}) {
  if (options.method && options.method !== "GET") {
    options.headers = { ...(options.headers || {}), "x-manager-request": "1" };
  }
  const response = await fetch(path, options);
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok || result?.ok === false) throw new Error(result?.error || `请求失败（${response.status}）`);
  return result;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function switchPage(name) {
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.section === name));
  $$(".page").forEach(page => page.classList.toggle("active", page.id === `page-${name}`));
  $("#page-name").textContent = t(pageLabels[name] || "概览");
  history.replaceState(null, "", `#${name}`);
  if (name === "logs") refreshLogs();
}

function setBusy(active, title = "正在处理") {
  state.busy = active;
  $("#busy-title").textContent = t(title);
  $("#busy").classList.toggle("hidden", !active);
  $$("button").forEach(button => {
    if (button.closest("dialog")) return;
    if (active) {
      button.dataset.busyPrevious = String(button.disabled);
      button.disabled = true;
    } else {
      button.disabled = button.dataset.busyPrevious === "true";
      delete button.dataset.busyPrevious;
    }
  });
}

function toast(title, message = "", error = false) {
  const node = document.createElement("div");
  node.className = `toast${error ? " error" : ""}`;
  node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  $("#toast-stack").append(node);
  localizeDom(node);
  setTimeout(() => node.remove(), 5200);
}

function statusLabel(session) {
  return ({ active: "运行中", paused: "已暂停", stale: "状态异常", unknown: "状态未知", off: "未启用" })[session] || "未启用";
}

function renderConnection() {
  const available = Boolean(state.config?.engineAvailable);
  const mini = $("#engine-mini");
  mini.classList.toggle("ready", available);
  mini.querySelector("strong").textContent = available ? "引擎已连接" : "引擎未连接";
  mini.querySelector("small").textContent = t(available ? "宿主机代理就绪" : "检查设置");
  $("#engine-dot").classList.toggle("ready", available);
  $("#engine-title").textContent = available ? "已找到可用引擎" : "未找到 Codex Dream Skin 引擎";
  const managerVersion = state.config?.version ? `v${state.config.version}` : "—";
  $("#manager-version").textContent = managerVersion;
  $("#brand-version").textContent = managerVersion;
  $("#engine-path").textContent = state.config?.enginePath || "—";
  $("#state-path").textContent = state.config?.stateRoot || "—";
  $("#platform-name").textContent = state.config?.platform || "—";
  $("#engine-repository").href = state.config?.repositories?.engine || "https://github.com/Fei-Away/Codex-Dream-Skin";
  $("#webui-repository").href = state.config?.repositories?.webui || "https://github.com/StarRain/Codex-Dream-Skin-Manager";
}

function renderStatus() {
  const status = state.status;
  const active = status?.session === "active" && status?.injectorAlive;
  $("#skin-status").textContent = status ? statusLabel(status.session) : "未连接";
  $("#active-theme").textContent = status?.themeName || "尚未选择主题";
  $("#codex-status").textContent = status?.codexRunning ? "已打开" : "未运行";
  $("#cdp-status").textContent = status?.cdpOk ? (state.locale === "en" ? `CDP connected · ${status.port}` : `CDP 已连接 · ${status.port}`) : "本地调试口未连接";
  $("#injector-status").textContent = status?.injectorAlive ? "守护中" : "未运行";
  const pill = $("#live-pill");
  pill.classList.toggle("ready", active);
  pill.querySelector("span").textContent = t(active ? "皮肤在线" : status ? "皮肤离线" : "代理离线");
  renderThemes();
}

function renderThemes() {
  $("#theme-count").textContent = state.themes.length;
  $("#theme-empty").classList.toggle("hidden", state.themes.length > 0);
  $("#theme-grid").innerHTML = state.themes.map(theme => {
    const active = theme.manifestId === state.status?.themeId;
    const preset = theme.id.startsWith("preset-");
    const deleteDisabled = preset || active;
    const deleteTitle = preset ? t("预设主题不能删除") : active ? t("请先切换到其他主题") : "";
    return `<article class="theme-card">
      <div class="theme-art">${theme.hasImage ? `<img src="${escapeHtml(theme.imageUrl)}" alt="${escapeHtml(theme.name)} ${t("主题背景")}" loading="lazy">` : ""}<span class="theme-badge ${active ? "active" : ""}">${active ? `● ${t("当前主题")}` : preset ? t("预设") : t("自定义")}</span></div>
      <div class="theme-info"><h3>${escapeHtml(theme.name)}</h3><p>${escapeHtml(theme.tagline || t("本地 Codex Dream Skin 主题"))}</p><div class="theme-footer"><small>${escapeHtml(theme.appearance)}</small><div class="theme-actions"><button data-theme-action="delete" data-theme-id="${escapeHtml(theme.id)}" data-theme-name="${escapeHtml(theme.name)}" class="delete-theme" ${deleteDisabled ? `disabled title="${deleteTitle}"` : ""}>${t("删除")}</button><button data-theme-action="switch" data-theme-id="${escapeHtml(theme.id)}">${active ? t("重新应用") : t("应用主题")}</button></div></div></div>
    </article>`;
  }).join("");
  $$('[data-theme-action="switch"]').forEach(button => button.addEventListener("click", () => runAction("switch", button.dataset.themeId)));
  $$('[data-theme-action="delete"]').forEach(button => button.addEventListener("click", () => openDeleteThemeDialog(button.dataset.themeId, button.dataset.themeName)));
}

function renderLogs() {
  const empty = '<div class="empty-state"><div><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg></div><h3>还没有操作记录</h3><p>应用或切换一次主题后，结果会显示在这里。</p></div>';
  const dateLocale = state.locale === "zh" ? "zh-CN" : "en-US";
  $("#log-list").innerHTML = state.logs.length ? state.logs.map(log => `<article class="log-entry ${log.exitCode ? "error" : ""}"><header><i></i><strong>${escapeHtml(log.action)}</strong><time>${new Date(log.time).toLocaleString(dateLocale)}</time></header><pre>${escapeHtml(log.output || t("完成"))}</pre></article>`).join("") : empty;
  $("#recent-log").innerHTML = state.logs.length ? state.logs.slice(0, 3).map(log => `<div class="recent-item ${log.exitCode ? "error" : ""}"><i></i><div><strong>${escapeHtml(log.action)}</strong><small>${escapeHtml((log.output || t("完成")).split("\n").at(-1))}</small></div><small>${new Date(log.time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}</small></div>`).join("") : '<div class="empty-inline">还没有操作记录</div>';
}

async function refreshAll(showError = true) {
  try {
    const [config, status, themes, logs] = await Promise.all([
      api("/api/config"), api("/api/status"), api("/api/themes"), api("/api/logs")
    ]);
    state.config = config;
    state.status = status.status;
    state.themes = themes.themes;
    state.logs = logs.logs;
    renderConnection(); renderStatus(); renderLogs(); localizeDom();
  } catch (error) {
    state.status = null;
    renderStatus(); localizeDom();
    if (showError) toast("无法连接 Host Agent", error.message, true);
  }
}

async function refreshLogs() {
  try { state.logs = (await api("/api/logs")).logs; renderLogs(); localizeDom(); } catch (error) { toast("读取记录失败", error.message, true); }
}

const actionMeta = {
  apply: ["正在应用皮肤", "/api/actions/apply", "皮肤已应用"],
  pause: ["正在暂停皮肤", "/api/actions/pause", "皮肤已暂停"],
  restore: ["正在恢复官方外观", "/api/actions/restore", "已恢复官方外观"],
  switch: ["正在切换主题", "/api/actions/switch", "主题已切换"]
};

async function runAction(action, id) {
  if (state.busy) return;
  const [busyTitle, endpoint, successTitle] = actionMeta[action];
  setBusy(true, busyTitle);
  try {
    const options = { method: "POST" };
    if (action === "switch") {
      options.headers = { "content-type": "application/json" };
      options.body = JSON.stringify({ id });
    }
    const result = await api(endpoint, options);
    toast(successTitle, result.output?.split("\n").at(-1) || "操作完成");
  } catch (error) {
    toast("操作失败", error.message, true);
  } finally {
    setBusy(false);
    await refreshAll(false);
  }
}

function openDeleteThemeDialog(id, name) {
  if (state.busy) return;
  state.pendingDeleteTheme = { id, name };
  $("#delete-theme-name").textContent = name;
  $("#delete-theme-dialog").showModal();
}

function closeDeleteThemeDialog() {
  $("#delete-theme-dialog").close();
  state.pendingDeleteTheme = null;
}

async function deleteTheme() {
  const theme = state.pendingDeleteTheme;
  if (!theme || state.busy) return;
  $("#delete-theme-dialog").close();
  setBusy(true, "正在删除主题");
  try {
    await api(`/api/themes/${encodeURIComponent(theme.id)}`, { method: "DELETE" });
    toast("主题已删除", theme.name);
  } catch (error) {
    toast("删除失败", error.message, true);
  } finally {
    state.pendingDeleteTheme = null;
    setBusy(false);
    await refreshAll(false);
  }
}

$$('.nav-item').forEach(button => button.addEventListener("click", () => switchPage(button.dataset.section)));
$$('[data-section-jump]').forEach(button => button.addEventListener("click", () => switchPage(button.dataset.sectionJump)));
$$('.action-button').forEach(button => button.addEventListener("click", () => runAction(button.dataset.action)));
$("#refresh-button").addEventListener("click", () => refreshAll());
$("#refresh-logs").addEventListener("click", refreshLogs);
$("#restore-button").addEventListener("click", () => $("#confirm-dialog").showModal());
$("#cancel-restore").addEventListener("click", () => $("#confirm-dialog").close());
$("#confirm-restore").addEventListener("click", () => { $("#confirm-dialog").close(); runAction("restore"); });
$("#cancel-delete-theme").addEventListener("click", closeDeleteThemeDialog);
$("#confirm-delete-theme").addEventListener("click", deleteTheme);
$("#language-toggle").addEventListener("click", event => { event.stopPropagation(); togglePreferenceMenu("language"); });
$("#theme-toggle").addEventListener("click", event => { event.stopPropagation(); togglePreferenceMenu("theme"); });
$$('[data-locale]').forEach(button => button.addEventListener("click", event => {
  event.stopPropagation();
  state.locale = button.dataset.locale;
  savePreference("dream-skin-locale", state.locale);
  closePreferenceMenus();
  applyPreferences();
}));
$$('[data-color-theme]').forEach(button => button.addEventListener("click", event => {
  event.stopPropagation();
  state.colorTheme = button.dataset.colorTheme;
  savePreference("dream-skin-color-theme", state.colorTheme);
  closePreferenceMenus();
  applyPreferences(false);
}));
document.addEventListener("click", () => closePreferenceMenus());
document.addEventListener("keydown", event => { if (event.key === "Escape") closePreferenceMenus(); });
systemThemeMedia.addEventListener("change", () => { if (state.colorTheme === "system") applyPreferences(false); });

applyPreferences(false);
const initialPage = location.hash.slice(1);
if (["overview", "themes", "logs", "settings"].includes(initialPage)) switchPage(initialPage);
refreshAll();
setInterval(() => { if (!state.busy && document.visibilityState === "visible") refreshAll(false); }, 15000);
