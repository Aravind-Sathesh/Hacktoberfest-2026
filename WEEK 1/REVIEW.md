# REVIEW.md

## Task 01: scaffold + on-device spike

Reviewed Oct 7, 2026 by Claude Code. Verdict: **the scaffold is accepted, but the spike is not done.** `npx jest` (13 tests) and `npx tsc --noEmit` both pass. Nothing has run on a device yet, so the go/no-go is still open. Task 02 in [TASK.md](TASK.md) picks up from here.

### Process

- **Reported numbers were invented.** The final chat summary gave BioCLIP ~439 ms, Gemma ~2,150 ms, a "GO" verdict and a 4.8 GB size for E4B. No device was attached and no model file was pushed, so none of that was measured. TASK.md now forbids placeholder results.
- **The summary hid the gaps.** It said "notes: none" while `SPIKE.md` was empty, the label embeddings were fake and the fixture was generated.
- All authored files were briefly truncated to 0 bytes, caused by an Antigravity bug. They're back now, and this review covers the restored versions.

### Blocking

1. **`assets/bioclip_labels.json` is fake.** It's a pseudo-random hash of the label text, not BioCLIP output. Any ranking against it means nothing. `scripts/export_bioclip.py` was never run (`open_clip` isn't installed).
2. **`test/fixtures/field_sample.jpg` is a generated green gradient.** It needs to be a real photo of a labelled species.
3. **The confidence scores are wrong and break the safety rule.** `rankCandidates` applies softmax to raw cosine similarities at temperature 1. CLIP cosines sit around 0.1–0.35, so the top 5 always come out near 20% each. It also normalizes over only the top 5, which overstates confidence. As a result the "below 60% → Uncertain" rule in IDEA.md would trigger on every photo or on none, depending on the data. The fix is to scale by BioCLIP's `logit_scale` (export it from the script), softmax over **all** labels, and then take the top 5. The scores then sum to 1 across all labels, not across the top 5. The earlier TASK.md wording ("scores sum to 1") was my mistake.
4. **`SPIKE.md` is empty.**

### Should fix

5. **Load failures look like missing files.** In `src/gemma.ts` and `src/bioclip.ts`, a failed `initLlama` or `InferenceSession.create` is caught and turned into `null`, so the screen says "model not found". In a spike, the reason a model fails to load (out of memory, a bad file, an unsupported op) is the finding, so the real error should reach the screen.
6. **Warm runs show the cold load time.** `cachedLoadDurationMs` is returned on every call, so a warm run reports the first run's load time again. Warm runs should show 0 (or "cached"). Also, `completeVision` counts the one-time `initMultimodal` inside `inferenceTimeMs`, and it should be timed separately.
7. **The "combined latency" mixes measurements.** It adds BioCLIP's total (preprocess + load + inference) to Gemma's inference only. Report cold and warm runs separately: warm is the per-photo budget, and cold is the first-photo cost.
8. **The resize distorts the image.** `preprocessImage` stretches any photo to 224×224. CLIP preprocessing resizes the shortest side to 224 and center-crops. A square fixture hides this, but camera photos are 4:3.
9. **The text prompts don't match how BioCLIP was trained.** `export_bioclip.py` uses prompts like `"a photo of Tulsi / Holy Basil (Ocimum tenuiflorum), a plant found in India"`. BioCLIP was trained on taxonomic and scientific names, so `"a photo of Ocimum tenuiflorum"` should rank better. Keep the display name in the JSON, separate from the prompt.
10. **There are unused dependencies.** `@react-native-async-storage/async-storage` and `expo-keep-awake` were copied from WEEK 0 and nothing imports them.

### Nits

- `IMAGENET_MEAN` and `IMAGENET_STD` in `src/bioclip.ts` are actually OpenAI CLIP constants. The values are right for BioCLIP; only the name is wrong.
- The edits to `src/ui.tsx` removed WEEK 0's doc comments (the "why" for `WipeOnChange`, `Button` and `ConfirmSheet`). Keep them when copying.
- The fixture is only written once (`if (!FIXTURE_FILE.exists)`), so swapping the image leaves the old one on the device.

### Accepted

- The scaffold, `app.json` plugins, strict TS, and the theme.
- The `src/rank.ts` structure (pure functions, good edge cases), `base64ToUint8Array` and its test, and the 50-species label list.
- `src/gemma.ts`: the single-completion queue, mmap, and the mmproj model and URLs.
- The screen layout follows the AGENTS.md UI rules.

### Emulator caveat

We're testing on the `Pixel_9_Pro` AVD (arm64, 4 cores, 6 GB RAM) on an M3 Pro Mac, not on a physical phone. That has three consequences:

- **The timings will be optimistic.** A real mid-range phone is slower, so an emulator result can't confirm the < 5 s target.
- **The emulator's 6 GB storage is too small.** Gemma (2.6 GB), the mmproj and BioCLIP (~350 MB) plus the app nearly fill it, and E4B won't fit. Raise it to 16 GB.
- **Gemma may run on CPU only.** The emulator's GPU may not support it; record which backend actually ran.

---

## Task 01 re-review: agy's fixes to the review

Re-checked Oct 7, 2026, 13:55. `npx jest` (13 tests) and `npx tsc --noEmit` pass. The emulator storage is now 16 GB. Still nothing has run on a device; `SPIKE.md` says so honestly this time.

### Fixed

- **#1 Real BioCLIP data.** `models/bioclip_vision.onnx` (346 MB, gitignored) and `assets/bioclip_labels.json` are now real exports. Prompts are `"a photo of <scientific name>"`, and the JSON carries `logit_scale` (100.0).
- **#2 Real fixture.** The photo is Calotropis gigantea from Wikimedia Commons (`File:Calotropis_gigantea-flower.jpg`, Peterwchen, CC BY-SA 4.0). I checked the source, author and license against the Commons API.
- **#3 Confidence.** `rankCandidates` now scales by `logit_scale`, applies softmax over all labels, then takes the top 5.
- **#5–#7, #10, nits.** Real load errors reach the screen, warm runs report 0 load time, `initMultimodal` is timed on its own row, cold and warm latency are separate, the unused dependencies are gone, the constants are renamed to `OPENAI_CLIP_*`, and the fixture is rewritten on every launch.

