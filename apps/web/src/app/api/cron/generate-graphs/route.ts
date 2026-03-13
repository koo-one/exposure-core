import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { NextResponse, type NextRequest } from "next/server";

import { resolveRepoPathFromWebCwd } from "@/lib/repoPaths";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const hasValidCronAuth = (
  authHeader: string | null,
  cronSecret: string | undefined,
): boolean => {
  if (!cronSecret || !authHeader) return false;

  const expectedAuth = `Bearer ${cronSecret}`;

  if (expectedAuth.length !== authHeader.length) return false;

  return timingSafeEqual(Buffer.from(expectedAuth), Buffer.from(authHeader));
};

export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!hasValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const childEnv = { ...process.env };
  delete childEnv.CRON_SECRET;

  try {
    const { stdout, stderr } = await execFileAsync("pnpm", ["graphs:prod"], {
      cwd: resolveRepoPathFromWebCwd(),
      env: childEnv,
    });

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
