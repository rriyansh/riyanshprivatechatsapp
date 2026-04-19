// Resolves a username to its email so the client can sign in by username.
// Uses the service role key to look up the auth.users email by user_id.
// Public function (no JWT required) — but rate-limited & username-only input.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.username === "string" ? body.username : "";
    const username = raw.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return json({ error: "Invalid username format" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Lookup user_id from username
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();

    if (pErr) return json({ error: "Lookup failed" }, 500);
    if (!profile) return json({ error: "No account with that username" }, 404);

    // 2. Get the auth user's email
    const { data: u, error: uErr } = await admin.auth.admin.getUserById(
      profile.user_id
    );
    if (uErr || !u?.user?.email) {
      return json({ error: "Account has no email on file" }, 404);
    }

    return json({ email: u.user.email }, 200);
  } catch (e) {
    return json({ error: "Server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
