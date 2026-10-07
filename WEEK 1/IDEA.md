# Trailkit — PRD

Oct 6, 2026 · @Aravind

## Overview

Trailkit is an offline phone companion for hikers and wilderness trips: snap a plant, bug or snake to identify it, track your route, and keep your gear inventory, all with no signal.

The places people need this most are the places with no coverage. Cloud ID apps go blind there. Trailkit runs open-weight models on-device, so it works on the trail, keeps location and photos private, and costs nothing per use.

Built for the DEV Hacktoberfest week 1 challenge, theme "Touch Grass": open-source AI at the core, and the screen is the shortest part of the experience.

## Goals and non-goals

**Goals**

- Every core feature works in airplane mode after a one-time download.
- Species ID result in under 5 seconds on a mid-range phone.
- Safety-first output: danger level and lookalikes, never a bare "safe to eat".
- A full hike leaves behind a mapped journal with no manual entry.

**Non-goals**

- Medical or foraging advice. The app never certifies anything as edible.
- Anything online during the hike. Sharing and sync happen only once you're home.
- Turn-by-turn navigation on unknown trails. Backtrack only follows your own recorded path.
- iOS and Android parity for the hackathon. Ship one platform first.

## Target users and scenarios

| User                       | Need                                            | Scenario                                                                                 |
| -------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Day hiker                  | Know what they're looking at, find the way back | Spots a snake on a switchback, snaps it, gets "venomous lookalike, keep 2 m distance"    |
| Backpacker / survival trip | Gear accountability over days                   | Lays out gear before leaving, app flags no water filter; logs fire starter used on day 2 |
| Curious walker / family    | Learn while outside                             | Builds a journal of 15 species on a weekend walk, reviews the map at home                |

## App structure

Three tabs: Start and Settings work fully offline; Community is the only screen that needs a connection.

| Tab       | What's on it                                                                                                                          | Offline               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Start     | Home. Start or resume a hike, camera for field ID, live map and track, journal, gear check, past trips                                | Yes                   |
| Community | Feed of shared trail recaps: route map, elevation profile, snaps along the route, species found, stats. Post your own recap once home | No, syncs when online |
| Settings  | Model downloads and storage, offline map regions, units, safety disclaimer, community profile                                         | Yes                   |

## Features

Five features, P0 is the hackathon demo; P1 ships if time allows.

| Feature             | What it does                                                                                                                                      | Priority        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Field ID            | Photo of plant, insect or snake → species, confidence, danger level, lookalikes, what to do                                                       | P0              |
| Trail tracking      | Background GPS breadcrumb every 10–20 m; distance, elevation gain, pace; offline map                                                              | P0              |
| Field journal       | Each sighting pinned on the track with photo, time and ID; trip summary at the end                                                                | P0              |
| Gear check          | One photo of laid-out gear → inventory, checked against a survival checklist, missing items flagged                                               | P1              |
| Backtrack           | Guide back along your own recorded track to the trailhead or a saved pin                                                                          | P1              |
| Trail recap + share | Back home: route map, elevation profile, snaps pinned along the route, species found, stats; posted to the Community feed, like a workout summary | P2, last 3 days |

**Field ID flow**

1. User captures a photo in-app (GPS and time saved with it).
2. BioCLIP classifies the species and returns top-5 with scores.
3. The VLM receives the top candidates plus the image and writes a short card: what it is, danger level, lookalikes, action.
4. The sighting is saved to the journal and pinned on the track.

**Gear check flow**

1. User photographs gear before the trip.
2. VLM returns a JSON list of detected items; user confirms or edits.
3. Inventory is diffed against a checklist (water, fire, light, first aid, navigation, shelter, food, tools, sun protection, insulation).
4. During the trip, user marks items used or lost.

## Safety requirements

The app never tells anyone a wild plant or fungus is safe to eat. Misidentification can kill, and deadly lookalikes exist for common edibles (water hemlock and wild carrot, death camas and wild onion).

- No "edible" verdict. Edibility shows as "Do not eat without expert confirmation" with known lookalikes listed.
- Danger levels for animals: Harmless, Caution, Dangerous. Unknown or low-confidence defaults to Caution.
- Confidence below 60% shows "Uncertain" and the top 3 candidates, not a single answer.
- Snake and spider cards always include a distance rule and "if bitten" first steps, plus local emergency number.
- The VLM may only explain species BioCLIP returned. It cannot introduce a new ID.
- Disclaimer on first launch and on every edibility-related card.

## Technical architecture

&#91;embedded content: Trailkit architecture · all on-device\]

BioCLIP picks the species; Gemma 3n only explains what BioCLIP returned; the safety layer filters every card before it reaches the screen.

Only the Community tab goes online: after the hike, the app talks directly to Supabase (Postgres + PostGIS for recaps, Storage for snaps, anonymous auth). No custom server.

