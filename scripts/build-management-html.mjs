import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "..");
const publicRoot = path.join(projectRoot, "public");
const outputPath = path.resolve(process.argv[2] || path.join(projectRoot, "dist/management.html"));

const [sourceHtml, css, app, logo] = await Promise.all([
  fs.readFile(path.join(publicRoot, "index.html"), "utf8"),
  fs.readFile(path.join(publicRoot, "styles.css"), "utf8"),
  fs.readFile(path.join(publicRoot, "app.js"), "utf8"),
  fs.readFile(path.join(publicRoot, "assets/codex-dream-skin-manager-logo-transparent.png"))
]);

const logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;
const escapedApp = app.replace(/<\/script/gi, "<\\/script");
let html = sourceHtml
  .replace(/<link rel="stylesheet" href="\/styles\.css\?v=[^"]+">/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="\/app\.js\?v=[^"]+"><\/script>/, `<script type="module">\n${escapedApp}\n</script>`)
  .replace(/\/assets\/codex-dream-skin-manager-logo-transparent\.png\?v=[^"']+/g, logoDataUrl);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, html);
console.log(outputPath);
