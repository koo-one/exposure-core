import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // Root domain: redirect exposure.forum → resolv.exposure.forum
  if (
    (host === "exposure.forum" || host === "www.exposure.forum") &&
    request.nextUrl.pathname === "/"
  ) {
    return NextResponse.redirect("https://resolv.exposure.forum");
  }

  // Match *.exposure.forum subdomains
  const match = host.match(/^([a-z0-9-]+)\.exposure\.forum$/);
  if (match) {
    const subdomain = match[1];
    // subdomain maps directly to incident slug
    // resolv.exposure.forum → /incident/resolv
    const resolvedSlug = subdomain;

    // Rewrite to incident route (preserves the rest of the path)
    const url = request.nextUrl.clone();
    const currentPath = url.pathname;
    url.pathname = `/incident/${resolvedSlug}${currentPath === "/" ? "" : currentPath}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|logos/).*)"],
};