| Layer             | Choice                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| App               | React Native (Expo dev build), Android first                                         |
| Species ID        | BioCLIP via onnxruntime-react-native                                                 |
| Language + vision | Gemma 3n via llama.rn (GGUF, quantized)                                              |
| Location          | expo-location background task, MapLibre RN with offline OSM tiles                    |
| Storage           | expo-sqlite                                                                          |
| CI                | GitHub Actions builds the APK                                                        |
| Community         | Supabase: Postgres + PostGIS, Storage for photos, anonymous auth with a display name |

## Partner technology

Gemma is the core; two cheap add-ons ride along; the rest are skipped because the stack doesn't need them; the Community feed runs on open-source Supabase instead.

| Partner                                                                                  | How Trailkit uses it                                                                                                                                                                                  | Effort          | Decision                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| Gemma ($200)                                                                             | Gemma 3n on-device via llama.rn writes every ID card and parses gear photos                                                                                                                           | Already planned | Core                                                       |
| Entire ($100)                                                                            | Entire CLI captures every coding-agent session as checkpoints linked to commits; link them in the write-up to explain why code exists. Separate from DevRelay, which embeds a session in the DEV post | Low             | Yes                                                        |
| GitHub Copilot ($100)                                                                    | Copilot builds each planned task in its own session; GitHub Actions builds the APK on every release tag                                                                                               | Low             | Yes                                                        |
| Tinker ($200)                                                                            | Fine-tune the card-writing model on curated species and safety data; show accuracy vs. baseline                                                                                                       | High            | Stretch, if Tinker supports a small enough model to export |
| Sentry Agent Tracing ($100)                                                              | Trace on-device model latency, uploaded when back online                                                                                                                                              | Medium          | Maybe                                                      |
| Render, DigitalOcean, MongoDB, Temporal, SerpApi, Tiger Data, Mastra, Backboard, Arduino | Need a server, live internet or extra hardware                                                                                                                                                        | —               | Skip                                                       |

## Data model

All data lives in on-device SQLite. Four tables, one trip owns everything.

| Table       | Key fields                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| trip        | id, name, started_at, ended_at, distance_m, elevation_gain_m                                                                    |
| track_point | id, trip_id, lat, lng, altitude_m, accuracy_m, recorded_at                                                                      |
| sighting    | id, trip_id, photo_uri, lat, lng, taken_at, kind (plant / insect / snake / other), species, confidence, danger_level, card_json |
| gear_item   | id, trip_id, name, category, status (packed / used / lost), source (detected / manual)                                          |

## Success metrics

The demo succeeds if one real hike runs end to end in airplane mode.

| Metric                              | Target                               |
| ----------------------------------- | ------------------------------------ |
| Works fully offline                 | 100% of P0 features in airplane mode |
| ID latency (BioCLIP + card)         | < 5 s on a mid-range Android         |
| Top-1 ID accuracy on 30 test photos | ≥ 70%; top-5 ≥ 90%                   |
| Battery use, 3 h hike with tracking | < 20%                                |
| Unsafe outputs ("edible" verdicts)  | 0                                    |
| Real hike completed for the writeup | 1, with journal and map in the post  |

## Build workflow

Claude Code plans, GitHub Copilot builds, and every session is logged.

1. Claude Code turns this PRD into tasks (GitHub issues), one vertical slice each.
2. Each task gets its own Copilot conversation and PR.
3. Entire captures every session as checkpoints linked to the commits.
4. The planning session and one or two hard tasks are embedded in the DEV post via DevRelay.

## Milestones

Six phases in order; the submission deadline is still to confirm on the challenge page.

1. **Spike:** BioCLIP running via ONNX on a phone, Gemma 3n running via llama.rn, both offline. Go/no-go on latency.
2. **Field ID:** camera → BioCLIP → Gemma card, with safety rules enforced.
3. **Trail + journal:** background GPS, offline map, sightings pinned on the track.
4. **Gear check (P1):** photo → inventory → checklist diff.
5. **Touch grass:** take it on a real hike and capture the track, snaps and screenshots.
6. **Last 3 days, recap + share (P2):** recap page from that hike, then write the post with the submission template.

## Risks and open questions

| Risk                                                                   | Mitigation                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| App + models exceed phone storage (VLM \~2–3 GB, BioCLIP \~300–600 MB) | Download models on first run over Wi-Fi; offer a smaller VLM tier           |
| Two runtimes (llama.rn + ONNX) cause memory pressure                   | Load one model at a time; unload the VLM after each card                    |
| BioCLIP weak on regional species (e.g. Indian snakes)                  | Test on a local photo set early; show top-5 and "Uncertain" below threshold |
| Background GPS killed by battery savers                                | Foreground service with persistent notification on Android                  |
| GPS altitude noise inflates elevation gain                             | Smooth with a moving average; ignore changes under 3 m                      |

- [ ] Android only, or Android + iOS?
- [ ] Gemma 3n E2B or E4B? Decide on latency after the spike.
- [ ] Offline map tiles: bundle a region or download per trip?
- [ ] Confirm the challenge submission deadline.
