import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse, type NextRequest } from "next/server";

import { resolveRepoPathFromWebCwd } from "@/lib/repoPaths";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "pnpm",
      ["graphs:all", "--", "--upload"],
      {
        cwd: resolveRepoPathFromWebCwd(),
        env: process.env,
      },
    );

    return NextResponse.json({
      ok: true,
      stdout,
      stderr,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
