# Contributing

This app is built for one person, so changes start from his feedback. Read [IDEA.md](IDEA.md) and [AGENTS.md](AGENTS.md) first.

## Setup

```bash
npm install
npm run android
```

You need the Android SDK (`ANDROID_HOME`) and a device or emulator.

## Before you push

```bash
npx tsc --noEmit
npm test
```

## Rules

- Commits: one line, Conventional Commits, all lowercase, no trailers (`feat: add focus tree`).
- TypeScript strict: no `any`, no `@ts-ignore`.
- Logic goes in small pure functions with a focused test. Side effects (Codeforces, calendar, model, storage) stay in thin modules at the edges.
- Ask before adding a dependency.
- Calendar data stays `{ start, end }` only. The model runs on the device. No backend, analytics or notifications.
- Codeforces: one request every 2 seconds at most, through `src/cf.ts`.

## Releasing

Push a `v*` tag. GitHub Actions builds the APK and attaches it to a release.
