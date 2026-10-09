# TASK.md

Read [AGENTS.md](../AGENTS.md) (UI section), [IDEA.md](IDEA.md) "App structure" and "Gear check flow", and the "Task 05" section of [REVIEW.md](REVIEW.md) first. Work only inside `WEEK 1/`. Do this task only, stop when the "done when" checks pass, and don't commit.

---

### 06b. Review fixes

> **Done Oct 8 by Claude Code** together with the redesign and task 07 (see REVIEW.md, "Redesign + Task 07"). Don't redo it.

Fix items 1–7 and the four nits under "Task 06" in [REVIEW.md](REVIEW.md), exactly as written there. Cite each item's number in your summary.

**Done when:**

- `npx jest` and `npx tsc --noEmit` pass.
- Re-take `home_light.png`, `home_dark.png` and `trek_light.png` with the dev tools button hidden. The home feed must show a trek with duplicate sightings, deduplicated.
- Record `screenshots/onboard_wait.mp4` (`adb shell pm clear com.trailkit.app`, then go to step 3 and wait for the button).

Same rules as task 06 below: no new dependencies, no placeholders, and bad news goes first.

---

### 06. Onboarding, trek home, animations, navbar

> **Closed Oct 8.** Accepted with fixes, see 06b.

**Why:** Trailkit is a hiking app, but the home screen is still a single camera button. Hikers should get onboarding once, then a home screen built around treks: plan one, start one now, or scroll past ones like a feed. Field ID moves **inside** an active trek. GPS is **not** in this task (that's task 07), so treks have time and sightings but no distance or map yet.

**Build**

1. **Data (`src/treks.ts`, pure, no React or file access).** These types, exactly. `DangerLevel` is the one from `src/ui.tsx`, which includes `uncertain`; use a type-only import.

   ```ts
   export type Experience = 'new' | 'regular' | 'seasoned';
   export type Profile = {
     name: string;
     experience: Experience;
     emergencyNumber: string;
     contact: { name: string; phone: string } | null;
   };
   export type Sighting = {
     photoUri: string;
     label: string;
     danger: DangerLevel;
     takenAt: number;
   };
   export type GearItem = { name: string; packed: boolean };
   export type Trek = {
     id: string;
     title: string;
     status: 'planned' | 'active' | 'done';
     plannedFor: string | null; // YYYY-MM-DD
     startedAt: number | null;
     endedAt: number | null;
     gear: GearItem[];
     sightings: Sighting[];
     sample: boolean;
   };
   export type AppState = { profile: Profile | null; treks: Trek[] };
   ```

   Pure functions, each with one focused test in `__tests__/treks.test.ts`:
   - `GEAR_CHECKLIST`: the 10 items from IDEA.md in that order: Water, Fire starter, Light, First aid, Navigation, Shelter, Food, Tools, Sun protection, Insulation.
   - `planTrek(title, plannedFor, gear, now)` returns a `planned` trek. The id is `String(now)`.
   - `startTrek(state, trekId | null, now)`: with an id, it turns that planned trek `active`. With `null`, it creates an impromptu trek titled `Trek on 8 Oct` (day + short month), with no gear. **At most one active trek:** if one is already active, return the state unchanged.
   - `endTrek(state, now)`: the active trek becomes `done` with `endedAt`.
   - `addSighting(state, sighting)`: appends it to the active trek and does nothing if there is none.
   - `feed(treks)`: active first, then planned by `plannedFor` ascending, then done by `endedAt` descending (samples included).
   - `duration(startedAt, endedAt)`: `"45 min"`, `"2 h 10 min"`.
   - `nextDays(now, 7)`: `[{ iso: '2026-10-08', label: 'Today' }, { …, label: 'Tomorrow' }, { …, label: 'Sat 10' }, …]`.
   - `isValidPhone(s)`: 2–15 digits, with an optional leading `+` and spaces allowed.
   - `parseState(json: string, fallbackTreks: Trek[]): AppState`: invalid or missing JSON returns `{ profile: null, treks: fallbackTreks }`, and so does a wrong shape. **It never throws.** `store.ts` passes `SAMPLE_TREKS`. It's a parameter so that `treks.ts` and `samples.ts` don't import each other.

2. **Storage (`src/store.ts`, thin).** `loadState()` and `saveState(state)` read and write `Paths.document/trailkit.json` with `expo-file-system` (already installed). **No new dependency.** No SQLite yet; task 07 decides that when track points arrive. `App.tsx` owns the state and saves on every change. If loading fails, show the one-line error and fall through to onboarding.

3. **Sample treks (`src/samples.ts`).** Export `SAMPLE_TREKS`: 3 `done` treks with `sample: true`, ended 2, 9 and 20 days before Oct 8, 2026:
   - "Western Ghats ridge walk", 4 sightings
   - "Lakeside evening loop", 2 sightings
   - "Monsoon forest trail", 5 sightings

   Use only labels that exist in `assets/bioclip_labels.json`, with each label's real danger level from that data. `photoUri` is `''`. Every sample card shows a "Sample" pill. Write no distances or places; we have no GPS data.

4. **Onboarding (`src/screens/OnboardingScreen.tsx`).** It shows when `profile === null`, with no navbar. There are three steps, a "Back" text button from step 2 on, and a step dots row (3 dots, the active one `accent`).
   1. **Welcome:** the Trailkit compass mark, "Your offline trail companion", one line about identifying what you find and recording your treks with no signal, and a "Get started" button.
   2. **About you:**
      - Name (required, 1–30 chars).
      - Experience as three choice pills ("Beginner", "Intermediate", "Seasoned"), defaulting to "Intermediate".
      - Emergency number, prefilled `112` and validated with `isValidPhone`.
      - Emergency contact, optional: a name and a phone, both or neither, with the phone validated.
      - Inline errors under the field in `dangerous` colour **with** text. "Continue" is disabled until the form is valid.
   3. **Before you go:** the "Good to know" card (move it out of the home screen as-is), then the Safety and Privacy cards from Settings (same copy, with `112` replaced by the user's number).
      - The "I understand, let's go" button is **not rendered** for the first 5 s after this step mounts, then fades in over 300 ms.
      - **Show no timer, countdown or placeholder** for it. Coming back to this step with Back restarts the 5 s.
      - Pressing it saves the profile.

5. **Home (`src/screens/ExploreScreen.tsx`, replaces the home part of `StartScreen`).**
   - Header: `Hi, <name>` (28/600) and the existing "Works offline" pill.
   - Two action cards side by side (they stack on screens narrower than 360dp):
     - **Plan a trek** (`map` icon, "Pick a day and check your gear")
     - **Start now** (`play` icon, "Head out and identify as you go")
   - If a trek is active, these two cards are replaced by one full-width accent **Resume trek** card that shows the title and the elapsed `duration`.
   - **Past treks**, a feed from `feed()`, excluding the active one. Each card shows:
     - a top row: initial avatar (`IconBubble` with the first letter), the name ("You" for the user, "Trailkit" for samples), and a muted date, plus a "Sample" pill on samples
     - the title (18/600)
     - for done treks: a stats row with `duration`, `N species` and `N dangerous` (only if > 0, in `dangerous` colour with its label)
     - for done treks: up to 3 `DangerBadge` + label rows of the sightings, then "+N more"
     - for planned treks: "Planned for Sat 10", "7 of 10 packed" with the missing items listed in `caution`, and a **Start trek** button
   - Empty feed: there's always samples, so no empty state is needed.

6. **Plan a trek (`src/screens/PlanScreen.tsx`).**
   - A title field, required, placeholder "Morning ridge walk".
   - A horizontal row of `nextDays` chips, defaulting to Today.
   - The `GEAR_CHECKLIST` as toggle rows with a Feather `check-square`/`square` icon, each at least 48dp.
   - A live "N of 10 packed" line.
   - "Save plan" goes home. Hardware back and a top-left `arrow-left` (accessibility label "Back") cancel.

7. **Active trek (`src/screens/TrekScreen.tsx`).** Rename `StartScreen.tsx` to this. **Keep the identifying and result views exactly as they are**; replace only the home view:
   - The trek title, and the elapsed time (re-render once a minute, not every second).
   - The existing "Take a photo" / "Choose from gallery" buttons, under the heading "Spotted something?"
   - A "Sightings" list of the sightings (newest first), as `DangerBadge` + common name + time.
   - **End trek**, an outline button in `dangerous`. It asks with `Alert.alert` ("End this trek?", Cancel / End) and then goes home.
   - Every finished identification is saved with `addSighting`, Uncertain ones as label "Not sure" with danger `uncertain`. A failed identification saves nothing.
   - Back from a result goes to the trek view, back from the trek view goes home, and the trek stays active.
   - On snake cards, the call button uses `profile.emergencyNumber`. If `profile.contact` is set, add an outline button under it: "Call <contact name>". Leave `src/safety.ts` unchanged.

8. **Settings.** Add a **Profile** card at the top showing the name, experience and emergency number, plus the contact if set. Its **Edit** opens step 2 of onboarding on its own: Save goes back to Settings, Back cancels. The Safety text uses the user's number. Everything else stays as is.

9. **Animations.** Use only React Native's built-in `Animated` with `useNativeDriver: true`. Add **no** reanimated or other library.
   - **Tab switch:** the incoming screen fades 0→1 and moves `translateY` 12→0 over 220 ms.
   - **Push** (home → plan, home → trek, trek → result, onboarding steps): the incoming view fades in and moves `translateX` 24→0 over 220 ms. Going back reverses the direction (−24→0).
   - **Feed cards:** fade in and move up 8dp on first mount, staggered 50 ms each, the first 6 cards only.
   - **Reduced motion:** add `useReducedMotion()` to `src/ui.tsx` (`AccessibilityInfo.isReduceMotionEnabled` plus its change listener). When it's on, every duration above becomes 0.

10. **Navbar (`PillNav`, rewritten).**
    - All 3 tabs have equal width. Measure the bar with `onLayout`.
    - **One** absolutely positioned `accent` pill sits behind the active tab and slides to the new tab with `Animated.spring` (`speed: 20, bounciness: 6`) on `translateX`. Don't change `flex` any more; the current 1.6 flex jump goes away.
    - The active tab shows its icon and label in `onAccent`; the label fades in over 150 ms. Inactive tabs show their icon only, in `muted`, with an accessibility label.
    - Press feedback: the tab scales to 0.94 while pressed.
    - Keep the floating position, height 64, the hairline border and **no `elevation`**.
    - Every scroll screen gets enough bottom padding (at least 64 + 28 + 16) so the last card clears the bar.
    - The navbar is hidden during onboarding only.

**Leave alone:** `src/safety.ts`, `src/card.ts`, `src/rank.ts`, `src/bioclip.ts`, `src/gemma.ts`, `src/theme.ts` tokens. Don't reformat files you aren't otherwise changing. Don't touch `android/`, `node_modules/` or `patches/`. Keep all existing comments.

**No placeholders.** If anything blocks you (the emulator, a build), stop and say "blocked" with the real error. Don't fake screenshots or numbers.

**Not in this task:** GPS, maps, distance, SQLite, a trek detail page, editing or deleting treks, Community data, gear photo detection, a manual theme switch.

**Ask before:** adding any dependency. None should be needed.

**Done when**

- `npx jest` and `npx tsc --noEmit` pass. The existing 35 tests are unchanged, and `__tests__/treks.test.ts` covers every function in step 1.
- No hex colours in `src/screens/` or `src/ui.tsx` outside `theme.ts` (`grep -n "#[0-9A-Fa-f]\{6\}" src/screens src/ui.tsx` finds nothing), and there's no emoji.
- After `adb shell pm clear com.trailkit.app`, the app opens on onboarding. Confirm on the emulator that the button on step 3 appears only after ~5 s.
- Emulator screenshots (`adb exec-out screencap -p`) are in `screenshots/`:
  - `onboard_1_light.png`, `onboard_2_light.png` (with one validation error showing), `onboard_3_light.png` (after the button appears)
  - `home_light.png`, `home_dark.png` (feed with samples and one planned trek)
  - `plan_light.png`
  - `trek_light.png` (active, with at least one sighting)
  - `cobra_light.png` (showing the contact call button)
  - `settings_light.png`
- One screen recording, `screenshots/animations.mp4` (`adb shell screenrecord`, max 20 s): switching tabs, opening the plan and going back, and starting a trek.
- **Bad news goes in the first line of the summary.** `notes:` lists every open issue, never "none" unless it's true.
