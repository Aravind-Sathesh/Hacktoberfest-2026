# AGENTS.md

Instructions for coding agents (GitHub Copilot and others) working in this repo.

## Project

**cf-buddy** is an Android app (Expo / React Native) built for one person: Rajeev Kasyap ([ksrkasyap](https://codeforces.com/profile/ksrkasyap)), whose goal is Codeforces 1800 by Dec 31, 2026. It plans his daily problems, runs Forest-style focus sessions (leave the app and the tree dies), and uses **on-device Gemma** for graded hints during focus and roasts. Problem picking is plain code.

- **Product spec and source of truth:** [IDEA.md](IDEA.md). Read it before starting any task.
- **Challenge context:** [PROBLEM.md](PROBLEM.md) (DEV Hacktoberfest Weekend Challenge, due Mon Oct 5, 06:59 UTC).

## Roles

- **Planner:** Claude Code. Writes the spec and the task breakdown and reviews the work.
- **Implementer:** you. Build exactly the task you were given. If the spec is unclear or seems wrong, stop and ask. Don't invent features.

## Hard rules

1. **Never commit unless the user explicitly says so.** Leave the changes in the working tree.
2. When told to commit, use **one-line Conventional Commits, all lowercase, and no co-author trailer or other trailers.**
   - Good: `feat: add focus session tree`, `fix: handle cf rate limit`, `chore: add jetbrains mono`
   - Bad: `Feat: Add Focus Session`, multi-line bodies, `Co-Authored-By: ...`
3. **Do not use the DevRelay MCP tools** (`devrelay-gateway`, any `mcp__devrelay*` tool, or devrelay skills). The planner owns everything DEV/MLH related.
4. **Privacy invariants. These are non-negotiable:**
   - Calendar: keep only `{ start, end }` busy blocks. Event titles, notes, locations and attendees must never be stored, logged, or passed to Gemma. Drop them in the function that reads the calendar.
   - Gemma runs **on device** (`llama.rn`). No cloud LLM calls, ever.
   - No backend, analytics, or telemetry.
5. **No notifications.** Rajeev explicitly said no. Don't add `expo-notifications`.

## Clean code (priority)

- TypeScript `strict`. No `any`, no `@ts-ignore`.
- Small, pure functions for the logic (plan math, problem filtering, busy-block math). Keep side effects (CF API, calendar, `llama.rn`, AsyncStorage) at the edges, in thin modules.
- Use clear names over comments. Comment only the *why*.
- No speculative abstractions: no interface with one implementation, no config for values that never change, and no "for later" scaffolding.
- Don't add a dependency for something a few lines can do. Ask before adding any new one.
- Handle errors at the edges. If CF is down or Gemma fails to load, show a one-line message. The app must never crash.
- Every non-trivial pure function gets one focused test (`jest-expo`). Don't write tests for trivial code.
- Match the code that's already here before inventing a new pattern.

## Stack

- Expo SDK (latest), **dev build** (no Expo Go), TypeScript, Android only.
- `llama.rn` + a small Gemma GGUF downloaded on first launch.
- `expo-calendar` (read only), `expo-keep-awake` (the phone sits beside his PC during focus), `AppState` (tree death), AsyncStorage, `@expo/vector-icons`.
- Font: **JetBrains Mono** (`@expo-google-fonts/jetbrains-mono`) everywhere.

## Codeforces API

- Base: `https://codeforces.com/api/`. Public, no auth.
- **Rate limit: at most 1 request per 2 seconds.** Route every call through one client that enforces this.
- Endpoints used: `user.info`, `user.rating`, `user.status`, `problemset.problems` (cache for 24h), `contest.list`.
- "Solved" means a submission with `verdict === "OK"`. Nothing else counts.

## UI

A clean, minimal app UI that uses **JetBrains Mono** as its typeface. It should not look like a terminal: no brackets, no ASCII art.
- Dark theme only. Rounded cards (`Card`), filled/outline buttons (`Button`), label-left/value-right stat rows (`Stat`). All of these live in `src/ui.tsx`; reuse them.
- Icons: Feather from `@expo/vector-icons` only. Keep them minimal.
- Today shows **one problem at a time** (start focus / skip), then the stats dashboard, then the streak grid.
- Focus is a **full-screen tree** (`src/Tree.tsx`, drawn with plain views) with a timer and a stack of hint cards (`src/HintStack.tsx`: hold to reveal the next, swipe back through seen ones). No chat. He solves on his PC, so the app never shows the problem.
- The accent color, goal and show/hide tags come from Settings. Never hardcode Rajeev's handle, rating or goal in the UI.
- Touch targets must be at least 44dp, and icon-only buttons need an accessibility label.

## Prompts (Gemma)

- Plain code computes the numbers: targets, ratings, busy blocks, and candidate problems. Gemma only **chooses from given options** and **writes short text**. It never invents problems or numbers.
- Tone: roasts like a friend, hints like a calm senior mentor. A hidden WebView (`src/EditorialLoader.tsx`) fetches the problem's editorial with all code stripped; when focus starts, Gemma turns it into **4 graded hints** in the background (vaguest first, never code or the final formula). The first two only point, so they're dropped if they name a tag or recite the editorial.
- Prototype prompts on the Mac using Ollama `gemma4:12b`, then verify them on the small on-device model.
