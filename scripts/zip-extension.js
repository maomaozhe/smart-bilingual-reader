const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const output = path.join(dist, "smart-bilingual-reader.zip");

fs.mkdirSync(dist, { recursive: true });
if (fs.existsSync(output)) {
  fs.rmSync(output);
}

const result = spawnSync(
  "zip",
  [
    "-r",
    output,
    "manifest.json",
    "src",
    "README.md",
    "README_EN.md",
    "LICENSE",
    "package.json",
    "-x",
    "*/.DS_Store"
  ],
  { cwd: root, stdio: "inherit" }
);

if (result.status !== 0) {
  throw new Error("zip command failed");
}

console.log(output);