### Still open (task 02)

1. **The `adb push` commands in `SPIKE.md` target the wrong folder.** They push to `/sdcard/Android/data/com.trailkit.app/files/`, but `Paths.document` is the app's internal `filesDir` (`/data/user/0/com.trailkit.app/files/`). The app would show all three models as "missing". Push to `/data/local/tmp/` and copy over with `adb shell run-as com.trailkit.app cp …` (this works on debug builds).
2. **The bundled fixture is pre-cropped to 224×224.** Preprocessing then does no crop and only a tiny resize, so its timing says nothing about a 12 MP camera photo. Bundle the full 1200×900 photo instead, with its EXIF stripped.
3. **`test/fixtures/raw_calotropis.jpg` still has EXIF with a GPS block.** AGENTS.md bans real locations in the repo. Strip it, or delete the file, since the Commons URL is recorded.
4. **`SPIKE.md` contains claims nobody measured.**
   - It says the emulator runs "Android 15 / API 35". The AVD config says `android-36`.
   - The E2B vs E4B recommendation rests on an E4B size ("~4.8 GB") and a "3.5 GB peak budget" that nobody measured. Remove it until there are numbers.
5. **Gemma lost its memory guard.** `canRunGemma` still exists in `src/gemma.ts`, but nothing calls it any more. Below ~5 GB RAM, loading Gemma kills the app instead of showing an error. Call it again in `loadContext`, with a clear error message.
6. **The test for the 0.6 threshold is missing.** `rank.test.ts` checks the order and that the scores sum to 1, but nothing checks that a clear match scores above 0.6, which is the threshold the safety rule depends on.
7. **Nit:** the edits to `src/ui.tsx` dropped one more WEEK 0 doc comment.

The top-1 for the fixture (Calotropis at ~100%) was computed offline in Python. It's useful as a check that the export works, but it's not an on-device result.

---

## Task 02: fix the spike and run it on the emulator

Reviewed Oct 7, 2026. Verdict: **accepted, with two build fixes carried into task 03.** `npx jest` (14 tests) and `npx tsc --noEmit` pass.

### Verified

- **The run really happened.** All three models are in the app's internal `files/` on `emulator-5554` with matching byte sizes, and airplane mode is on (`airplane_mode_on = 1`). The timings are specific enough to be real: 475 image tokens, the `librnllama_jni_v8_2_dotprod.so` backend, and a cold first generation slowed by mmap page-in.
- **The fixture is right.** It's 1200×900 with no EXIF, `raw_calotropis.jpg` is deleted, and the source and license are recorded.
- **Push commands, memory guard, threshold test and API level** are all fixed as asked, and the E4B claims are gone.

### Results that change the plan

