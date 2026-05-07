import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const PROTECTED_PREFIXES = ["/editor", "/signup"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isLoginPage = pathname === "/";

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (isLoginPage && session) {
    return NextResponse.redirect(new URL("/editor", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
