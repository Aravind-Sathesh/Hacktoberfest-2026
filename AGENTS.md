# AGENTS.md

Instructions for coding agents (GitHub Copilot and others) working in this repo.

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

A clean, minimal app UI that uses **JetBrains Mono** as its typeface. It should not look like a terminal: no brackets, no ASCII art.

- Dark theme only. Rounded cards (`Card`), filled/outline buttons (`Button`), label-left/value-right stat rows (`Stat`). All of these live in `src/ui.tsx`; reuse them.
- Icons: Feather from `@expo/vector-icons` only. Keep them minimal.
- Touch targets must be at least 44dp, and icon-only buttons need an accessibility label.
