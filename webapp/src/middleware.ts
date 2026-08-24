import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { USER_EMAIL_HEADER } from "@/lib/auth-header";

// Gate the entire app: only /login and /auth/* are public.
export async function middleware(request: NextRequest) {
  // Identity header is set from the VERIFIED user below. Delete any inbound
  // copy first so a client can never inject one.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(USER_EMAIL_HEADER);

  // Supabase may rotate the session during getUser(); collect the cookies it
  // wants to write and replay them onto whichever response we end up returning
  // (including redirects, so a refreshed token is never dropped).
  const pendingCookies: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  // IMPORTANT: getUser() validates the JWT with Supabase — do not trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  function withCookies<T extends NextResponse>(response: T): T {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    return response;
  }

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");

  // Belt-and-suspenders: even a valid Supabase user must be on the allowlist.
  // Set ALLOWED_EMAILS in env (comma-separated). Empty/unset = allow any authed user.
  const allow = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const emailAllowed =
    allow.length === 0 || (user?.email && allow.includes(user.email.toLowerCase()));

  if (user && !emailAllowed && !isPublic) {
    // Authenticated but not authorized — sign out and bounce to login.
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("denied", "1");
    return withCookies(NextResponse.redirect(url));
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return withCookies(NextResponse.redirect(url));
  }
  if (user && path.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return withCookies(NextResponse.redirect(url));
  }

  // Hand the verified identity to the server components so the app layout
  // doesn't have to re-validate the same JWT over the network.
  if (user?.email) requestHeaders.set(USER_EMAIL_HEADER, user.email);

  return withCookies(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  // _vercel excluded per Vercel docs so Web Analytics endpoints bypass the auth gate.
  matcher: ["/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
