# TrailKit

An offline trail companion, built for the DEV Hacktoberfest challenge *Touch Grass*.

Record a trek with no signal, check whether the plant, insect or snake in front of you is safe, save the views along the way, and share the route with other hikers once you're home.

## What it does

- **Treks:** plan one (a route, a day, a checklist) or just head out. GPS records the route with the screen off. Distance, time, climb and pace update live.
- **Before you start:** a full-screen checklist to tick off, then a 3·2·1 start.
- **Off-route alerts:** follow a planned route and the phone buzzes when you stray more than 60 m from it, and again when you're back on it.
- **Is it safe?** Point the camera at a plant, insect or snake. BioCLIP names it on the phone; a safety layer decides the danger level; Gemma writes short field notes. Snakes and spiders always get a distance rule, first steps if bitten and a call button for your emergency number. TrailKit never says a wild plant is safe to eat.
- **Views:** save a photo of the scenery; it's pinned on the route as a star.
- **Journal:** every trek gets a map, its totals and a timeline of what you found, in order.
- **Account:** sign up with email and password during onboarding (forgot password emails a link that opens the app), and add a profile photo that shows on your posts.
- **Community:** treks are private until you post one. A post shares the route, totals and the names of what you found, never trek photos. Sort and filter by distance from you, length, time and climb; copy any route into your own plan.
- **Maps:** real map tiles, and a button to download the area around a route before you go.

## Privacy

| Stays on the phone | Leaves the phone |
|---|---|
| Trek photos, emergency number and contact | Your account: email and password (Supabase Auth) |
| Every trek you haven't posted | Your profile photo, if you add one |
| Both AI models and everything they see | A trek you post: its route, totals, species names and your profile name |

Delete account (Profile) removes everything from the phone and takes down every post.

## Run it

Expo dev build, Android and iOS.

```bash
npm install
npx expo run:android      # or: npx expo run:ios
npx expo start --dev-client
npm test
```

- **Models** (not in the repo): `bioclip_vision.onnx` (346 MB) and `gemma-4-e2b.gguf` (2.6 GB) go in the app's documents folder. On Android, push them with `adb` (see [SPIKE.md](SPIKE.md)); on iOS, drag them into the app in Finder (File Sharing is enabled). Without them the app still runs; identification is unavailable.
- **Accounts and Community** need a Supabase project. Run [`supabase/schema.sql`](supabase/schema.sql), turn off **Confirm email** (Sign In / Providers → Email), add `trailkit://reset-password` to **Redirect URLs** (URL Configuration) so the reset email opens the app, and put `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` (the publishable key) in `.env.local`. Without them, onboarding skips the account step and Community shows the sample posts.

## How it's built

- Expo SDK 57, React Native 0.86, TypeScript strict.
- **BioCLIP** (vision encoder, ONNX) through `onnxruntime-react-native` picks the species from a list of labels.
- **Gemma 4 E2B** (4-bit QAT GGUF) through [`llama.rn`](https://github.com/mybigday/llama.rn) writes the field notes. It only explains what BioCLIP picked; danger levels come from the label data, never from Gemma.
- **Maps:** MapLibre with free, keyless [OpenFreeMap](https://openfreemap.org) tiles. **GPS:** `expo-location` as a foreground service (needs only "while using the app").
- **Community and accounts:** Supabase (Postgres with row-level security, email auth, Storage for profile photos). No custom server.
- Plain code does all the maths (distance, climb, pace, GPS clean-up, off-route detection). 61 tests.

| Where | What |
|---|---|
| `src/track.ts` | track maths: distance, climb, GPS clean-up, bounds, off-route |
| `src/tracking.ts` | background GPS task and off-route alerts |
| `src/safety.ts` | danger levels, "uncertain" handling, snake/spider first aid |
| `src/bioclip.ts`, `src/gemma.ts`, `src/card.ts` | on-device identification and field notes |
| `src/treks.ts`, `src/store.ts` | trek data, saved as files with atomic writes |
| `src/community.ts`, `src/posts.ts` | Community filters, posting, delete account |
| `src/trailmap.tsx`, `src/offlineMaps.ts` | map and offline download |

## How it was made

Planned and reviewed with Claude Code, built with Antigravity for the first tasks and Claude Code after. Every decision, bug and test result is logged in [REVIEW.md](REVIEW.md). The product spec is [IDEA.md](IDEA.md).
