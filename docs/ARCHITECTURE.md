# How Calorness is put together

A map for anyone reading the code (including future you).

## The big picture

```
Phone (installed web app)
  │  pages and buttons (React, Tailwind)
  ▼
Next.js on Vercel
  ├─ src/app/…            pages (server components) + server actions ("use server")
  ├─ src/app/api/…        HTTP endpoints for things outside the app (phone shortcuts, cron, push)
  └─ src/lib/…            the actual logic, no UI
        │
        ├─ Postgres (Neon) through Prisma          ← all user data
        ├─ USDA FoodData Central, Open Food Facts  ← food search (results cached a week)
        └─ Claude API                              ← photos, labels, describe, Coach
```

**Rule of thumb:** pages and actions stay thin. They check who's signed in, validate input with zod, call
something in `src/lib`, and return. Anything with real logic lives in `src/lib` where it can be unit tested.

## Folders

| Folder | What's in it |
| --- | --- |
| `prisma/schema.prisma` | Every table, with comments. Start here to understand the data. |
| `prisma/migrations/` | SQL history. Applied automatically on each deploy. |
| `prisma/seed.mjs` + `prisma/data/` | Exercise library, loaded on each deploy (safe to re-run). |
| `src/app/(app)/` | Signed-in screens: `log` (Quick log), `train`, `diary`, `progress`, `profile`, `coach`, `admin`. Each folder has its `page.tsx`, a `loading.tsx` skeleton, and `actions.ts` for its server actions. |
| `src/app/api/` | `quick-log` and `bodyweight` (phone shortcuts, key auth), `push/rest` (rest timer alerts), `cron/reminders` (daily nudge), `auth` (sign-in). |
| `src/components/` | UI pieces, grouped by area: `train/`, `diary/`, `log/`, `charts/`, `motion/`. |
| `src/lib/fitness/` | Pure math: 1RM, volume, PRs, BMR/TDEE, macros, units, progression targets, dates. |
| `src/lib/nutrition/` | Food: outside sources (`sources.ts`), normalizing their data (`normalize.ts`), search ranking (`search.ts`, `searchText.ts`), data quality (`quality.ts`), diary queries (`diary.ts`). |
| `src/lib/ai/` | Claude: meal photos and labels (`foodVision.ts`), checking answers (`parse.ts`), matching to real foods (`ground.ts`), Coach (`coach.ts`). |
| `src/lib/` (top level) | Auth, database client, push notifications, AI limits, API keys, time zones, templates. |

Tests sit next to the code they test (`*.test.ts`) and run with `npm test`. End-to-end smoke tests in `e2e/` click through the real app in a browser (`npm run e2e`); CI runs both on every pull request, the end-to-end ones against a throwaway Postgres.

## Patterns worth keeping

- **Instant screens:** the Diary keeps each day's data on the phone and refreshes it in the background (`DiaryView`); changes show immediately and save behind the scenes.
- **Nothing ticks the whole screen:** clocks and timers live in their own small components (`components/train/logger/clock.tsx`), and each exercise in the workout logger is a memoized block, so typing a rep doesn't re-render every set.
- **One read per request:** `requireUser` and `getUserPrefs` are wrapped in React `cache()`.
- **Errors are contained:** `app/(app)/error.tsx` replaces a broken screen (tab bar still works), `global-error.tsx` covers the shell, `not-found.tsx` handles bad links.
- **Sign-in is rate limited:** 8 wrong passwords for one email locks it for 15 minutes (`lib/throttle.ts`).

## How a food search works

1. `FoodAdder` (screen) calls `searchFoods` (server action) twice: `local` for instant results, `all` for everything.
2. `findFoods` in `src/lib/nutrition/search.ts` gathers candidates from:
   - your foods and foods already saved in the app (indexed `search_key` column, so it stays fast as the table grows),
   - what you and other people picked for this search before (`SearchPick`),
   - USDA and Open Food Facts (through a 7-day `SearchCache`).
3. Every candidate goes through `normalize.ts` (impossible entries are dropped) and gets a score: name match (typo-tolerant), source trust, your past picks, community picks, data-quality penalty.
4. Duplicates collapse into one result per food (`groupKey`).

**To add a new food source:** write a `searchX(query)` in `sources.ts` that returns `FoodCandidate[]` (normalize it the same way), wrap it with `cached(...)`, add it to the `Promise.all` in `findFoods`, and give its source a trust bonus. Check the provider's terms on storing data first.

## How the database grows

| Data | Who sees it | Why |
| --- | --- | --- |
| USDA / Open Food Facts foods someone logged | everyone (saved once, reused) | public data |
| Label scans | everyone (`shared`) | copied from a printed label, so verified |
| Foods people type in by hand | only that person, until 2+ different people agree; then a shared COMMUNITY food is made from the median | agreement between independent people filters out typos (`lib/nutrition/consensus.ts`) |
| AI estimates | only that person | estimates, not facts |
| Corrections to AI estimates | pooled as ratios per food | 3+ people correcting the same way nudges future estimates (`lib/ai/corrections.ts`) |
| Search picks | counts are pooled | "what most people pick for 'chickfila'" improves ranking without sharing anyone's data |

## Scaling notes

- **Search** uses a trigram index on `search_key` (Postgres `pg_trgm`), so lookups stay fast past millions of foods.
- **Outside APIs** are cached for a week per query, so a popular search costs one API call per week, not one per person.
- **AI** has a per-person daily allowance (`AI_DAILY_LIMIT`) and every call is recorded in `AiCall`, which `/admin` turns into a cost estimate.
- **Pages** do their database queries in parallel, and every tab has a loading skeleton.
- **Next steps when there are many users:** move the daily reminder to a queue, add rate limiting at the edge, and add a nightly job that pre-computes Progress charts.
