# Odd Jobs

A two-sided local work marketplace built with Expo (React Native + TypeScript).
One codebase runs on Android, web, and iOS.

- Customers post small job requests with location, details, urgency, and pay.
- Workers browse open requests, accept jobs, and move them through in-progress to completed.
- With the backend connected, posts are shared between all users, every new post
  passes AI moderation before going live, and users can report bad posts.
- Without backend credentials the app runs in offline mode (jobs stored on the device),
  which is handy for development.

## Run in development

```
npm install
npm start
```

Then:

- **Android phone** - install the Expo Go app, scan the QR code from the terminal.
- **Web** - press `w` in the terminal (or `npm run web`).
- **iOS phone** - install Expo Go from the App Store, scan the QR code.

## Project layout

```
App.tsx                  Root: state, navigation, header, toast
src/config.ts            Supabase credentials (empty = offline mode)
src/supabase.ts          Supabase client and anonymous sign-in
src/theme.ts             Color palette (deep green + amber)
src/types.ts             Job model, screen names, category lists
src/format.ts            Money, date, and text formatting
src/store.ts             Data layer: remote (Supabase) or local (device) storage
src/components.tsx       Shared UI: Card, Pill, Btn, Field, ChipRow, JobCard, ...
src/screens/             One file per screen: Home, Post, Worker, Detail
supabase/schema.sql      Database tables, security policies, sample jobs
supabase/functions/      create-job edge function (AI moderation with Claude)
```

## Going online (Supabase setup, ~20 minutes)

1. Create a free account at supabase.com and create a new project.
2. In the dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
3. Under **Authentication > Sign In / Providers**, make sure **Email** is enabled.
   For easier testing, turn off **Confirm email** (turn it back on before public launch).
4. Install the Supabase CLI (`npm install -g supabase`), then from this folder:
   ```
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy create-job
   ```
5. Copy the **Project URL** and **anon public key** from
   **Project Settings > API** into `src/config.ts`.
6. Restart the app. Accounts, shared posts, photos, and reports now work.
7. Optional (recommended before public launch) - enable AI moderation:
   get an API key at platform.claude.com, then run
   `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`.
   Without the key, new posts go live unmoderated.

### How moderation works

Every new post goes through the `create-job` function, which asks Claude
(the small, fast Haiku model - a fraction of a cent per post) for a verdict:

- **approve** - post goes live immediately.
- **review** - post is held; only the poster sees it, marked "In review".
  Approve or delete it in the Supabase dashboard (jobs table,
  set `moderation_status` to `approved` or delete the row).
- **reject** - post is refused and the poster sees the reason.

Reports from the app land in the `reports` table for the same manual review.

## Publish to the Play Store

1. Pay the one-time $25 fee at play.google.com/console and create the app entry.
2. Create a free Expo account at expo.dev, then:
   ```
   npm install -g eas-cli
   eas login
   eas build --platform android
   ```
   The build runs in Expo's cloud and produces an `.aab` file for the Play Store.
   (Use `eas build --platform android --profile preview` to get a directly
   installable `.apk` for testing instead.)
3. Upload the `.aab` in the Play Console and fill the store listing
   (description, screenshots, a privacy policy URL - required).
4. New personal accounts must run a closed test with 12 testers for 14 days
   before going public; invite friends and family.

## Release path after Android

- **Web** - `npx expo export --platform web` outputs a static site in `dist/`
  that can be hosted anywhere (Netlify, Vercel, GitHub Pages).
- **iOS** - `eas build --platform ios` (requires an Apple Developer account, $99/year).
  EAS builds iOS apps in the cloud, so no Mac is needed.

## Next product steps

- Real user accounts (email or Google sign-in) replacing anonymous sessions.
- Worker profiles, ratings, in-app chat, and push notifications.
- An admin screen for reviewing held posts and reports (currently done in the Supabase dashboard).
- Payments or escrow once the request flow is validated.
