# PLAN.md

> **Status (Oct 3):** tasks 1–11 implemented. The UI was redesigned per the user: an app-style dashboard with stats and a streak grid, one problem at a time, and a full-screen tree with a Gemma chat instead of an in-app problem view (he solves on his PC). Task 11 adds module caching, pull-to-refresh, dynamic problem queues, and local session sync on return from focus. See AGENTS.md › UI. Remaining: verify on Rajeev's phone, and push a `v*` tag to test the release workflow.

Use one session per task, done in order. Every session starts by reading [AGENTS.md](AGENTS.md) and [IDEA.md](IDEA.md). Only do the task you were given. Stop when its "done when" checks pass, and don't commit.

---

### 1. Scaffold

Create an Expo TypeScript app (Android, dev build) in the repo root. Load JetBrains Mono, add theme tokens (`src/theme.ts`: dark only, one accent), one screen that renders `cf-buddy`, and set up `jest-expo`.
**Done when:** `npx expo run:android` shows `cf-buddy` in JetBrains Mono, and `npx jest` passes.

### 2. Codeforces client — `src/cf.ts`

A single client that waits at least 2s between requests. Typed functions for `user.info`, `user.rating`, `user.status`, `problemset.problems` (cached 24h in AsyncStorage) and `contest.list`. Throw a typed error when the response isn't `status: "OK"`.
**Done when:** a test with fake timers shows that consecutive requests are spaced at least 2s apart.

### 3. Plan logic — `src/plan.ts` (pure, no I/O)

- `dailyTarget(date, busyBlocks, contests, targets)`: `targets` comes in as a parameter (defaults: 4 problems / 150 min on weekdays, 6 / 240 min on weekends, editable in Settings later), scaled down by busy time. Contest day = 2 warm-ups.
- `candidates(problems, solvedIds, rating, tag)`: rating in `[rating+100, rating+300]`, matching the tag, unsolved.
- `upsolve(contestId, problems, solvedIds)`: problems from yesterday's contest that aren't solved yet.
  **Done when:** tests cover a weekday, a weekend, a busy day, a contest day, and the candidate filter.

### 4. Calendar — `src/calendar.ts`

Ask for read permission, read today's events from all calendars, and immediately map them to `{ start, end }`. Titles and other fields never leave this function. Merge overlapping blocks.
**Done when:** a test for the merge passes, and no event field other than start/end is referenced after the mapping.

### 5. Settings — `src/settings.ts` + settings screen
Persist in AsyncStorage: CF handle, goal rating (default 1800), goal date (default Dec 31), accent color (pick from ~6 presets), and weekday/weekend targets (default 4/150m and 6/240m). The theme reads the accent from here. Task 3's `dailyTarget` takes the targets as parameters. First launch with no handle opens Settings.
**Done when:** the values survive an app restart, and changing the accent recolors the app.

### 6. Today screen

Title: `codeforces buddy`. Progress line from settings + live CF rating: `1097 → 1800 · 703 to go · 90d`. Below it, today's plan from tasks 2–4: a list of problems showing rating, tag, id and name. Pick deterministically for now (no Gemma). Show a one-line error state if CF is unreachable.
**Done when:** the screen shows a real plan for the handle in Settings on a device.

### 7. Focus session

~~WebView + ASCII tree~~ → superseded: a full-screen drawn tree (`src/Tree.tsx`) with a Gemma chat; he solves on his PC. If `AppState` stays in the background for more than 10s, the tree dies. Poll `user.status?count=5` every 60s, and an `OK` on this problem completes the session. Save sessions (problem, outcome, minutes) in AsyncStorage and show `forest: N🌲 M🪦` in the header.
**Done when:** on a device, backgrounding the app for 11s kills the tree, and an accepted submission completes it.

### 8. On-device Gemma — `src/gemma.ts`, `src/prompts.ts`

Set up `llama.rn`. On first launch, download a small Gemma GGUF with a progress line. (Model: ask the user which file. Default candidate: the smallest Gemma 4 instruct GGUF, Q4_K_M.) Expose three functions:

- `choosePlan(options)` → `{ ids, line }`
- `roast(event)` → `string`
- `hint(statement)` → `string`

Validate the output. If the model isn't loaded or returns something invalid, fall back to the deterministic pick and canned lines. Prototype the prompts against Ollama `gemma4:12b` on the Mac first.
**Done when:** each function returns valid output on the device, and the fallback works with the model removed.

### 9. Wire Gemma into the UI

- Today screen: Gemma picks the plan from the task 3 candidates and adds its one-line comment.
- Focus screen: ~~hint button + WebView statement~~ → superseded by the Gemma chat (Codeforces blocks statement fetches).
- On return after a dead tree, show a roast.

**Done when:** you can demo the whole loop on a device: open → plan → focus → hint → leave → roast → solve.

### 10. Release APK

Add a GitHub Actions workflow that runs on a `v*` tag: `expo prebuild` → `gradlew assembleRelease` → attach the APK to a GitHub Release.
**Done when:** pushing a test tag produces a Release with an APK that installs.

### 11. Load once, pull to refresh (Rajeev's feedback)

He finds the app refreshes too much. Today currently reloads on every tab switch and every return from focus (the screens unmount), and on every `AppState` → `active`. History refetches on every tab switch.

- **Today and History load once per app open, then show cached data.** Keep the last result in a module-level variable in each screen file (no new store or library) and use it as the initial state. Only fetch when there's no cache, or when `settings` changed (compare the object reference; it only changes on save).
- **Remove the `AppState` refresh** in `TodayScreen`.
- **Pull to refresh** on both screens. History gets the same `RefreshControl` as Today.
- **Questions refresh on pull, with no fixed daily set.** Drop the `PLAN_KEY` per-day plan in AsyncStorage. Each load (first open or pull) builds a fresh queue: upsolves first, then Gemma's pick (or `pickDeterministic`) from the shortlist. Skip moves through it, and it doesn't end at the target. The daily target stays a goal number: the card header reads `PROBLEM {done+1}` (no `OF N`), the `solved today` stat stays `done / target` using `data.today.problems`, and "all N done, go touch grass" goes away.
- **Returning from a grown focus session must not show the problem just solved.** On mount, re-read `loadSessions()` (local, no network) and treat `grown` sessions' problem ids as solved. This also keeps the tree counts current.
- **The Gemma card waits for the data.** Move the "download gemma" and "needs 6 GB" cards inside the `data &&` block, after the stats card, so nothing about Gemma shows while the page is loading. The `getGemma` success path refreshes once (the queue can now use Gemma). It no longer needs `removeItem(PLAN_KEY)`.

**Done when:** on a device, switching tabs and returning from focus make no Codeforces requests; pulling on Today shows a new problem queue; pulling on History refetches; the loading screen shows only the logo; `npx tsc --noEmit` and `npx jest` pass.
