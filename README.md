# Calorness

**Log the lift. Log the plate.** A mobile-first fitness app that combines
Hevy-style workout logging with MyFitnessPal-style nutrition tracking, so
training and eating work from the same numbers.

[Live demo](https://calorness.vercel.app). Try it with the demo account, no sign-up needed

| Quick log | AI meal photo | Live workout | Diary |
| --- | --- | --- | --- |
| ![Quick log hub](docs/screenshots/quick-log.png) | ![AI estimate review](docs/screenshots/ai-review.png) | ![Live workout logger with autosave and rest timer](docs/screenshots/workout.png) | ![Diary with calorie ring](docs/screenshots/diary.png) |

| Train | Workout summary | Progress |
| --- | --- | --- |
| ![Train tab with weekly plates](docs/screenshots/train.png) | ![Workout summary with personal records](docs/screenshots/summary.png) | ![Muscle map and weekly volume](docs/screenshots/progress.png) |

| Food diary | Adding a food | Barcode scanner | Exercise detail |
| --- | --- | --- | --- |
| ![Diary with calorie ring, macros, and meals](docs/screenshots/diary.png) | ![Food search with amount and macro split](docs/screenshots/add-food.png) | ![Barcode scanner](docs/screenshots/scan.png) | ![Exercise page with 1RM chart](docs/screenshots/exercise.png) |

## Why I built it

My first fitness app, [RoBardsfitnesstracker](https://github.com/zrobards/RoBardsfitnesstracker),
was a React + Vite PWA that stored everything in the browser's localStorage.
It worked for my own training plan, but it couldn't sync between devices,
had my routine hardcoded, and had no nutrition side. Calorness is the rebuild:
real accounts, a Postgres database, user-built routines, and nutrition
tracking that shares data with training.

## Features

**Accuracy**
- Nutrition label scanner: photograph the Nutrition Facts panel and the AI copies the printed numbers exactly, then saves the food for one-tap reuse
- Bad-data check: flags any food whose calories don't match 4×protein + 4×carbs + 9×fat, and ranks those entries lower in search
- Each day shows what share of calories came from verified sources vs. AI estimates, and AI entries are tagged
- Remembers whether you weigh each food in grams or count servings
- Days follow your phone's time zone, so late-night logs and travel never land on the wrong day

**Quick log (the center + button)**
- A step-by-step progress screen (with your photo) shows what the AI is doing while it works, with Cancel
- Snap a photo of a meal, or upload one you already took, and Claude (Anthropic's AI) lists each food with calories and macros
- Each dish is counted once: the AI folds tortillas, garnishes, and sauces into the dish they belong to, and anything it lists as part of another item is dropped instead of double counted
- For unpackaged food, the AI judges the portion and USDA supplies calories per gram, so "1 cup of rice" uses USDA's numbers for rice; photos use Claude Sonnet by default (`AI_VISION_MODEL` to change)
- Label scans are shared (food name and numbers only), so the verified database grows as people use the app
- Community foods: hand-typed foods stay private until two or more different people enter the same food with matching numbers; then a shared version is made from the median values ("Agreed by 3 people"), which ranks higher as more people agree
- The AI learns from corrections: when people fix an estimate, how far off it was for that food is pooled; once three or more people consistently correct the same food the same way, new estimates are nudged by that amount (limited to ±40%) and the review says so
- Describe and photos know your own foods: "two of my usual shakes" logs your saved shake, exactly, twice; one-tap fixes for common misses (bigger, smaller, restaurant-style, homemade, no sauce)
- Packaged foods use real label values: the AI reads the brand and flavor, then Calorness finds the product in your foods, USDA, and Open Food Facts and swaps the guess for the label numbers (or asks you to pick the flavor). A barcode anywhere in the photo is read first for an exact match at no AI cost
- Make the estimate accurate before saving: adjust amounts, edit any item's weight (calories and macros scale with it) or numbers, add foods it missed, or tell the AI what it got wrong ("the chicken was fried, 2 cups of rice") and it re-checks the photo
- Describe a meal in words, or say it out loud with speech-to-text
- Barcode scan and one-tap "log again" for recent foods, with Undo
- Saved meals (save any meal from the Diary, log it again in one tap) and "repeat yesterday's whole day"
- "What fits": foods you actually eat that fit the calories and protein you have left
- Picks the meal from the time of day, shows calories and protein left, and starts your next routine in one tap
- Home-screen shortcuts on Android (long-press the icon): Snap, Scan, Describe, Train
- iPhone Shortcut / widget: tap, take a photo (or dictate), and a notification shows what was logged, without opening the app. Powered by a small API (`POST /api/quick-log`) with per-user keys made in Profile, stored as SHA-256 hashes, revocable, and rate limited

**Training (Hevy-style)**
- Exercise library of 985 exercises, every one with step-by-step instructions: 873 from free-exercise-db plus 109 common gym moves it lacks (Pec Deck, Seated Cable Row, Bulgarian Split Squat, cardio machines…). Added moves reuse photos of the same movement where one exists; the rest show a muscle figure
- Search understands gym slang ("pec deck", "rdl", "ohp") through alias lists
- Create your own exercise in a few taps when something's missing, right from the picker; it gets history, PRs, and the muscle map like any other
- Routine builder: sets, rep ranges, and rest time per exercise
- Programs: seven ready-made plans (Push/Pull/Legs, Upper/Lower, Full Body, Strength 5×5, Machines Only, Glutes & Legs, Home Dumbbells) added to your routines in one tap
- AI program builder: pick a goal, days per week, session length, equipment, experience, and anything to work around; the AI builds the program, then you can rename days, swap or reorder exercises, change sets, rep ranges, and rest, add or remove days, or ask the AI to change it ("make sessions shorter") before saving it as routines
- Coach: saved chats you can go back to (Chats list, New chat), formatted replies, a typing indicator, and whole-program suggestions you can customize or save as is
- Coach: chat with an AI coach that sees your routines, recent workouts, and goals; remembers injuries, goals, and preferences (visible and removable); and can rework a routine around pain or a plateau with one-tap Replace or Save as new. It suggests pain-free alternatives and when to see a professional, never "push through it"
- Live workout logger: previous-session values on every set, warm-up/drop/failure sets
- Next-set targets using double progression: add reps within your range, then add weight once every set hits the top; tap the check to log the target
- Autosaves every set to the phone instantly and to the server within seconds, so closing the app or switching phones loses nothing; the rest timer survives too
- Keeps the screen awake during a workout, with haptic feedback on supported phones
- Lock-screen notifications: "Rest's over" when you leave the app mid-rest, plus a lunchtime nudge if nothing's logged (Web Push with app-generated VAPID keys and a daily Vercel Cron)
- Automatic weigh-ins: an iPhone Automation sends your latest Apple Health weight to `POST /api/bodyweight`
- Edit a finished workout's sets, or reopen one you ended too early
- Rest timer that starts when you check off a set, with ±15s and vibration
- Automatic personal records: heaviest weight, best estimated 1RM, best set volume
- Exercise pages with your history and an estimated-1RM progress chart

**Cardio and activities**
- Log 65+ activities: running, walking, incline treadmill, cycling, swimming, rowing, stair climber, HIIT, rock climbing and bouldering, basketball, soccer, pickleball, hacky sack, yoga, dancing, skiing, yard work, and more, or name your own
- Calories burned use the most accurate method your inputs allow: heart rate (Keytel equation) > pace and incline (ACSM walking/running equations) > MET × weight × time (Compendium of Physical Activities), personalized with weight, height, age, and sex
- Only calories above resting count toward your day (your goal already covers rest), with a "credit" setting (0/50/75/100%) because trackers tend to overestimate
- The Diary shows goal + exercise − food = remaining; extra calories go about 70% to carbs and 30% to fat, protein stays put. Lifting sessions are estimated from their length

**Music**
- Paste a link from YouTube Music, Spotify, Apple Music, or SoundCloud (playlist, album, or song); Calorness looks up its name and plays it in that service's own embedded player
- The player lives in the app layout, so music keeps playing while you switch tabs; it shrinks to a mini player or expands, without restarting
- Saved music is one tap away from Train and the workout screen

**Progress**
- Tappable muscle map: pick a muscle (on the body or the list) to see every set that counted toward it, with the main/helper split, for this week, the last 7 days, or last week
- Muscle map: sets per muscle over the last 7 days, front and back
- Weekly volume for the last 8 weeks, best lifts, bodyweight trend
- Calories eaten over the last 7 days against your goal

**Nutrition (MyFitnessPal-style)**
- Food search across USDA FoodData Central (generic, restaurant/FNDDS, and branded foods) and Open Food Facts, plus your own foods
- Forgiving search: ignores dashes, apostrophes, and spacing, knows ~50 restaurant and brand spellings ("chickfila" → Chick-fil-A), and tolerates a typo
- One result per food: duplicate crowd-sourced entries ("Chick-fil-A Sauce" ×5 with different numbers) collapse into the one closest to the group's typical values
- Search memory: whatever you pick for a search ranks first next time, even your own foods; new foods created from a search start with its brand and name filled in, and your own foods can be edited
- Your foods and saved foods appear instantly while USDA and Open Food Facts fill in
- Gets smarter with use: outside results are cached for a week, and what people pick for a search (counts only) nudges ranking for everyone
- Built to scale: a trigger-maintained, trigram-indexed search key keeps fuzzy food search fast past millions of rows
- Owner-only `/admin` page: accounts, food database by source, top searches, most logged foods, AI usage and estimated cost
- Bad database entries are filtered out: anything over ~900 cal per 100 g, more than 100 g of macros per 100 g, or calories far from what the macros add up to; whole-package servings are labeled "big serving"
- Barcode scanning with the phone camera (native BarcodeDetector, with a WebAssembly fallback for iPhone)
- Log by servings or by grams/ml, with a live calorie count and macro split
- Daily diary by meal with a calorie ring and macro bars; tap any entry to edit or delete it
- Recent foods, custom foods (with barcodes that scan next time), and copy a meal from yesterday
- Water tracking by the glass
- Training-day callout in the diary when you worked out, linking to that workout
- Calorie and macro targets calculated from your stats (Mifflin–St Jeor + activity level + goal), then editable by hand, with a check that your macros add up to your calories

**Feel**
- Every tab shows a shaped loading screen the instant you tap (about 0.15 s), then fills in; numbers only animate when they actually change
- Motion throughout: count-up numbers, a calorie ring that draws in, bars and charts that grow, cards that rise in, page crossfades (React View Transitions), and a burst of tiny bumper plates when you finish a workout
- Everything respects the phone's "reduce motion" setting

**Sharing**
- Invite a friend: opens the phone's share sheet with the link and install steps, plus a QR code for showing someone in person
- Built for more than one person: private accounts, a daily AI allowance per person (`AI_DAILY_LIMIT`, default 25) to keep costs predictable, a first-run prompt to set targets, a plain-language privacy page, and self-serve account deletion

**General**
- Sign in with email and password (bcrypt-hashed), GitHub, Google, or a shared demo account; stay signed in for 90 days
- GitHub users can add a password in Profile to sign in on the phone app
- Sign-in works inside the iPhone home-screen app too: it hands off to a browser window and matches a 4-digit code, since home-screen apps keep separate cookies
- Pounds/feet or kilograms/centimeters
- Installable to your phone's home screen (PWA)

**Roadmap**
- [x] Exercise library, routines, live workout logging, rest timer, PRs
- [x] Progress charts: muscle map, weekly volume, best lifts, bodyweight
- [x] Food search (USDA + Open Food Facts), barcode scanning, custom foods, recent foods, water
- [x] Calories vs. goal chart on the Progress tab
- [ ] Recipes and saved meals
- [ ] Custom exercises and supersets in the logger
- [ ] Training-aware nutrition: targets that adapt to training volume and weight trend
- [ ] Time zone setting (dates currently display in US Eastern)
- [x] Quick log hub, AI photo/describe logging, workout autosave and editing
- [x] Label scanner, data-quality checks, verified share, time-zone-correct days
- [x] Progression targets, saved meals, "what fits", Apple Health weigh-ins, notifications
- [ ] Adaptive calorie targets from your weight trend
- [ ] A true home-screen widget and full Apple Health sync (needs a native app)
- [ ] Offline logging in the gym

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (Neon) with Prisma ORM |
| Auth | NextAuth (Auth.js) with GitHub/Google OAuth |
| Validation | Zod |
| Charts | Hand-built SVG components (no chart library) |
| AI | Claude API (vision + tool use for structured output) |
| Testing | Vitest |
| CI/CD | GitHub Actions, deployed on Vercel |

## Design

The color system comes from Olympic bumper plates. Each number the app tracks
has its plate color everywhere it appears: red (25 kg) for calories, blue
(20 kg) for protein, yellow (15 kg) for carbs, green (10 kg) for fat.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit, how food search ranks results, how the database grows, and scaling notes.

## Project structure

```
prisma/
  schema.prisma        Database tables: auth, training, nutrition, goals
  migrations/          SQL history, applied automatically on deploy
  seed.mjs             Loads the exercise library (runs on every deploy, skips existing)
  data/exercises.json  876 exercises from free-exercise-db (public domain)
src/
  app/
    (app)/             Signed-in pages: train, diary, progress, profile
    api/auth/          NextAuth sign-in endpoints
    signin/            Sign-in page
    manifest.ts        PWA manifest (home-screen install)
  components/          Shared UI: bottom nav, macro bars, empty states
  lib/
    auth.ts            Sign-in config + requireUser() access check
    db.ts              Prisma client
    training.ts        Training queries: workouts, previous sets, records, progress
    nutrition/         Food APIs (USDA, Open Food Facts), normalizing their data, diary queries
    ai/                Claude meal estimation and response validation
    fitness/           Pure, tested logic: 1RM, volume, PRs, BMR/TDEE, macros, units, muscles, dates
```

All data is stored in metric; the UI converts to the user's units.

## Running locally

Requires Node 22+ and a Postgres database (a free [Neon](https://neon.tech)
database works, or local Postgres).

```bash
git clone https://github.com/zrobards/calorness.git
cd calorness
npm install
cp .env.example .env      # then fill in the values
npm run db:migrate        # create the tables
npm run db:seed           # load the exercise library
npm run dev               # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run unit tests |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Lint the code |
| `npm run db:migrate` | Create a migration after editing `schema.prisma` |
| `npm run db:studio` | Browse the database in a GUI |

## Credits

Food data: [USDA FoodData Central](https://fdc.nal.usda.gov/) (public domain) and [Open Food Facts](https://world.openfoodfacts.org/) (Open Database License).

Exercise data and photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas, released into the public domain under the Unlicense.
