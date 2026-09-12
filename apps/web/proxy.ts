import { NextResponse, type NextRequest } from "next/server";

const realm = "DevBoard";

export function proxy(request: NextRequest) {
  if (process.env.DEVBOARD_BROWSER_TEST === "1") return NextResponse.next();

  const password = process.env.APP_ACCESS_PASSWORD;
  if (!password) {
    return new NextResponse("APP_ACCESS_PASSWORD must be configured.", {
      status: 503,
    });
  }

  const expected = `Basic ${btoa(`devboard:${password}`)}`;
  if (request.headers.get("authorization") === expected) {
    return NextResponse.next();
  }

  return new NextResponse("Password required.", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}"` },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
