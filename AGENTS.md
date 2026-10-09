# AGENTS.md

Instructions for coding agents (Antigravity / agy and others) working in this repo.

## Project

- **Product spec and source of truth:** [IDEA.md](IDEA.md). Read it before starting any task.
- **Challenge context:** [PROBLEM.md](PROBLEM.md)

## Roles

- **Planner:** Claude Code. Writes the spec and the task breakdown and reviews the work.
- **Implementer:** you. Build exactly the task you were given. If the spec is unclear or seems wrong, stop and ask. Don't invent features.

## Hard rules

1. **Never commit unless the user explicitly says so.** Leave the changes in the working tree.
2. When told to commit, use **one-line Conventional Commits, all lowercase, and no co-author trailer or other trailers.**
   - Good: `feat: add focus session tree`, `fix: handle cf rate limit`, `chore(font): add jetbrains mono`
   - Bad: `Feat: Add Focus Session`, multi-line bodies, `Co-Authored-By: ...`
3. **Do not use the DevRelay MCP tools** (`devrelay-gateway`, any `mcp__devrelay*` tool, or devrelay skills). The planner owns everything DEV/MLH related.
4. **Privacy invariants. These are non-negotiable:**
   - Gemma runs **on device** (`llama.rn`). No cloud LLM calls, ever.

## Session logging (DevRelay)

Every task conversation may be published on DEV as part of the challenge write-up. The planner handles uploads with DevRelay; you never call it (see Hard rule 3). Your job is to keep each session clean enough to publish.

- **One task per conversation.** Start the first message with the task ID and title, e.g. `task 07: field id card`. Don't mix tasks or carry one over into another chat.
- **Assume it's public.** Never paste API keys, tokens, `.env` contents, personal locations or real GPS tracks. Use fixtures from `test/fixtures/` instead.
- **Explain decisions in the chat, not just in code.** When you pick an approach or reject one, say why in one line. Judges read these sessions to understand the build.
- **End with a summary** in this exact shape so the planner can tag and submit the session:
  `done: <task id> · files: <changed files> · tests: <pass/fail> · notes: <open issues or none>`
- **Keep failed attempts.** Don't restart a conversation to hide a dead end; the debugging is part of the story.

## Clean code (priority)

- TypeScript `strict`. No `any`, no `@ts-ignore`.
- Small, pure functions for the logic (plan math, problem filtering, busy-block math). Keep side effects at the edges, in thin modules.
- Use clear single line comments, only if needed. Comment only the _why_.
- No speculative abstractions: no interface with one implementation, no config for values that never change, and no "for later" scaffolding.
- Don't add a dependency for something a few lines can do. Ask before adding any new one.
- Handle errors at the edges. If anything fails to load, show a one-line message. The app must never crash.
- Every non-trivial pure function gets one focused test (`jest-expo`). Don't write tests for trivial code.
- Match the code that's already here before inventing a new pattern.

## UI

WEEK 0 used JetBrains Mono everywhere with a dark theme only; that still applies inside `WEEK 0/`. WEEK 1 (Trailkit) uses its own look:

- Light and dark themes that follow the system setting. Colours come only from the tokens in `WEEK 1/src/theme.ts`; no hex values in screens.
- Trailkit is for everyday hikers, not developers. Write plain words ("Strong match", not "97.3%" or "cosine"), and keep timings, model names and tuning under Settings → For developers.
- Inter only, at the four sizes in the theme (13, 15, 18, 28). No monospace.
- Cards are flat with a hairline border; don't use Android `elevation` on rounded views (it leaves grey slabs).
- Reuse the components in `WEEK 1/src/ui.tsx` (`Text`, `Card`, `Button`, `DangerBadge`, `IconBubble`, `PillNav`) instead of styling raw views. Safety content always comes before descriptive text.
- Danger is always shown as colour **and** a text label, never colour alone.
- Icons: Feather from `@expo/vector-icons` only. No emoji in the UI.
- Touch targets must be at least 44dp (48dp for buttons and tabs), and icon-only buttons need an accessibility label.
