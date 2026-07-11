// Sends a push notification to the other participant of a job.
// Called by the app after sending a chat message or accepting a job.
// Deploy with: supabase functions deploy push

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
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) {
    return jsonResponse({ error: "Not signed in" }, 401);
  }

  const { jobId, kind, preview } = await req.json();
  if (typeof jobId !== "string" || !["message", "accepted"].includes(kind)) {
    return jsonResponse({ error: "Bad request" }, 400);
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: job } = await admin.from("jobs").select("*").eq("id", jobId).single();
  if (!job) {
    return jsonResponse({ error: "Job not found" }, 404);
  }

  const senderId = userData.user.id;
  const senderName = String(userData.user.user_metadata?.display_name ?? "").trim() || "Someone";

  let recipient: string | null = null;
  let title = "";
  let body = "";
  if (kind === "accepted") {
    if (senderId !== job.accepted_by) {
      return jsonResponse({ error: "Not allowed" }, 403);
    }
    recipient = job.created_by;
    title = "Your job was accepted";
    body = `${senderName} accepted "${job.title}"`;
  } else {
    if (senderId !== job.created_by && senderId !== job.accepted_by) {
      return jsonResponse({ error: "Not allowed" }, 403);
    }
    recipient = senderId === job.created_by ? job.accepted_by : job.created_by;
    title = `${senderName} - ${job.title}`;
    body = String(preview ?? "New message").slice(0, 120);
  }

  if (!recipient || recipient === senderId) {
    return jsonResponse({ sent: 0 });
  }

  const { data: tokens } = await admin.from("push_tokens").select("token").eq("user_id", recipient);
  if (!tokens || tokens.length === 0) {
    return jsonResponse({ sent: 0 });
  }

  const messages = tokens.map((row) => ({
    to: row.token,
    title,
    body,
    sound: "default",
    channelId: "default",
    data: { jobId, kind },
  }));

  const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!expoResponse.ok) {
    console.error("Expo push failed:", await expoResponse.text());
    return jsonResponse({ sent: 0 });
  }

  return jsonResponse({ sent: messages.length });
});
