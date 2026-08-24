import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Auth-aware server client (anon key + user cookies).
 * Use for: knowing who is logged in.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore when
            // middleware is refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Admin client (service role) — SERVER ONLY. Bypasses RLS.
 * Use for: reading v_app_tenders / tenders_scraped freshness.
 * GOLDEN RULE: never updates or deletes rows the n8n pipeline owns. It writes
 * only app-owned tables — bid_pipeline, tender_feedback, tender_milestones,
 * tender_actions — plus INSERTs into tenders_scraped gated to
 * platform='manual' (status pre-set to 'analyzed' so the pipeline skips them).
 */
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
