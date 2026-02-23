import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..");
const scriptsRoot = resolve(serverDir, "fixtures", "scripts");

const run = (scriptPath: string) => {
  const { status } = spawnSync(
    "pnpm",
    ["-s", "exec", "tsx", scriptPath, ...process.argv.slice(2)],
    {
      cwd: serverDir,
      stdio: "inherit",
    },
  );
  if (status) process.exit(status);
};

const dirs = readdirSync(scriptsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("."))
  .map((d) => d.name);

dirs
  .filter((n) => n !== "search-index")
  .sort((a, b) => a.localeCompare(b))
  .concat("search-index")
  .forEach((name) => {
    const scriptPath = resolve(scriptsRoot, name, "index.ts");

    if (existsSync(scriptPath)) run(scriptPath);
  });
