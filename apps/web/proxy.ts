import { NextResponse, type NextRequest } from "next/server";
import { hasValidAccessToken } from "@/lib/access";

export async function proxy(request: NextRequest) {
  if (process.env.DEVBOARD_BROWSER_TEST === "1") return NextResponse.next();

  const password = process.env.APP_ACCESS_PASSWORD;
  if (!password) {
    return new NextResponse("APP_ACCESS_PASSWORD must be configured.", {
      status: 503,
    });
  }

  if (await hasValidAccessToken(request.cookies.get("devboard_access")?.value, password)) {
    return NextResponse.next();
  }
  const accessUrl = new URL("/access", request.url);
  accessUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: ["/((?!access|api/access|_next/static|_next/image|favicon.ico).*)"],
};
