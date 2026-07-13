// Deletes the caller's account and their personal data.
// Google Play requires any app with accounts to offer in-app account deletion.
// Deploy with: supabase functions deploy delete-account
//
// The client cannot do this itself: removing a row from auth.users needs the
// service role. This function verifies the caller from their JWT and then only
// ever deletes THAT user - the id is never taken from the request body.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Identify the caller from their token. This is the only id we act on.
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) {
    return jsonResponse({ error: "Not signed in" }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // 1. Their own posts that nobody has taken yet: delete outright.
    await admin.from("jobs").delete().eq("created_by", userId).eq("status", "OPEN");

    // 2. Jobs still tied to another person (accepted, in progress, completed):
    //    detach rather than delete, so the OTHER party keeps their own history.
    //    Their name is replaced everywhere it was shown.
    await admin
      .from("jobs")
      .update({ created_by: null, requester_name: "Deleted user" })
      .eq("created_by", userId);
    await admin
      .from("jobs")
      .update({ accepted_by: null, worker_name: "Deleted user" })
      .eq("accepted_by", userId);

    // 3. Their messages, read markers, devices, and reports.
    await admin.from("messages").delete().eq("sender_id", userId);
    await admin.from("chat_reads").delete().eq("user_id", userId);
    await admin.from("push_tokens").delete().eq("user_id", userId);
    await admin.from("reports").update({ created_by: null }).eq("created_by", userId);

    // 4. Their uploaded photos.
    const { data: files } = await admin.storage.from("job-photos").list(userId);
    if (files && files.length > 0) {
      await admin.storage.from("job-photos").remove(files.map((file) => `${userId}/${file.name}`));
    }

    // 5. The account itself. Favorites and reviews are removed by the cascade on
    //    their foreign keys to auth.users.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Account deletion failed:", error);
      return jsonResponse({ error: "Could not delete the account" }, 500);
    }
  } catch (error) {
    console.error("Account deletion failed:", error);
    return jsonResponse({ error: "Could not delete the account" }, 500);
  }

  return jsonResponse({ ok: true });
});
