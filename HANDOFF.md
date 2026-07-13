# Odd Jobs — Handoff & Change Guide

This document is written so that **any developer or AI model can pick up this
project cold and safely make changes** (add features, fix bugs, add payments)
without breaking the app or its security.

Read this file, then `README.md` (setup/publish steps), then `AGENTS.md`
(which insists you read the versioned Expo docs before writing code). This is
Expo SDK 57 / React Native 0.86 / React 19 / TypeScript. Do not assume older
Expo APIs — verify against https://docs.expo.dev/versions/v57.0.0/.

---

## 1. What this app is (in one paragraph)

Odd Jobs is a two-sided local services marketplace for Pakistan. Customers post
small jobs (moving, cleaning, repairs) with a city + area + category + pay.
Workers browse open jobs, accept them, and move them OPEN → ACCEPTED →
IN_PROGRESS → COMPLETED. Posts pass AI moderation before going live. The two
parties of an accepted job can chat. There is no map — location is generic
city/area (OLX-style). **No emojis anywhere in the product** (a hard rule from
the owner). Target release order: Android first, then web, then iOS.

---

## 2. The golden rules (do not violate these)

1. **No emojis** in any user-facing string, ever.
2. **The client (app) never writes to the `jobs` table directly.** All creates
   and edits go through the `create-job` edge function (which moderates first).
   All status changes go through database RPC functions. This is a security
   invariant — see section 6. If you find yourself writing
   `supabase.from('jobs').insert(...)` in app code, stop; you are doing it wrong.
3. **The service-role key lives only in edge functions**, never in the app.
   The app only ever holds the anon/publishable key (safe to ship).
4. **Row Level Security (RLS) stays ON for every table.** New tables must ship
   with policies. Never disable RLS to "make it work."
5. **The app must build clean** before any commit: run `npx tsc --noEmit` and
   `npx expo export --platform web` (both must pass). See section 8.
6. Keep the code readable and lean — the owner explicitly asked that this not
   become "a graveyard of dead code." Delete what you replace; don't leave
   commented-out corpses.

---

## 3. Tech stack & accounts

| Thing | Value / where |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19.2.3, TypeScript |
| Navigation | **None (no expo-router).** State-based in `App.tsx` via a `Screen` union type |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) |
| Supabase project ref | `mjfaswtmnehnljoycghu` |
| AI moderation | Anthropic Claude Haiku (`claude-haiku-4-5`) via the `create-job` function |
| Push | Expo push + Firebase Cloud Messaging (`google-services.json`) |
| Cloud builds | EAS Build (`eas build`), no Mac needed even for iOS |
| Source | GitHub: github.com/mohammadzain956/Odd-Jobs |
| Android package | `com.oddjobs.app` |

**Accounts the owner must keep access to** (losing these is the only real way
to get locked out of updating the app): GitHub, Supabase, Expo (EAS), Google
Play Console, and the Anthropic API account.

---

## 4. Project map

```
App.tsx                Root. State, navigation, header, toast, splash gate.
index.ts               Entry point (registers App).
app.json               Expo config: name, version, package, icons, splash plugin.
eas.json               Build profiles: "preview" = APK, "production" = AAB.
google-services.json   Firebase config for Android push.

src/config.ts          Supabase URL + anon key. remoteEnabled toggles online/offline.
src/supabase.ts        Supabase client (AsyncStorage session persistence).
src/theme.ts           Colors: brand = deep green #1E7A46, action = amber #C25E00.
src/types.ts           Job, JobDraft, AuthUser, ChatMessage, Screen, CATEGORIES...
src/format.ts          Money / date / text formatting helpers.
src/store.ts           THE DATA LAYER. Every backend call lives here. (see section 5)
src/components.tsx      Shared UI: Card, Pill, Btn, Field, ChipRow, CityRow, JobCard...
src/location.ts        detectCity() via expo-location reverse geocode.
src/locations.ts       57 Pakistani cities; curated areas for 11 major ones.
src/push.ts            Push token registration/permission.
src/AnimatedSplash.tsx Opening animation (pin draws a checkmark, then fades).

src/screens/
  HomeScreen.tsx       Customer feed: city/area/category filter + search.
  WorkerScreen.tsx     Worker view of OPEN jobs, filtered by city/area.
  PostScreen.tsx       Create/edit a job. Photo picker. City/area pickers.
  DetailScreen.tsx     One job: photos, status actions, chat button, report picker.
  ProfileScreen.tsx    "My Posts" (edit/delete own OPEN jobs), sign out.
  AuthScreen.tsx       Login / signup.
  ChatScreen.tsx       Realtime 1:1 chat for an accepted job.

supabase/
  schema.sql           Tables (jobs, reports), RLS policies, storage bucket, seed.
  chat.sql             messages, chat_reads, push_tokens + RLS + unread_counts().
  favorites.sql        Saved jobs. Private to each user (own-rows-only policies).
  cancel.sql           cancel_job(): release a stuck ACCEPTED/IN_PROGRESS job.
  reviews.sql          Ratings, submit_review(), profile_stats(). The trust layer.
  security.sql         CRITICAL hardening. Read this before touching permissions.
  functions/create-job Edge function: moderates posts, handles edits, rate limits.
  functions/push       Edge function: sends push to the other job participant.
```

