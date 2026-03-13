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
  return status ?? 1;
};

const dirs = readdirSync(scriptsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("."))
  .map((d) => d.name);

const failures: { name: string; status: number }[] = [];

dirs
  .filter((n) => n !== "protocol-graphs" && n !== "search-index")
  .sort((a, b) => a.localeCompare(b))
  .concat("protocol-graphs", "search-index")
  .forEach((name) => {
    const scriptPath = resolve(scriptsRoot, name, "index.ts");

    if (!existsSync(scriptPath)) return;

    const status = run(scriptPath);
    if (status !== 0) {
      failures.push({ name, status });
    }
  });

if (failures.length > 0) {
  console.error(
    `graphs-all completed with failures: ${failures
      .map(({ name, status }) => `${name}(${status})`)
      .join(", ")}`,
  );
  process.exit(1);
}
