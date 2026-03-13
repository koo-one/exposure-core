import { timingSafeEqual } from "node:crypto";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import { uploadGraphs } from "../../src/exposure/graphs-upload";

const hasValidCronAuth = (
  authHeader: string | undefined,
  cronSecret: string | undefined,
): boolean => {
  if (!cronSecret || !authHeader) return false;

  const expectedAuth = `Bearer ${cronSecret}`;

  if (expectedAuth.length !== authHeader.length) return false;

  return timingSafeEqual(Buffer.from(expectedAuth), Buffer.from(authHeader));
};

const handler = async (request: VercelRequest, response: VercelResponse) => {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.authorization;

  if (!hasValidCronAuth(authHeader, cronSecret)) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await uploadGraphs();
    response.status(200).json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    response.status(500).json({ ok: false, error: message });
  }
};

export default handler;