**Where to make a change:** almost every backend behavior is in `src/store.ts`.
UI lives in `src/screens/*` and `src/components.tsx`. Data shapes in
`src/types.ts`. Database rules in `supabase/*.sql`. That's the whole map.

---

## 5. The data layer contract (`src/store.ts`)

Every screen talks to the backend **only** through these exported functions —
never by importing the supabase client directly into a screen. Each function
has a remote (Supabase) path and, where sensible, a local/offline fallback so
the app runs without credentials during development.

Jobs: `loadJobs`, `submitJob(draft)`, `updateJobFields(id, draft)`,
`changeJobStatus(id, next)`, `deleteJob(id)`, `matchesFilters(...)`.
Auth: `getSessionUser`, `signUpUser`, `signInUser`, `signOutUser`.
Chat: `loadMessages`, `sendMessage`, `subscribeToMessages`, `subscribeToInbox`,
`markChatRead`, `loadUnreadCounts`.
Push: `savePushToken`, `removeCurrentPushToken`.
Reports: `reportJob(id, reason)` → `{ ok, message }`.

**Rule for new backend features:** add a function here, keep the same
remote/local shape, and have screens call it. Do not scatter `supabase.from(...)`
calls across screens.

---

## 6. Security model (understand before changing permissions)

The app was pentested; these controls are the reason hijacking/theft/chat-leak
are blocked. Preserve them.

- **`jobs` table:** clients have NO direct insert/update. `REVOKE UPDATE` is in
  `security.sql`. Creating/editing → `create-job` function (service role, after
  moderation, after verifying ownership + that the job is still OPEN).
- **Status transitions:** `accept_job(uuid)`, `start_job(uuid)`,
  `complete_job(uuid)`, `cancel_job(uuid)` are `SECURITY DEFINER` Postgres
  functions that check the caller and that the transition is legal.
  `changeJobStatus` calls these. `cancel_job` also deletes the job's messages,
  because chat is readable by whoever is currently `accepted_by` - leaving the
  thread behind would let the next worker read the previous one's conversation.
- **Reviews:** written only through `submit_review(job, rating, comment)`. The
  client never sends who is being rated; the server derives it from the job, so a
  review cannot be forged against someone you never worked with. Reviews are
  publicly readable on purpose (a hidden rating is not a trust signal) and cannot
  be edited or deleted by the person who received them.
- **Deletes:** a policy allows deleting only your own job while it is still OPEN.
- **Chat:** `messages` are readable/writable only by the job's poster and its
  accepted worker, enforced in RLS. A third party cannot read, inject, or forge.
- **Photos:** storage bucket capped at 5 MB, image-only, each user restricted to
  their own upload folder (`<user_id>/...`).
- **Abuse limits:** 10 posts/user/hour (in the function), one report/user/post
  (unique index), message length capped.

If a new feature needs a new privileged action, follow the same pattern: do it
in an edge function (with the service-role key) or a `SECURITY DEFINER` RPC that
validates the caller — never by loosening RLS or granting the client table writes.

---

## 7. Online vs offline mode

`src/config.ts` exports `remoteEnabled` (true when the Supabase URL + anon key
are set). When true, the app is fully online (shared posts, accounts, photos,
chat, moderation). When the values are blank, the app falls back to on-device
storage — useful for pure UI work without a backend. Keep both paths working
when you edit `store.ts`; don't break offline mode.

