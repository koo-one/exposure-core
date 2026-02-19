import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const die = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const run = (scriptPath: string, cwd: string, env: NodeJS.ProcessEnv): void => {
  const result = spawnSync("pnpm", ["-s", "exec", "tsx", scriptPath], {
    cwd,
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const argv = process.argv.slice(2).filter((arg) => arg !== "--");

let envFile: string | null = null;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];

  if (arg === "--env" || arg === "--env-file") {
    const next = argv[i + 1];

    if (!next) {
      die(`${arg} requires a file path`);
    }

    envFile = next;
    i += 1;

    continue;
  }

  die(`Unknown argument: ${arg}`);
}

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..", "..");
const repoRoot = resolve(serverDir, "..");

const envFilePath = envFile ? resolve(repoRoot, envFile) : null;
const nodeOptions = envFilePath
  ? `${process.env.NODE_OPTIONS ?? ""} --env-file=${envFilePath}`.trim()
  : process.env.NODE_OPTIONS;

const childEnv = {
  ...process.env,
  ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
};

const scriptsRoot = resolve(serverDir, "fixtures", "scripts");
const scriptNames = readdirSync(scriptsRoot, { withFileTypes: true })
  .filter((ent) => ent.isDirectory() && !ent.name.startsWith("."))
  .map((ent) => ent.name)
  .sort((a, b) => a.localeCompare(b));

for (const name of scriptNames) {
  if (name === "search-index") {
    continue;
  }

  const scriptPath = resolve(scriptsRoot, name, "index.ts");
  if (existsSync(scriptPath)) {
    run(scriptPath, serverDir, childEnv);
  }
}

// Always generate search-index last.
const searchIndexPath = resolve(scriptsRoot, "search-index", "index.ts");
if (existsSync(searchIndexPath)) {
  run(searchIndexPath, serverDir, childEnv);
}
