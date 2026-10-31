import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );

  if (pathname === "/login") {
    return user
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protege todo salvo assets estáticos y archivos de la PWA
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js|sw-offline.js|swe-worker|workbox-).*)",
  ],
};