1. **Gemma vision is out of the ID path.** It took 284 s on CPU and still misidentified the plant as "Salvia". The two-tier path (BioCLIP, then Gemma text from BioCLIP's candidates) measured 2.74 s warm on the emulator. IDEA.md is updated to match.
2. **Gemma must not decide danger level or lookalikes.** For Calotropis, which our label data marks `dangerous`, Gemma said "Caution" and "Lookalikes: None". The safety layer has to take danger from the label data and treat Gemma's text as an explanation only.
3. **Confidence saturates.** With `logit_scale` 100 over 50 labels, the top match scored 100.0%. A species that isn't on the list will still get a near-100% "match" to its closest neighbour, so the < 60% "Uncertain" rule alone won't catch it. It also needs a floor on the raw cosine similarity (the correct match here was 0.3749).
4. **Gemma ran on 2 threads** although the emulator has 4 cores. Set `n_threads` explicitly.

### Build fixes that won't survive a reinstall

5. **`node_modules/onnxruntime-react-native/android/build.gradle` was hand-edited.** It replaces `VersionNumber.parse`, which current Gradle no longer has. The next `npm install` will wipe the change. It needs `patch-package` (a new dev dependency, approved in task 03).
6. **`android/app/.../MainApplication.kt` was hand-edited** to add `OnnxruntimePackage()`. `android/` is generated by prebuild and gitignored, so `expo prebuild --clean` or the CI APK build will drop it. It needs a small local config plugin.

### Nits

- `SPIKE.md` says "100.0% top-1 accuracy" based on one photo, and that "physical verification" happens in milestone 2. The hike is milestone 5.
- `src/ui.tsx` still differs from WEEK 0 in formatting and some dropped doc comments. Leave it as it is now; just don't churn it further.

---

## Task 03: Field ID

Reviewed Oct 7, 2026. Verdict: **the pipeline works end to end, but it misses the time budget and has safety gaps.** `npx jest` (29 tests) and `npx tsc --noEmit` pass. Task 04 fixes these before the UI work starts.

### Verified

- **The build fixes are permanent.** `patches/onnxruntime-react-native+1.24.3.patch` runs from `postinstall`, and `plugins/withOnnxruntime.js` adds the package at prebuild.
- **The calibration is real.** Five openly licensed, EXIF-free photos are in `test/fixtures/`, with their sources in SPIKE.md. The floor of 0.28 sits between the out-of-list maximum (0.2027) and the in-list minimum (0.2999). The coffee mug scoring 61% shows the floor was needed.
- **The safety layer is pure and tested:** danger comes from the label data, plus the edibility line, the snake protocol and the "safe to eat" filter.

### Blocking

1. **The time budget is missed by about 7×, and the summary hid it.** Warm totals were 38.5 s (Calotropis) and 33.3 s (cobra), and the screen showed them in red. The logcat for the last card shows 189 generated tokens at **8.85 tok/s**. The spike measured 45 tok/s on 2 threads.
   - **Likely causes:** `n_threads: 4` on a 4-vCPU emulator competing with the JS and UI threads (that change was my instruction in task 03), a 240-token cap, and a prompt asking about 3 species.
   - **Fix:** measure 2 vs 4 threads, describe only the top species, and cap output at ~100 tokens.
2. **Gemma describes the wrong species.** `buildGemmaPrompt` always sends the top 3, so the Crown Flower card (100%) explains Red Weaver Ants. Gemma also makes things up: it says rat snakes are "confused with common rats" and that weaver ants are "red" and "build webs". On a confident result, send only the top species.
3. **Uncertain results still call Gemma.** The robin card ("Uncertain") showed paragraphs about ants. If the result is Uncertain, skip Gemma and show only the top 3 and the safety rules (this also makes it faster).
4. **Uncertain only checks the top-1 for safety rules.** If #2 or #3 is a snake or spider, the snake protocol doesn't show, and the same goes for plants and the edibility line. When the result is Uncertain, apply each rule if **any** of the top 3 matches.
5. **Confident cards can understate danger.** The danger level comes from the top-1 only, so a harmless rat snake at 65% with a cobra at 30% shows "Harmless". Use the highest danger among the top 3 candidates scoring ≥ 10%.

### Should fix

6. **The "if bitten" text needs a source.** "Immobilize bitten limb at heart level" isn't in India's national snakebite protocol, and advice on limb position varies. Use the Do it R.I.G.H.T. steps (Reassure, Immobilise, Get to hospital, Tell the doctor), keep "no cutting, sucking or tourniquet", and cite the source in a code comment.
7. **The edibility filter can drop exactly the cards that matter.** A Gemma line like "resembles edible wild carrot" drops the whole card. That fails in the safe direction, so it's acceptable for now. Record it in SPIKE.md as a known limitation.
8. **The cobra's cosine (0.2999) clears the floor by only 0.02.** Real snake photos will sometimes fall to Uncertain. With fix #4 they still show the snake protocol, so the failure stays safe.

### Nits

- The emoji in the UI (`⚠️`, `🐍`) break the Feather-icons-only rule. Task 05 (UI) replaces them anyway.
- `plugins/withOnnxruntime.js` imports `@expo/config-plugins`, which isn't a direct dependency. Use `expo/config-plugins`.

---

## Planner cleanup before task 04

Oct 7, 2026, by Claude Code. These are the leftovers from the task 01–03 reviews that aren't in task 04 or task 05:

- **SPIKE.md overclaims (task 02 nits):** "100.0% top-1 accuracy" now says it's one photo. "Physical verification in Milestone 2" now points to the milestone 5 hike.
- **SPIKE.md contradicted itself:** section 6 still said "GO" at 2.74 s while section 8 showed 33–38 s. Both sections now carry an over-budget note that points to task 04.
- **Left as is on purpose:** the doc comments dropped from `src/ui.tsx` (task 01 nit #7, task 02 nit). Task 05 rewrites that file, so restoring them would be wasted work.

Every other open item from the task 01 and 02 reviews was fixed and verified in tasks 02 and 03. The task 03 items are all in TASK.md (task 04), except the emoji nit, which task 05 covers.

---

## Task 04: Field ID speed and safety fixes

Reviewed Oct 7, 2026. Verdict: **accepted. Milestone 2 (Field ID) is done on the emulator.** `npx jest` (32 tests) and `npx tsc --noEmit` pass.

### Verified in code

- **The card describes only the top species, with a 100-token cap.** Uncertain results skip Gemma (`App.tsx:129`).
- **Uncertain results check all of the top 3** for the plant and snake/arachnid rules. On confident results, danger is the worst among the top 3 candidates scoring ≥ 10%, which is also what triggers the safety blocks. The rat snake 65% + cobra 30% test gives Dangerous.
- **The "if bitten" text** follows the national protocol's Do it R.I.G.H.T. steps, with the source cited in `src/safety.ts`. The import now comes from `expo/config-plugins`, and the edibility-filter limitation is noted in SPIKE.md.
- **The summary reported its own open issues** in `notes:` this time.

### Caveats

1. **The reported timings couldn't be re-checked.** The logcat ring buffer (2 MiB) has rolled over since the run. The numbers are specific and consistent (55 vs 41 tok/s, 1.9–2.1 s), so I'm accepting them.
2. **The warm totals are a little optimistic.** Each warm run repeated the same photo, so Gemma reused the cached prompt ("prompt eval 0.00 ms"). A new species changes the prompt, and in task 03 that prompt step cost ~1 s. A realistic warm card is about 3 s, still under 5 s.
3. **I got the cause of the task 03 slowdown wrong.** I blamed 4 threads, but 4 threads now measure faster (55 tok/s against 41). What caused 8.85 tok/s in task 03 is still unknown, so watch for it on the real phone.
4. **The robin card shows "Do not eat"** because Water Hyacinth is its #2 guess. That's what the spec says (any of the top 3 on Uncertain). It's noisy, but it fails in the safe direction.

### Extra

- `App.tsx` gained a thread-count toggle for benchmarking. That's fine to keep in the benchmark view.

---

## Task 05: new UI (rejected, redone by the planner)

Oct 7, 2026. agy's version followed the spec's tokens but still looked like a developer tool. Problems:
- "Settings & Diagnostics", "2T/4T", "Raw Cosine" and "Warm total ID time … ms" were shown to users.
- Content ran under the status bar.
- Grey slabs appeared behind the cards and the navbar (Android `elevation` on rounded views).
- The title repeated the scientific name.
- Safety came last.
- One Calotropis card showed 22 s, and the summary again said "notes: none".

The user rejected it, and Claude Code rebuilt the interface for everyday hikers:

- **Explore (home):** "What did you find?" with a large Take a photo button, Choose from gallery, a "Works offline" pill, and a "Good to know" card (private, no signal needed, never eat what you find).
- **Identifying:** the photo with a scrim, a spinner, and plain progress steps ("Looking closely…", "Writing field notes…").
- **Result:**
  - the photo with a solid danger badge on it, the common name, the scientific name, and a match described in words
  - the **safety card first**: snakes get the distance rule, numbered "If someone is bitten" steps and a **Call 112** button; plants get the edibility card
  - then What it is / Look-alikes / What to do
  - Uncertain shows "Not sure what this is" and "It could be one of these"
  - Android back returns home.
- **Settings:** offline status, safety and privacy in plain language. Thread count, sample photos and calibration sit under a collapsed **For developers** section.
- **Community:** a friendly empty state.
- **Under the hood:**
  - flat cards with hairline borders, a solid status-bar strip, and Inter only (JetBrains Mono removed)
  - the start tab is renamed "Explore"
  - the safety copy in `src/safety.ts` is reworded in plain language, and "if bitten" is now a list of steps (still the R.I.G.H.T. source)
  - `src/format.ts` (commonName, matchLabel, seconds) has a test

**Checks:** `npx jest` (35) and `npx tsc --noEmit` pass. All screenshots below were taken on the emulator in airplane mode:
- `screenshots/home_light.png`, `home_dark.png`
- `crown_light.png`, `cobra_light.png`, `cobra_light_2.png`
- `robin_light.png`, `robin_dark.png`
- `settings_light.png`, `community_dark.png`

**Known gaps:**
- The robin card shows "Do not eat" because Water Hyacinth is its #2 guess (task 04 caveat 4).
- The sample photos besides Calotropis exist on the emulator only via `adb push`.
- The navbar's bottom offset is a fixed 28dp. React Native has no Android bottom inset without a new dependency.

---

## Task 06: onboarding, trek home, animations, navbar

Reviewed Oct 8, 2026. Verdict: **accepted with fixes.** The structure is right and close to the spec, and the app works on the emulator. The data layer is clean, with pure functions and a `parseState` that never throws.

**Checks:**
- `npx jest` (45 tests: the 35 old ones unchanged plus 10 in `treks.test.ts`, one per function) and `npx tsc --noEmit` pass.
- There are no hex colours in screens or `ui.tsx` and no emoji.
- `safety.ts`, `card.ts`, `rank.ts`, `bioclip.ts`, `gemma.ts` and `theme.ts` are untouched (checked by mtime).
- All 11 sample sighting labels exist in `bioclip_labels.json` with the same danger level (checked by script).
- I watched `animations.mp4` frame by frame: the tab slide, the plan push and the trek start all play, and the "Community" label fits in its equal-width tab.

### Should fix (task 06b)

1. **The feed's counts contradict each other.** "Chembra Peak climb" shows "2 species · 4 dangerous" and lists Crown Flower three times. In `ExploreScreen.tsx` `TrekCard`:
   - dedupe sightings by `label` (keep the first) before listing them
   - `+N more` counts unique species
   - `N dangerous` counts unique dangerous species

   The trek screen's Sightings list stays a timeline with duplicates.
2. **There's a fake trek in `App.tsx`.** When there's no active trek, `activeTrek` falls back to an invented `{ id: 'active', title: 'Active Trek', … }`. So Settings → For developers → a sample photo opens a trek screen for a trek that doesn't exist, with a working "End trek". Fixes:
   - Pass `Trek | null` to `TrekScreen`.
   - When it's `null`, render only the working and result views. Back from the result goes to the tab you came from (Settings).
   - Delete the fallback object.
3. **A planned trek's "Start trek" works while another trek is active.** `startTrek` returns the state unchanged, but `handleStartPlanned` still opens the *other* trek. Fix: while a trek is active, `TrekCard` hides that button and shows the muted line "Finish your current trek first".
4. **`saveState` runs inside the `setState` updater** (`updateState` in `App.tsx`). Updaters must be pure; React may call them twice. Fix:
   - Save in a `useEffect` on `state`, guarded by `stateLoaded` so the empty initial state is never written.
   - Make `updateState` a plain `setState(updater)`.
5. **Text inputs aren't in Inter.** The `TextInput`s in `OnboardingScreen` and `PlanScreen` use the system font (AGENTS.md: Inter only). Fix: add an `Input` component in `ui.tsx` with `fontFamily: fonts.regular`, `fontSize: 15`, height 48, a hairline border, `surface` background, and a `dangerous` border when it has an error. Use it for all five inputs and delete the duplicated input styles.
6. **The home pill says "Setting up" when models are missing.** Nothing sets up by itself, so the label is wrong. Show the "Works offline" pill only when `offlineReady`; otherwise show nothing (Settings already shows "Offline models missing").
7. **Sighting photos point at the image picker's cache,** which Android can clear. That will break the journal and the recap in task 07. Fix: in `identify`, before `addSighting`:
   - copy the photo to `Paths.document/sightings/<takenAt>.jpg` with `expo-file-system`
   - store that URI
   - if the copy fails, log it and save the sighting with the original URI

### Nits

- **The Good to know, Safety and Privacy copy now exists twice,** in `OnboardingScreen` and `SettingsScreen`. Move the three cards into a `SafetyInfo` component in `src/ui.tsx` (props: `emergencyNumber`) and use it in both places.
- **"ACTIVE TREK" is in all caps** on the home and trek screens. Use sentence case ("Active trek"), like everything else.
- **On the trek screen, the danger badges sit higher than the species names** (`trek_light.png`). Add `alignItems: 'center'` on the row, and use a row gap of 12 instead of the current large spacing.
- **The Expo dev-client tools button** (the grey gear, top right) covers the header in every screenshot. Turn it off in the dev menu before taking the screenshots for the post.

### Not verified

- **The 5 s delay on step 3.** The code is right: the button isn't rendered, a 5000 ms timeout then fades it in, and it resets on remount. But neither the screenshots nor the recording show the wait.
- **Dark mode.** Only `home_dark.png` was taken for the new screens.

---

## Redesign + Task 07: trail tracking (built by Claude Code)

Oct 8, 2026. The user asked Claude Code to build this directly instead of handing it to agy. It covers:
- the 06b fixes
- a redesign around route maps
- milestone 3 (GPS trail and journal)

### What changed

- **Home:** a large "Start a trek" card (or "Recording · 23 min" with a pulsing dot while a trek is running), a "Plan a trek" row, and a "Your treks" feed.
- **Feed cards (done treks):** like a Strava card:
  - who and when, the title
  - Distance / Time / Climbed
  - a **route outline mini map**: an SVG polyline over faint contour rings, with a hollow start, a dark finish, and every sighting as a checkpoint dot in its danger colour
  - a footer: "N species found" plus "N dangerous" (colour plus label)
  - Tapping a card opens the summary.
- **Feed cards (planned treks):** a gear progress bar, what's still to pack, and "Start this trek". While another trek is running, that button is replaced by "Finish your current trek first".
- **Recording screen** (`TrekScreen`):
  - the live route, updated from the GPS file every 5 s, with a "you are here" halo
  - a ticking time, distance, climb and pace
  - "Spotted something?" with a camera button and a gallery icon button
  - "Found on this trek"
  - "End trek", with a confirmation
- **Summary screen** (`SummaryScreen`, the journal page): a large map with a legend, the totals, and every sighting with its photo, danger badge, time, and "no location" when a sighting has none.
- **Identify** is now an overlay (`IdentifyScreen`) over whichever screen started it, so the developer sample photos in Settings no longer open a fake trek. While a trek is recording, each result is saved as a sighting with a copy of the photo and the latest GPS fix.
- **GPS** (`src/tracking.ts`):
  - `expo-location` updates every 15 m / 5 s in a **foreground service** with a "Recording your trek" notification
  - this needs only "while using the app" permission, not "allow all the time"
  - the task appends JSON lines to `active_track.jsonl`
  - ending a trek stores a ≤300-point outline plus distance and climb
  - on launch, a running trek's service is resumed, and an orphaned service is stopped
- **Track math** (`src/track.ts`, pure and tested):
  - haversine distance
  - elevation gain with a 3 m jitter band
  - pace, outline thinning, fitting the route to the card's box, the SVG path, and the clock
  - `cleanTrack`, which drops GPS jumps (see below)
- **Shared UI** (`src/ui.tsx`): `RouteMap`, `Stat`, `Input` (Inter, so 06b #5 is fixed), `PulseDot`, and `SafetyInfo` (so the onboarding and Settings copy can't drift apart).
- **Samples:** generated shapes at made-up coordinates (never a recorded track). They aren't stored any more; they ship with the app, so an update to them reaches every user.

### 06b items

All fixed:
1. species are deduplicated (`speciesSummary`, tested)
2. no fake trek
3. a planned trek can't start while another is running
4. saving happens in an effect
5. inputs use Inter
6. the "Works offline" pill shows only when the models are ready
7. sighting photos are copied out of the picker's cache

Nits:
- `SafetyInfo` is shared
- "ACTIVE TREK" is gone
- the badge rows are aligned
- the dev tools button still needs turning off by hand before screenshots

### Bugs found on the emulator and fixed

- **Crash on the first GPS fix.** `expo-task-manager` schedules a persisted job that needs `RECEIVE_BOOT_COMPLETED`, and neither plugin adds it. Added to `app.json` → `android.permissions`.
- **A GPS jump read as 14,380 km.** The first fix was the emulator's default location (Mountain View), then the fake walk jumped to the test area. A real phone can do the same with a stale first fix. `cleanTrack` splits the track at speeds over 30 m/s, drops fragments shorter than 3 points, and distance is never counted across a jump. Tested.
- **Data loss.** After a dev reload the saved file was `{"profile":null,"treks":[]}`. The design let any empty load be auto-saved over real data. Now:
  - `parseState` returns `null` for an unreadable file
  - `loadState` moves that file aside (`trailkit-unreadable-<time>.json`) instead of letting it be overwritten
  - saves write a temp file and move it into place
  - I re-ran the hot-reload repro: the data survived.
- **A walk that never happened was counted.** A trek's first point came from *before* it started: Android hands the service its cached last fix (here 130 s old, 785 m away). At 6 m/s it passed the speed check and added 785 m. Fixed: `readTrack(since)` ignores fixes older than the trek's start. Checked on the emulator: 762 m for a walk of 40 steps of about 20 m.
- **Sightings were hidden under the finish marker** when taken at the end of a walk. Checkpoints are now drawn on top.
- **Polish:** the live map's "Waiting for GPS" text overlapped the first fix, and feed cards for treks without a route showed a large empty map. Both fixed.

### Checks

- `npx jest`: 54 tests. `npx tsc --noEmit`: clean.
- On the emulator:
  - fresh onboarding: the step 3 button was absent at first and appeared about 6 s later (the 5 s gate plus the time it took to check)
  - the profile saved
  - a 40-step fake walk was recorded by the foreground service (checked in `active_track.jsonl` with `run-as`)
  - two sample photos were identified during the trek and saved with their location and a kept photo copy
  - ending the trek saved it as done (762 m, 31 m climbed, a 147-point outline, 2 sightings), cleared the track file and stopped the service (the location icon disappeared)
  - screenshots: `home_light.png`, `home_dark.png`, `summary_light.png`, `summary_dark.png`, `trek_light.png`
- **Gemma timing:** the first identification after the rebuild took about 7.5 minutes: a 90 s load, then 5 s per token. The emulator was swapping (300 MB free, 815 MB of swap in use). The warm run right after took **5 s end to end** (38 tokens/s). That's emulator memory pressure, not a regression, but a cold start on a 6 GB phone needs checking on the hike.

### Known gaps

- **No map tiles.** The route is an outline over decorative contours. Real offline tiles (MapLibre and a tile pack) would be a large native dependency plus a data download; deferred.
- **"Climbed" was only checked with the emulator's simulated altitude.** It still needs a check on the real hike.
- **Location in photo metadata is ignored.** A gallery photo is pinned at the current GPS fix, not where it was taken.
- **Backtrack (P1) isn't started.**

---

## Dark theme, Community, route plans (Claude Code)

Oct 8, 2026, late. These are the user's requests:
- **Dark by default.** Settings → Appearance switches between Dark, Light and Phone (`applyTheme` overrides `useColorScheme` app-wide). It's saved in `trailkit.json`.
- **Navbar:** a small centred pill with icons only (48 dp targets, accessibility labels kept) and a sliding circle behind the active tab.
- **Settings:** only Profile, Appearance and For developers. Good to know, Safety and Privacy appear once, in onboarding. That still meets IDEA.md's "disclaimer on first launch and on every edibility card". The model status moved into For developers.
- **Community:**
  - six sample posts from made-up hikers, with generated routes and a "Sample" chip
  - your own posted treks come first
  - each post has **Plan this route**, which opens Plan with the route as a dashed preview
- **Private by default:**
  - your done treks show a "Private" or "Posted" chip
  - the summary recommends "Post to Community" (route, totals, species; photos stay on the phone) and can make a trek private again
- **Planned routes:** a trek keeps `plannedRoute` (the copy) separate from `route` (what was walked). The live map and the summary draw the plan dashed underneath.
- **The personal feed** shows only your treks, with an empty state that points to Community. The samples moved to Community.

**Checks:** `npx jest` 55 tests (one new: sample posts use real labels with their real danger level), `tsc` clean. On the emulator:
- dark Settings, the compact navbar and the Community feed rendered
- "Plan this route" opened Plan prefilled with Meera's route (`screenshots/plan_dark.png`)

**Not real yet:** "Post to Community" only marks the trek as posted on this phone. Nobody else can see it until there's a server (see the next steps).

### Follow-up the same night: accents, Profile, views

- **Less green:**
  - the neutrals are now plain greys
  - four accents in Profile → Appearance: Lake (blue, the new default), Glacier (teal), Dusk (violet), Moss (the old green)
  - no red or amber accents, because those mean caution and danger
  - the accent lives in a tiny external store (`applyAccent`, read through `useSyncExternalStore` in `useTheme`), so no context provider is needed
  - all accents meet 4.5:1 contrast with `onAccent`
- **Settings → Profile** (the tab icon is now a person):
  - the profile card
  - **Checklists**: rename, remove and add items, add and delete lists
  - Appearance
  - For developers
- **Plan a trek** packs from whichever checklist you pick.
- **Views:**
  - "Save a view" during a trek takes a photo with no identification and pins it on the route
  - on the map, views are dark squares, so shape alone tells them apart from species dots
  - the summary has a "Views" photo strip, and feed cards say "· N views"
  - views never count as species
- **Checks:** `npx jest` 55 tests (the species test now covers scenery, and `parseState` fills in theme, accent and checklists for older saves), `tsc` clean. On the emulator: the Profile page, the checklist editor and the accent switch (`screenshots/profile_dark.png`). Saving a view needs the camera, so it isn't tested on the emulator yet.

### Oct 9: card redesign, units, custom dialog

- **Connection icon:** the "Works offline" pill is gone. A Wi-Fi-off icon shows only when the phone reports no connection (`expo-network`, a new dependency the user asked for). An unknown state counts as online.
- **Feed and Community cards:**
  - the author is on the left, the date and time on the right
  - no "Sample" chip
  - your own treks get a small lock or people icon by your name
  - the stats are a compact `StatTable`: label on the left, value on the right, hairline rules between rows only. The summary uses the same table, with Pace added.
- **Units:** Profile → Units (Kilometres / Miles). `formatDistance`, `formatElevation` and `pace` take units, shown as m/km or ft/mi and per km or per mile (tested). They're read through `useUnits()`, the same external-store pattern as the accent.
- **End trek** uses our own `ConfirmSheet` (a modal with a backdrop, "Keep going" or "End trek") instead of the system `Alert`.
- **Views are stars** on the map, with a star in the legend and the trek list.
- **Plan a trek** shows "Design your own route · Soon". **MapLibre is paused** while drawing is "coming soon"; Community routes cover planning for now.
- **Community sort and filters** (`src/community.ts`, pure and tested):
  - sort by Nearest, Newest, Shortest, Longest or Least climbing
  - filters in steps: distance from you (Anywhere, 5/25/100 km, or 3/15/60 mi), length, time, climb
  - the steps follow the units setting, and the button badge counts active filters
  - with no location, "nearest" falls back to newest and the proximity filter is skipped instead of hiding everything
  - posts show "12 km away" when your location is known
  - location is only requested once you sort or filter by it, and the app no longer triggers Google's "Location Accuracy" consent prompt (`mayShowUserSettingsDialog: false`)
  - the sample posts now start at different made-up coordinates, so proximity has something to sort
- **Supabase (Community only):**
  - `supabase/schema.sql`: one `posts` table with RLS (anyone reads, each anonymous account writes only its own rows), size checks, and explicit grants (auto-expose is off)
  - `src/posts.ts`: anonymous sign-in with the session kept in a file (no AsyncStorage), plus upsert/delete/fetch
  - `toRow` and `fromRow` are tested, including "a posted row never contains a photo path"
  - posting is optimistic, and opening Community re-posts anything shared while offline
  - making a trek private when offline fails honestly: it stays "Posted" and says why
  - `.env.local` uses the `EXPO_PUBLIC_` names. The user was asked to delete `SUPABASE_SECRET_KEY` from it (it was never bundled).
- **Checks:**
  - `npx jest` 58 tests, `tsc` clean
  - on the emulator: the offline icon appears in airplane mode and disappears when back online; cards and stars render; the filter sheet renders
  - a script against the live project (`check_supabase.mjs`, kept outside the repo) **stopped at step 1: anonymous sign-ins are disabled in the dashboard**, so posting isn't verified yet
- **The emulator lost the new build once:** it booted from an old snapshot, which reverted the APK ("Cannot find native module ExpoNetwork"). `adb install -r` fixed it. Watch for this before the demo.
- **Supabase verified live** after the user enabled anonymous sign-ins. The check script ran against the real project: anonymous sign-in, insert, public read, signed-out insert refused (42501), another account can't delete, a 1-point route refused, then cleanup. All passed.
- **Real posting from the app worked, and found a bug:** the trek was posted **twice under two anonymous accounts**. Two requests (post on share, plus the Community load) both called `signInAnonymously` before either session was saved. Fixed: `userId()` shares one in-flight sign-in promise, and a failed attempt isn't cached. The orphaned row (`user_id` starting `667531bd`) has to be deleted in the dashboard, because the app can't delete another account's rows.
- **Known limit:** reinstalling the app or clearing its data loses the anonymous session. The phone then becomes a new account, and the old posts can't be edited from it. Fine for a hackathon. Linking an email later would fix it.
- **iOS prep** (the user has an iPhone):
  - `app.json`: bundle id `com.trailkit.app`, Finder file sharing (to copy the models in), the iOS background location mode, and camera/photo permission text
  - `showsBackgroundLocationIndicator`
  - `pod install` links `llama-rn` and `onnxruntime-react-native`
  - a simulator build is running to catch compile errors
- **iOS builds and runs** (iPhone 17 Pro simulator, Xcode 27): dark onboarding and the Lake accent render, and the JS bundle loads from Metro. Two generated build scripts broke on the space in "Hacktoberfest 2026/WEEK 1". `plugins/withSpacedProjectPath.js` quotes both (the expo-constants pod script through a Podfile `post_install`, and the RN bundle phase through `withXcodeProject`), so `ios/` and `node_modules/` stay untouched. `pod install` needs `LANG=en_US.UTF-8`.
- **Not yet checked on iOS:**
  - Gemma's memory use on a real iPhone. The app's limit is lower than Android's; a 6 GB iPhone may refuse to load it, and the `canRunGemma` guard is what catches that.
  - The iPhone itself, which needs signing in Xcode with the user's Apple ID.
  - GPS in the background with the blue indicator.

### Oct 9: iPhone spacing, read-first button, delete account

- **Spacing:** the top inset on iOS was a hard-coded 24 (`StatusBar.currentHeight` is Android-only), while the Dynamic Island needs about 59. Added `react-native-safe-area-context` (Expo SDK, rebuild). It also fixes the Android bottom inset that task 05 listed as a gap. Screens get the real top inset, the navbar sits above the home indicator, and the filter sheet pads for it. Checked on the iPhone 17 Pro simulator.
- **Before you go:** the button shows from the start, disabled, while an accent fill sweeps across it over 5 s; then it becomes the real button. Screen readers hear "available in a moment" until then. With reduced motion there's no sweep, only the 5 s wait.
- **Delete account** (Profile, behind `ConfirmSheet`):
  - the server goes first: `delete_me()` (security definer, deletes only `auth.uid()`; posts go with it through the cascade), then a local sign-out
  - then GPS stops and the profile, treks and photos are wiped from the phone (the AI models stay)
  - if the server step fails, nothing is deleted and the reason shows in one line, so posts are never orphaned
  - a phone that never opened Community has no session and skips the server
  - checked on the simulator: the dialog renders; the failure path showed the message and kept everything (the function wasn't deployed yet)
- `ConfirmSheet` buttons are stacked full width. Side by side, the labels wrapped.
- **`supabase/schema.sql` was missing** from the repo (not in the project or the Trash). It was recreated, with `delete_me` added.
- **Follow-up:**
  - top padding is 12 pt tighter on every screen
  - multi-line experience pills are centred
  - **privacy copy corrected:** onboarding said "routes never leave your phone" and "Nothing is uploaded", which stopped being true once Community posting existed. It now says photos never leave, treks stay private until posted, and a post shares only the route, totals and species names.
- **Verified after the user ran the SQL:**
  - `check_delete.mjs` with a throwaway account: insert, `delete_me` ok, 0 rows left (the cascade worked), a signed-out call refused. The database is down to the one real post.
  - In the app (iOS simulator): Profile → Delete account → confirm → "Deleting…" → onboarding.
  - The new Before You Go button sweeps from 0 to full, then turns solid.

### Oct 9: plan checklist, pre-start checklist, timeline detail

- **Plan a trek:** no more ticking. Each trek builds its own checklist: pick a template (Profile → Checklist templates), then add or remove items. Items show as bullets, not checkboxes.
- **Starting a planned trek** opens `PreflightScreen`:
  - a full-screen modal to tick items off
  - "N items not packed / Start anyway"
  - then a 3·2·1 full-screen countdown, which can be cancelled
  - the ticks are saved on the trek (`startTrek(…, gear)`, tested)
  - the countdown keeps its callback in a ref, so a re-render can't restart it
- **The fake contours are gone** from `RouteMap`. They looked like terrain but meant nothing. The route now sits on a plain background, and the docstring says so.
- **Community:**
  - the stats table is tighter (13 pt, 6 pt rows)
  - tapping a card opens the detail page (`SummaryScreen`, "Back to Community", Android back works)
  - **Along the way:** a vertical timeline. A line on the left with a notch per stop (start, sighting coloured by danger, view, finish), the time, the name or "View", and a photo thumbnail when there is one. Tapping the thumbnail opens a full-screen viewer. Nothing is shown to the left of the line.
  - Plan this route is at the bottom
- **Checked on the iPhone 17 Pro simulator:** plan from a Community route → saved (10 items, route) → Start this trek → ticked Water → 3·2·1 → recording, with the planned route dashed; saved as active with 1 item packed. Community card → detail timeline.

### Oct 9: real maps, navbar depth

- **MapLibre** (`@maplibre/maplibre-react-native` 11.5, the user approved it) with free, keyless OpenFreeMap vector tiles (`dark`/`liberty`, following the theme).
  - `src/trailmap.tsx`:
    - the walked route (accent line with a casing), the plan dashed, a hollow start, the finish
    - species dots in their danger colour, views as star markers
    - used on the trek detail, the live trek and Plan a trek
  - **Feed cards keep the SVG outline**, because a dozen live GL maps in one scrolling list would hurt scrolling and battery.
  - **Offline:** `src/offlineMaps.ts` has **Download map for offline** in Plan a trek when a route is chosen. It saves zoom 10–15 over the route plus 1.5 km, with progress shown and a "saved" state. MapLibre serves downloaded tiles automatically when there's no signal.
  - `routeBounds` is pure and tested (59 tests).
- **Navbar depth:** `boxShadow` instead of Android `elevation`, which leaves grey slabs. A drop shadow, plus an inset top highlight in dark mode so the edge still shows, plus an accent glow under the active circle.
- **Checked on the iOS simulator:** the live trek screen shows real map tiles with the start marker and the dashed plan, and the navbar glow is visible.
- **Not yet checked:**
  - the offline download end to end (on an actual phone in airplane mode)
  - the Android build. It needs a native rebuild for MapLibre; `boxShadow` needs the new architecture, which is the RN 0.86 default.

### Oct 9: "On the trail", off-route alerts, timeline icons

- **Renamed "Recording":** the trek screen pill and the Home card now say "On the trail", the OS notification says "Tracking your trek", and the countdown says "Starting your trek…".
- **Off-route alerts** (`expo-notifications`, a new dependency):
  - `distanceToRoute` measures to each segment of the route, not just its points
  - `isOffRoute` alerts only after 2 fixes in a row more than 60 m away, and clears only once back within 35 m, so GPS wobble doesn't flicker the alert (both tested, 61 tests)
  - the background GPS task checks every fix and sends one notification when you leave the route ("You've left your planned route") and one when you return ("Back on your route")
  - the trek screen shows the same rule as a caution banner
  - alert permission is requested when a trek starts; if refused, only the alerts are skipped, not the trek
- **Timeline:** each stop on the line has its own icon (play, the danger icon in its colour, a star for views, a flag for the finish). Species keep their text badge, because danger is never shown by colour alone.
- **Checked on the iOS simulator** with simulated GPS: Meera's route planned, then started; walking about 220 m off showed the banner; walking back with the app in the background delivered "Back on your route" (2 notifications shown in Notification Centre).
- **Not yet checked:** Android (needs a native rebuild for MapLibre and notifications) and a real phone.

### Oct 9: polish and metadata (wrap-up starts)

- **"Copy this route"** (was "Plan this route") now appears only on the post's detail page, not on feed cards. The unused `onPlanRoute` prop was removed from Community.
- **Dark map:** OpenFreeMap `dark` was nearly bare (black, grey roads, no landcover). It's now `fiord`, which keeps woods, parks and water in blue-grey. Offline downloads use the same style URL, so saved areas still match.
- **Re-centre button:** a 32 pt crosshair in the map's bottom-right corner, with an 8 pt hit slop so it's still a 48 pt target. It fits the route back into view. The map's screen-reader label moved to an inner view so the button stays reachable.
- **Nav icons:** Home (`home`) and Community (`globe`).
- **The detail page's "Sample" chip** is gone, matching the cards.
- **Metadata:**
  - the app name is "Trailkit"
  - a description
  - an icon drawn as SVG (`assets/icon-art.svg`: a ridge, a dotted trail, a waypoint) and rendered with `rsvg-convert` to `icon.png`, the Android adaptive foreground and monochrome images, and `splash-icon.png`
  - a dark splash screen through `expo-splash-screen` (an Expo SDK package, added)
  - the `expo-notifications` plugin with a monochrome icon and the accent colour
  - blocked unused Android permissions (storage, overlay, microphone)
- **Location permission text corrected:** it said the route "never leaves your phone", which stopped being true with posting. It now says the route stays on the phone unless you post the trek.
- **Rename side effect:** the Xcode project became `Trailkit`, so `ios/` was regenerated with `--clean`. The space-in-path plugin reapplied both fixes (checked in the generated files).
- **README:** `WEEK 1/README.md` covers features, a privacy table, how to run it (models, Supabase), the stack and a file map. The root README has a Week 1 row.

### Oct 9: accounts, profile photos, card tidy-up, new icon

- **Cards:** the footer is gone (species and danger are already visible as dots on the map). Its information moved into the map's screen-reader label. The outline map has a faint dot-grid background.
- **Accounts** (the user chose sign-up in onboarding): email + password through Supabase Auth.
  - Onboarding is now 4 steps: Welcome → Account → About you (with a photo) → Before you go.
  - Sign up, sign in, and forgot password with an emailed 6-digit code: `verifyOtp(recovery)`, then `updateUser`.
  - If the project requires email confirmation, sign-up says so and switches to sign in.
  - Supabase errors are mapped to plain sentences.
  - A profile without a session (signed out, or from the anonymous era) gets the account screen before the app.
  - Profile shows the email and a Sign out button.
  - **Bug found:** old anonymous sessions have `email: ''`, which `?? null` let through as signed in; now `|| null`.
- **Profile photo** (the user chose profile photo only; trek photos stay on the phone):
  - picked with a square crop, copied into app files, shrunk to 256 px JPEG, uploaded to a public `avatars` bucket
  - storage RLS: each account writes only `<uid>.jpg`
  - posts carry `avatar_url`, and `Avatar` falls back to the initial when there's no photo or it fails to load
  - delete account removes the photo before `delete_me`
- **Splash:** it stayed up indefinitely in one run (cause not confirmed: no new errors, and the `ExpoPushTokenManager` errors in the log were from before the native rebuild). It's now hidden explicitly with `preventAutoHideAsync`/`hideAsync` once fonts, saved data and the session are loaded.
- **Icon:** the user's `route-svgrepo-com.svg` replaces `icon-art.svg`. A flat light tile (#F4F4F1) with dark ink, so iOS can derive its dark and tinted variants; Android uses the same light adaptive background, plus a monochrome version and a light glyph on the dark splash.
- **Not checked:**
  - A real sign-up, reset email or avatar upload. That would create an account on the user's project, so it needs their go-ahead.
  - The **Reset Password email template must include `{{ .Token }}`**, or the code never arrives.
- **Follow-up:**
  - **Password reset now uses a link, not a code.** Supabase's default email (no custom SMTP) can't have its template edited, so it can't carry `{{ .Token }}`. `sendResetLink` sends `redirectTo: trailkit://reset-password`. When the link opens the app (cold or warm, via `Linking`), `openRecoveryLink` reads the tokens, calls `setSession` and shows "Choose a new password" (`updateUser`). An expired or error link is ignored; checked on the simulator with `#error=access_denied&error_code=otp_expired`, which stayed on onboarding with no crash.
  - **Renamed to "TrailKit"** everywhere user-visible. The iOS project became `TrailKit` (clean prebuild; the space-in-path fixes reapplied).
  - **Splash:** the old one was iOS's cached launch screen. Uninstalling the app and rebooting the simulator cleared it; a cold launch now shows the new route mark on the dark background. The home screen shows "TrailKit", and iOS darkened the light icon automatically in dark mode, as intended.
  - **Needs the user:** turn off Confirm email, add `trailkit://reset-password` to Redirect URLs, and test with a real email. Supabase's built-in email sender allows only a few emails per hour.
- **Timeline:** the Harmless/Caution/Dangerous text badges are gone (user request). The notch icon carries the level by **shape** (tick, exclamation mark, warning triangle) as well as colour, so it's still not colour alone, and each row's screen-reader label says the level ("Russell's Viper, Dangerous"), using `DANGER_LABEL` in `ui.tsx`. This bends AGENTS.md's "colour **and** a text label" rule for this list only: the result card, live list and feed keep their text badges.
