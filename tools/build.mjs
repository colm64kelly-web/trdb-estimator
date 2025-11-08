// tools/build.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import JavaScriptObfuscator from "javascript-obfuscator";

const ROOT = process.cwd();
const SRC_JS = path.join(ROOT, "src", "app.js");
const SRC_HTML = path.join(ROOT, "index.html");
const SRC_CSS = path.join(ROOT, "public", "styles.css");
const DIST = path.join(ROOT, "dist");
const DIST_HTML = path.join(DIST, "index.html");
const DIST_CSS_DIR = path.join(DIST, "public");
const DIST_CSS = path.join(DIST_CSS_DIR, "styles.css");
const DIST_JS = path.join(DIST, "app.obf.js");

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const sha384 = (buf) =>
  "sha384-" + crypto.createHash("sha384").update(buf).digest("base64");

const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, c) => fs.writeFileSync(p, c);
const copy = (a, b) => fs.copyFileSync(a, b);

console.log("• Cleaning dist/");
fs.rmSync(DIST, { recursive: true, force: true });
ensureDir(DIST);
ensureDir(DIST_CSS_DIR);

console.log("• Copying index.html and styles.css");
copy(SRC_HTML, DIST_HTML);
copy(SRC_CSS, DIST_CSS);

console.log("• Obfuscating src/app.js → dist/app.obf.js");
const appSrc = read(SRC_JS);
const obf = JavaScriptObfuscator.obfuscate(appSrc, {
  compact: true,
  controlFlowFlattening: true,
  deadCodeInjection: true,
  identifierNamesGenerator: "hexadecimal",
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  stringArray: true,
  stringArrayThreshold: 0.75
});
write(DIST_JS, obf.getObfuscatedCode());

const sri = sha384(fs.readFileSync(DIST_JS));
console.log("• SRI (sha384) for app.obf.js:", sri);

let html = read(DIST_HTML);
html = html.replace(
  /<script[^>]+src=["']\s*src\/app\.js\s*["'][^>]*>\s*<\/script>\s*/gi,
  ""
);

const tag = `<script src="./app.obf.js" integrity="${sri}" crossorigin="anonymous"></script>`;
if (/<\/body>/i.test(html)) {
  html = html.replace(/<\/body>/i, `  ${tag}\n</body>`);
} else {
  html += `\n${tag}\n`;
}

write(DIST_HTML, html);

console.log("\n✅ Build complete.\n");
console.log("Upload the entire ./dist folder to Netlify (drag & drop).");
console.log("Your HTML/CSS remain unchanged, JS is obfuscated with SRI.");