---

## 8. How to make a change safely (the loop)

From `OddJobsExpo/` (note: this folder, not the parent `odd jobs/`):

```bash
npm install                       # first time only
npm start                         # dev server; press w for web, or use Expo Go
# ...edit code...
npx tsc --noEmit                  # MUST pass (type check)
npx expo export --platform web    # MUST pass (catches runtime/import errors)
```

Then commit and push. `supabase/` is excluded from the app's tsconfig, so the
Deno edge functions won't fail the app's type check.

**Deploying backend changes:**
- SQL changes: paste into the Supabase dashboard SQL Editor and run.
- Edge function changes: `supabase functions deploy create-job` (or `push`).
- Config secrets: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`.

**Shipping an app update to users:**
1. Bump `version` (and let EAS auto-increment `versionCode`) — see `app.json` / `eas.json`.
2. `eas build --platform android` → produces an `.aab`.
3. Upload the `.aab` in the Play Console as a new release.
   (Use `--profile preview` for a directly-installable `.apk` to test first.)

---

## 9. Worked example: adding a payment feature (the owner's likely next ask)

The intended monetization ladder is: **featured listings → worker subscription →
in-app payments/commission.** Start with featured listings (lowest risk, hooks
already scaffolded). Local rails for Pakistan are JazzCash / Easypaisa. Do NOT
build in-app payments before the marketplace has liquidity in at least one city.

**Do it the app's way — a minimal, secure slice:**

1. **Data:** add a boolean/timestamp to jobs, e.g. `featured_until timestamptz`.
   Add it in a new `supabase/payments.sql` with an index; keep RLS intact.
2. **Never let the client set `featured_until` directly** (same rule as everything
   else). Create a `SECURITY DEFINER` RPC or an edge function that marks a job
   featured **only after** a verified payment webhook confirms the transaction.
   The payment provider (JazzCash/Easypaisa) calls a Supabase edge function
   webhook; that function (service role) validates the signature and flips the flag.
3. **App:** add a `store.ts` function like `featureJob(id)` that starts the
   payment flow and, on success, reloads. Surface a "Featured" badge in
   `JobCard` (in `components.tsx`) and sort featured jobs first in `loadJobs`.
4. **UI:** a "Boost this post" button on `DetailScreen`/`ProfileScreen` for the
   owner of an OPEN job. No emojis. Use `theme.ts` colors.
5. **Verify:** `tsc` + web export pass; confirm a client cannot set the flag
   without the webhook (the whole point).

This mirrors how moderation and status changes already work: **the client asks,
a trusted server-side function decides.** Follow that shape for anything
involving money or trust and the security model stays intact.

---

## 10. Common gotchas

- Run npm/expo commands from `OddJobsExpo/`, not the parent `odd jobs/` folder.
- `StyleSheet.absoluteFillObject` typed oddly here; inline `position:'absolute'`
  + `top/bottom/left/right: 0` instead (see `AnimatedSplash.tsx`).
- Edge functions need CORS headers + an `OPTIONS` handler or browser/web calls
  fail preflight (returns "could not reach the server"). Both functions have them.
- Multi-statement SQL via the management API can 400; run statements individually
  or paste into the dashboard SQL Editor.
- Before public launch: re-enable "Confirm email" in Supabase Auth, ensure
  `ANTHROPIC_API_KEY` is set so moderation is live, and rotate any access tokens
  that were used for one-off deployments.

---

## 11. What's intentionally not built yet

An in-app admin panel (admin work is done in the Supabase dashboard today),
account deletion + a privacy policy (both are hard Google Play requirements for
an app with accounts — do these before submitting), job expiry for stale OPEN
posts, and payments/escrow. These are future features, not missing pieces — add
them following section 8 and 9.

Do not re-add a "Verified worker" badge that is not backed by real data. One
used to be hardcoded on the worker board and shown to every user, which claimed a
verification the app does not perform. It now reflects the real completed-job
count from `profile_stats`.

Note on `featured`: the column, the "Featured" badge, and the home feed's
"Featured nearby" section all exist, but **nothing in the app can set the flag**.
It is reserved for paid placement — only an admin or a future verified payment
webhook may set it. Do not add a client-facing control that turns it on; that was
tried, and it let anyone boost their own post for free.
