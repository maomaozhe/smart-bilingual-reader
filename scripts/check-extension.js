const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const requiredFiles = [
  manifest.background.service_worker,
  manifest.options_page,
  ...manifest.content_scripts.flatMap((script) => [...(script.js || []), ...(script.css || [])])
].filter(Boolean);

if (manifest.action.default_popup) {
  requiredFiles.push(manifest.action.default_popup);
}

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing manifest file: ${file}`);
  }
}

const jsFiles = walk(root).filter((file) => file.endsWith(".js") && !file.includes(`${path.sep}dist${path.sep}`));
for (const file of jsFiles) {
  new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
}

console.log(`Checked ${jsFiles.length} JavaScript files and ${requiredFiles.length} manifest assets.`);

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
