// Creates a job post after running AI moderation on it.
// Deploy with: supabase functions deploy create-job
// Requires secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODERATION_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["approve", "review", "reject"] },
    reason: { type: "string" },
  },
  required: ["verdict", "reason"],
  additionalProperties: false,
} as const;

const MODERATION_PROMPT = `You are the content moderator for "Odd Jobs", a services marketplace in Pakistan where customers post small work requests (moving furniture, cleaning, repairs, yard work, delivery, assembly, tutoring, general help) and workers accept them.

Review the job post below and return a verdict:
- "approve": a legitimate request for a small service or task.
- "reject": clearly not allowed. This includes: selling goods or animals of any kind (this is a services marketplace, not a store), anything illegal (drugs, weapons, stolen goods, fraud, forged documents), adult or sexual services, gambling, requests to harm people or property, hate or harassment, recruiting for scams or pyramid schemes, requests for advance payments or fees from workers, and anything involving minors in unsafe work.
- "review": suspicious or ambiguous, but not clearly a violation. A human moderator will decide.

Keep the reason to one short sentence, written for the person who posted it.

Job post:
Title: {title}
Category: {category}
Location: {location}
Pay: Rs {pay}
Details: {details}`;

const CATEGORIES = ["Moving", "Cleaning", "Repairs", "Yard work", "Delivery", "Assembly", "Tutoring", "General help"];
const URGENCIES = ["Today", "This week", "Flexible"];

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

  // Identify the caller from their JWT.
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) {
    return jsonResponse({ error: "Not signed in" }, 401);
  }

  const draft = await req.json();
  const jobId = typeof draft.jobId === "string" && draft.jobId ? draft.jobId : null;
  const title = String(draft.title ?? "").trim().slice(0, 120);
  const details = String(draft.details ?? "").trim().slice(0, 2000);
  const location = String(draft.location ?? "").trim().slice(0, 120);
  const city = String(draft.city ?? "").trim().slice(0, 40);
  const pay = Number(draft.pay);
  const category = CATEGORIES.includes(draft.category) ? draft.category : "General help";
  const urgency = URGENCIES.includes(draft.urgency) ? draft.urgency : "Flexible";
  const accountName = String(userData.user.user_metadata?.display_name ?? "").trim();
  const requesterName = (accountName || String(draft.requesterName ?? "Customer").trim()).slice(0, 60) || "Customer";
  const photos = Array.isArray(draft.photos) ? draft.photos.slice(0, 5).map(String) : [];
  // `featured` is a paid placement and is never taken from the request body. New
  // posts default to false in the database; edits leave the column untouched. Only
  // a verified payment (or an admin) may set it.

  if (!title || !details || !location || !Number.isFinite(pay) || pay <= 0 || pay > 10_000_000) {
    return jsonResponse({ error: "Missing or invalid fields" }, 400);
  }

  const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Edits must belong to the caller and only apply before work starts. Edited
  // posts are re-moderated below - otherwise a clean post could be approved and
  // then rewritten into something that would never have passed.
  let existing: { created_by: string; status: string; photos: string[] } | null = null;
  if (jobId) {
    const { data } = await adminClient
      .from("jobs")
      .select("created_by, status, photos")
      .eq("id", jobId)
      .single();
    if (!data || data.created_by !== userData.user.id || data.status !== "OPEN") {
      return jsonResponse({ error: "You cannot edit this post" }, 403);
    }
    existing = data;
  }

  // Rate limit: caps spam and the moderation spend it would trigger.
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await adminClient
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userData.user.id)
    .gte("created_at", windowStart);
  if (!jobId && (count ?? 0) >= 10) {
    return jsonResponse({
      verdict: "rejected",
      reason: "You have posted a lot in the last hour. Please try again later.",
    });
  }

  // AI moderation. If no API key is configured yet, posts go live unmoderated
  // (fine for private testing; add the key before opening to the public).
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  let verdict = anthropicKey ? "review" : "approve";
  let reason = "Automatic moderation was unavailable, so the post is held for human review.";
  if (!anthropicKey) {
    console.warn("ANTHROPIC_API_KEY not set; skipping moderation.");
  }
  const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
  try {
    if (!anthropic) {
      throw new Error("moderation disabled");
    }
    const prompt = MODERATION_PROMPT
      .replace("{title}", title)
      .replace("{category}", category)
      .replace("{location}", `${location}, ${city}`)
      .replace("{pay}", String(pay))
      .replace("{details}", details);
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      output_config: { format: { type: "json_schema", schema: MODERATION_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content.find((block) => block.type === "text");
    if (text && text.type === "text") {
      const parsed = JSON.parse(text.text);
      verdict = parsed.verdict;
      reason = parsed.reason;
    }
  } catch (error) {
    console.error("Moderation call failed; holding post for review:", error);
  }

  if (verdict === "reject") {
    return jsonResponse({ verdict: "rejected", reason });
  }

  const row = {
    title,
    details,
    location,
    city,
    pay,
    category,
    urgency,
    requester_name: requesterName,
    moderation_status: verdict === "approve" ? "approved" : "pending",
    moderation_reason: verdict === "approve" ? null : reason,
  };

  // Written with the service role: clients cannot insert or update jobs directly,
  // so every post and edit is forced through the moderation path above.
  const query = jobId
    ? adminClient.from("jobs").update({ ...row, photos: existing!.photos }).eq("id", jobId)
    : adminClient.from("jobs").insert({ ...row, photos, created_by: userData.user.id });

  const { data: job, error } = await query.select().single();

  if (error) {
    console.error("Save failed:", error);
    return jsonResponse({ error: "Could not save the post" }, 500);
  }

  return jsonResponse({ verdict: verdict === "approve" ? "approved" : "pending", reason, job });
});
