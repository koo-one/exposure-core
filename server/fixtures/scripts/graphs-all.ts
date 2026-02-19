import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appendNodeOptions = (current: string | undefined, extra: string): string => {
  const trimmed = (current ?? "").trim();
  return trimmed ? `${trimmed} ${extra}` : extra;
};

const main = (): void => {
  const argv = process.argv.slice(2);

  let envFile: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--") {
      continue;
    }

    if (arg === "--env") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("--env requires a file path");
      }
      envFile = next;
      i += 1;
      continue;
    }

    if (arg === "--env-file") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("--env-file requires a file path");
      }
      envFile = next;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const serverDir = resolve(here, "..", "..");
  const repoRoot = resolve(serverDir, "..");

  const envFilePath = envFile ? resolve(repoRoot, envFile) : null;
  const childEnv = {
    ...process.env,
    ...(envFilePath
      ? {
          NODE_OPTIONS: appendNodeOptions(
            process.env.NODE_OPTIONS,
            `--env-file=${envFilePath}`,
          ),
        }
      : {}),
  };

  const tsxBin = resolve(
    repoRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
  );
  if (!existsSync(tsxBin)) {
    throw new Error(`Missing tsx binary at: ${tsxBin}`);
  }

  const scriptsRoot = resolve(serverDir, "fixtures", "scripts");
  const scriptDirs = readdirSync(scriptsRoot, { withFileTypes: true })
    .filter((ent) => ent.isDirectory())
    .map((ent) => ent.name)
    .filter((name) => !name.startsWith("."));

  const runNames = scriptDirs
    .filter((name) => name !== "search-index")
    .filter((name) => existsSync(resolve(scriptsRoot, name, "index.ts")))
    .sort((a, b) => a.localeCompare(b));

  for (const name of runNames) {
    const scriptPath = resolve(scriptsRoot, name, "index.ts");
    const result = spawnSync(tsxBin, [scriptPath], {
      cwd: serverDir,
      stdio: "inherit",
      env: childEnv,
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  // Always generate search-index last.
  const searchIndexPath = resolve(scriptsRoot, "search-index", "index.ts");
  if (existsSync(searchIndexPath)) {
    const searchResult = spawnSync(tsxBin, [searchIndexPath], {
      cwd: serverDir,
      stdio: "inherit",
      env: childEnv,
    });

    if (searchResult.status !== 0) {
      process.exit(searchResult.status ?? 1);
    }
  }
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
