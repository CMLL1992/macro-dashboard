import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = ["/", "/api/indicators", "/api/score/latest"];

// Rutas que requieren suscripción activa
const SUBSCRIPTION_REQUIRED_ROUTES = [
  "/strategy",
  "/api/assets/bias",
  "/api/releases/upcoming",
  "/api/ingest",
];

// Estados de suscripción válidos
const VALID_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Permitir rutas públicas
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Verificar autenticación
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // Redirigir a login si no está autenticado
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/api/auth/signin", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verificar suscripción para rutas protegidas
  if (SUBSCRIPTION_REQUIRED_ROUTES.some((route) => pathname.startsWith(route))) {
    const subscriptionStatus = token.subscriptionStatus as string | undefined;

    if (!subscriptionStatus || !VALID_SUBSCRIPTION_STATUSES.includes(subscriptionStatus)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Subscription required", status: subscriptionStatus },
          { status: 403 }
        );
      }
      // Redirigir a página de suscripción
      return NextResponse.redirect(new URL("/settings/billing", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

