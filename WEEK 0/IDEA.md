# Idea: cf-buddy (working name)

> Built for **Rajeev Kasyap** ([ksrkasyap](https://codeforces.com/profile/ksrkasyap)), who wants his Codeforces rating at **1800 by Dec 31, 2026**.
> He's at **1097** today (peak 1237), so that's **+703 in ~90 days**.
> His words: distraction is what kills his practice. So it's a focus buddy: a Forest-style tree grows while he solves, dies if he leaves the app, and on-device Gemma roasts him like a senior who's seen it all.

## Challenge fit

**Challenge:** Hacktoberfest Weekend Challenge — _Build for a Friend_ (DEV, HF26 challenge 1 of 5)
**Deadline:** Mon Oct 5, 12:29 PM IST (06:59 UTC). Today is Fri Oct 2.
**Required:** open-source AI at the core, plus a DEV post tagged `#devchallenge #weekendchallenge #hf26challenge`.

**Judging, in weight order:**

1. **Writing quality (weighted most).** The post _is_ the submission. The code is evidence.
2. Relevance to the theme: one real person (Rajeev), a concrete goal (1800), and his reaction after we hand it over.
3. Creativity
4. Technical execution
5. Partner tech (optional)

**Why open matters (the post's thesis):** Gemma runs **on Rajeev's phone**. His calendar (busy/free only, his rule), his schedule and his practice habits never leave the device. Running it costs nothing, it works on a train with no signal, and since it's open-weight we could fine-tune it on his own submission history later. A closed API would need his calendar on someone else's server.

## Prize targets

| Prize                          | $   | Plan                                                                                                          |
| ------------------------------ | --- | ------------------------------------------------------------------------------------------------------------- |
| Overall winner                 | 250 | A real friend, a real goal, a good post, and his reaction                                                     |
| **Best Use of Gemma**          | 200 | **On-device Gemma** plans the day, picks problems, roasts, and gives one-line hints from the constraints |
| **Best Use of GitHub Copilot** | 100 | Build with Copilot. **GitHub Actions** builds the APK on every tag and attaches it to a Release (the download link) |
| Best Use of Entire | 100 | Skip. Entire is its own session-capture tool; a DevRelay embed probably doesn't count, and prizes don't stack anyway |
| Sentry Agent Tracing           | 100 | Stretch: trace on-device inference latency and tokens                                                         |

**Rule: one win per participant per challenge.** Prizes don't stack, so the extra categories are just more chances at a single win. Gemma ($200) and overall ($250) are what we aim for.

Render is dropped because there is no backend to host. That's a feature: it's part of the privacy story.

## The product

### Data: the Codeforces API does the heavy lifting

The API is public, needs no auth, and is limited to 1 request per 2 seconds.

| Endpoint                       | Use                                                                      |
| ------------------------------ | ------------------------------------------------------------------------ |
| `user.info?handles=ksrkasyap`  | current rating                                                           |
| `user.rating?handle=`          | rating history → progress toward 1800                                    |
| `user.status?handle=&count=50` | recent submissions → what was solved today (verdict `OK`), and weak tags |
| `problemset.problems`          | the problem bank: every problem with `rating` + `tags`. Cache it daily   |

No bundled problem list and no honor system: solved means CF says `OK`.

**How problems get picked** (plain code, not the LLM): filter to rating `[current+100, current+300]`, matching the chosen tag, and not already solved. Gemma only chooses _from_ that list and explains the choice, so it can never invent a problem.

### What Rajeev said → what changed

| He said | So we |
|---|---|
| In-person distraction is what kills his practice | **Focus mode (Forest-style):** a solve session grows a tree. Leave the app and it dies. This becomes the core feature |
| **No notifications** | Drop all push and local notifications and the cron jobs. The app is pull-only: he opens it, it plans |
| 4 problems / 2.5h on weekdays, 6 / 4h on weekends | These are the default daily targets. The calendar only reduces them |
| Calendar isn't complete (classes missing), but he's free most of the time | Read busy/free only. He'll add his classes |
| Read busy/free only, not event titles | Titles are dropped right after reading the calendar. Gemma only sees `[{start,end}]` |
| Can't do advanced dp/trees; likes math and observations from constraints | Warm up with math/constructive, and feed dp/trees in at gentler ratings (1800 needs them) |
| Hints should be a very mild nudge | One-line nudges only, never the approach |
| Does most contests | Plan around `contest.list`: light day before a contest, upsolve the day after |
| Tone: roaster, but senior-mentor hints | Roasts for leaving or skipping, calm mentor voice for hints |

### Daily loop (pull, not push)

1. **Open app → today's plan.** Plain code works out the target (weekday 4 or weekend 6, minus busy blocks, contest-day adjusted) and the candidate problems (`[rating+100, rating+300]`, unsolved). Gemma picks the mix and writes one roast-y line about it.
2. **Start focus → full-screen tree.** He solves on his PC. The phone sits beside him, awake, while a tree grows over 45 minutes, and he can chat with Gemma when stuck.
3. **Leave the app → the tree dies** (an `AppState` change to `background`, after a ~10s grace period for a quick glance at a message). Next time he opens the app, Gemma roasts him about it.
4. **Solved = CF says `OK`.** During a session, poll `user.status?count=5` every 60s (well inside the rate limit). On `OK`, the tree is fully grown and the next problem is up.
5. **Stuck → chat.** He tells Gemma where he's stuck, and Gemma replies with a mild nudge of at most two sentences ("what does n ≤ 20 let you afford?"). Replies that name the problem's tags are rejected.
6. **Contests:** contest day = 2 warm-ups. The day after = upsolve the problems from that contest he didn't get `OK` on.
7. **Dashboard:** stat rows (rating, goal, to go, days left, solved/free/focused today, streak, best streak, trees grown/lost) and a 16-week streak grid.

### No crons, no server

Rajeev doesn't want notifications, so the cron/notification design is cut. Everything happens when he opens the app: CF API calls, the calendar read and Gemma all run on the phone. There's no backend, no push tokens and nothing scheduled.

## Stack

- **App:** Expo **dev build** (native modules mean Expo Go won't work). `expo-calendar`, `expo-keep-awake`, `AppState`, AsyncStorage, `@expo/vector-icons` (Feather). No notifications.
- **On-device model:** `llama.rn` (llama.cpp for React Native) + **Gemma 4 E2B instruct, QAT 4-bit** (`unsloth/gemma-4-E2B-it-qat-GGUF`, UD-Q4_K_XL, ~2.6 GB). The user downloads it with an explicit button, never automatically on mobile data.
- **Dev loop on the Mac:** Ollama `gemma4:12b` (installed) for iterating on prompts quickly. Then re-check the same prompts on the small phone model. The LLM's job stays small (choose, explain, chat) because plain code does the rating, gap and filter math. That keeps a 1B–4B model reliable.
- **UI:** a clean, minimal app UI with **JetBrains Mono** (`@expo-google-fonts/jetbrains-mono`) as the typeface, not a terminal look. Dark only: rounded cards, minimal Feather icons, one accent color chosen in Settings.

```
cf-buddy                    rating 1097 → 1800
────────────────────────────────────────────
sat · 6 problems · 4h · div2 tomorrow
  [x] 1200  math     ....   🌲 34m
  [x] 1300  constr   ....   🪦 left at 12m
  [ ] 1300  dp       ....
  ...
"left mid-problem again. the problem didn't leave, you did."
[ hint ]
```

## Deployment / demo link

Expo Go and web links won't work, because `llama.rn` and the calendar are native. Options:

- **Android:** EAS Build `--profile preview` produces an **APK with a public install link + QR code** on expo.dev. We also attach the APK to a GitHub Release. This is our "deployment link".
- **iOS:** EAS internal distribution needs registered device UDIDs and a paid Apple dev account, or TestFlight (review delay). Not viable for judges.
- **For judges:** the APK link + a demo video in the post + the repo. Judges won't install an app, so the video carries the demo.

## Weekend plan

- **Fri:** Expo dev build running on a phone; CF API client (`user.info`, `user.status`, `problemset.problems`); calendar → busy blocks (titles dropped); focus session with the full-screen tree + AppState tree death. Draft prompts on Mac Ollama.
- **Sat:** `llama.rn` + Gemma on device; daily plan, problem picker, roasts, one-line hints; contest-aware planning; GitHub Actions APK release → install link. **Hand it to Rajeev Saturday night.**
- **Sun:** Rajeev uses it for a day; capture his reaction and quotes; record the demo; write the DEV post; embed agent sessions; submit before Mon 12:29 PM IST.

## Open questions

- ~~iOS or Android?~~ **Android**, so we ship an EAS APK install link. iOS is out of scope.
- Talk to Rajeev for his input (see below).
- Later: a friends feed (both handles, a shared feed, "how's Rajeev doing?"). Cut for the weekend.
- On-device model size vs. phone RAM: try the smallest Gemma first and only go bigger if quality is bad.

## Questions for Rajeev

His answers shape the defaults, and his quotes go straight into the post.

1. What stopped you last time you tried to practice regularly? (busy, bored, stuck, no plan?)
2. When do you actually have free time on a normal day? Is your calendar accurate, or are your gaps not on it?
3. How many problems a day feels doable vs. annoying? Weekdays vs. weekends?
4. Which topics do you avoid? Which do you enjoy?
5. Notifications: how many a day before you'd mute the app? Any quiet hours?
6. When you're stuck, do you want a hint, the editorial, or to be left alone?
7. Do you do live contests (Div 2/3)? Should the app plan around them? (Contest calendar: `contest.list`)
8. Which tone? Chill friend, strict coach, or roast-me?
9. Is anything off-limits? (e.g. reading your calendar event titles vs. only busy/free)
10. Can we quote you and use your handle in a public DEV post?

## Answers from Rajeev

1. Distraction - in person [Proposal: Keep APP open while solving, kind of like that forest app, which grows a tree when you focus and which destroys it if you leave your task]
2. ⁠No - But he’s free most of the time. He's not added his classes to his calendar, but if he does, it will be accurate.
3. ⁠4 doable / 2.5hr - weekdays , weekends 6 / 4hrs
4. ⁠Doesnt avoid any / cant do advanced dp or trees / enjoy math heavy or observations via constraints
5. ⁠no notifications
6. ⁠stuck - hint depth should be very very less - mild nudge
7. ⁠Yes, most contests
8. ⁠Roaster / Coach type - Roasting but Senior mentor type hints
9. ⁠Read only busy/free, not events
10. ⁠Yes he's fine
