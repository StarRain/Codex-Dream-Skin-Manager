import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "..");
const [version, sha256, outputArgument] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version || "")) throw new Error("Invalid formula version");
if (!/^[a-f0-9]{64}$/.test(sha256 || "")) throw new Error("Invalid formula SHA-256");

const template = await fs.readFile(path.join(projectRoot, "packaging/homebrew/codex-dream-skin-manager.rb.template"), "utf8");
const output = template.replaceAll("__VERSION__", version).replaceAll("__SHA256__", sha256);
const outputPath = path.resolve(outputArgument || path.join(projectRoot, "dist/release/codex-dream-skin-manager.rb"));
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, output);
console.log(outputPath);
