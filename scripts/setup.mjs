import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, "..");
const vendorRoot = resolve(workspaceRoot, "vendor");
const repoRoot = resolve(vendorRoot, "godot-docs");
const repoUrl = "https://github.com/godotengine/godot-docs.git";
const branch = "stable";

function runGit(args, cwd = workspaceRoot) {
  execFileSync("git", args, {
    cwd,
    stdio: "inherit"
  });
}

mkdirSync(vendorRoot, { recursive: true });

if (!existsSync(resolve(repoRoot, ".git"))) {
  runGit(["clone", "--depth", "1", "--branch", branch, repoUrl, repoRoot]);
} else {
  runGit(["fetch", "--depth", "1", "origin", branch], repoRoot);
  runGit(["reset", "--hard", `origin/${branch}`], repoRoot);
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repoRoot,
  encoding: "utf8"
}).trim();

const date = execFileSync("git", ["log", "-1", "--format=%cI"], {
  cwd: repoRoot,
  encoding: "utf8"
}).trim();

console.log("Godot-Doku aktualisiert.");
console.log(`Pfad: ${repoRoot}`);
console.log(`Branch: ${branch}`);
console.log(`Commit: ${commit}`);
console.log(`Datum: ${date}`);
