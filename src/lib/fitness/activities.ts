// Cardio, sports, and everyday activities with their MET values.
//
// A MET is how hard an activity is compared to sitting still (1 MET).
// Values come from the Compendium of Physical Activities (Ainsworth et al.,
// 2011), the standard research reference. A few newer activities without a
// Compendium entry use the closest listed activity, marked "approx".

export type Intensity = "light" | "moderate" | "vigorous";
export type SpeedModel = "walk" | "run";

export type Activity = {
  key: string;
  name: string;
  category: string;
  met: Partial<Record<Intensity, number>> & { moderate: number };
  // what each intensity means for this activity, shown when choosing
  hints?: Partial<Record<Intensity, string>>;
  distance?: boolean; // ask for distance
  incline?: boolean; // ask for treadmill incline
  speedModel?: SpeedModel; // use the ACSM walking/running equations when distance is known
  aliases?: string[];
  approx?: boolean;
};

const A = (a: Activity) => a;

export const ACTIVITIES: Activity[] = [
  // Running and walking
  A({ key: "walking", name: "Walking", category: "Running & walking", met: { light: 3.0, moderate: 3.5, vigorous: 5.0 }, hints: { light: "about 2.5 mph", moderate: "about 3 mph", vigorous: "brisk, about 4 mph" }, distance: true, speedModel: "walk", aliases: ["walk", "stroll"] }),
  A({ key: "incline-walk", name: "Incline treadmill walk", category: "Running & walking", met: { light: 5.3, moderate: 6.0, vigorous: 8.0 }, hints: { light: "gentle incline", moderate: "5–10% incline", vigorous: "12–15% incline" }, distance: true, incline: true, speedModel: "walk", aliases: ["12 3 30", "treadmill walk", "incline walking"] }),
  A({ key: "running", name: "Running", category: "Running & walking", met: { light: 7.0, moderate: 9.8, vigorous: 11.8 }, hints: { light: "easy jog", moderate: "about 6 mph (10 min/mile)", vigorous: "about 8 mph (7:30 min/mile)" }, distance: true, incline: true, speedModel: "run", aliases: ["run", "jog", "jogging", "treadmill run"] }),
  A({ key: "hiking", name: "Hiking", category: "Running & walking", met: { light: 5.3, moderate: 6.0, vigorous: 7.8 }, hints: { light: "flat trail", moderate: "hills", vigorous: "steep or with a pack" }, distance: true, aliases: ["hike", "trail"] }),
  A({ key: "stairs", name: "Climbing stairs", category: "Running & walking", met: { light: 4.0, moderate: 8.8 }, hints: { light: "slow pace", moderate: "fast pace" }, aliases: ["stair climbing", "stadium stairs"] }),

  // Cycling
  A({ key: "cycling", name: "Cycling (outdoors)", category: "Cycling", met: { light: 4.0, moderate: 8.0, vigorous: 10.0 }, hints: { light: "under 10 mph", moderate: "12–14 mph", vigorous: "14–16 mph" }, distance: true, aliases: ["bike", "biking", "bicycle", "road bike"] }),
  A({ key: "stationary-bike", name: "Stationary bike", category: "Cycling", met: { light: 3.5, moderate: 6.8, vigorous: 8.8 }, aliases: ["exercise bike", "peloton", "bike machine", "assault bike", "air bike"] }),
  A({ key: "spin-class", name: "Spin class", category: "Cycling", met: { moderate: 8.5 }, aliases: ["spinning", "cycle class", "soulcycle"] }),
  A({ key: "mountain-biking", name: "Mountain biking", category: "Cycling", met: { moderate: 8.5, vigorous: 14.0 }, aliases: ["mtb", "trail riding"] }),

  // Swimming and water
  A({ key: "swimming", name: "Swimming laps", category: "Swimming & water", met: { light: 5.8, moderate: 7.0, vigorous: 9.8 }, hints: { light: "slow, easy laps", moderate: "steady laps", vigorous: "fast freestyle" }, distance: true, aliases: ["swim", "laps", "pool"] }),
  A({ key: "swimming-leisure", name: "Swimming (recreational)", category: "Swimming & water", met: { moderate: 6.0 } }),
  A({ key: "kayaking", name: "Kayaking", category: "Swimming & water", met: { moderate: 5.0 }, aliases: ["kayak"] }),
  A({ key: "canoeing", name: "Canoeing", category: "Swimming & water", met: { light: 2.8, moderate: 5.8 }, aliases: ["canoe"] }),
  A({ key: "paddleboarding", name: "Paddleboarding", category: "Swimming & water", met: { moderate: 6.0 }, aliases: ["sup", "stand up paddle"] }),
  A({ key: "surfing", name: "Surfing", category: "Swimming & water", met: { light: 3.0, moderate: 5.0 }, aliases: ["surf"] }),

  // Gym cardio
  A({ key: "elliptical", name: "Elliptical", category: "Gym cardio", met: { moderate: 5.0 }, aliases: ["cross trainer"] }),
  A({ key: "stair-climber", name: "Stair climber", category: "Gym cardio", met: { moderate: 9.0 }, aliases: ["stairmaster", "stepmill", "stair machine"] }),
  A({ key: "rowing", name: "Rowing machine", category: "Gym cardio", met: { light: 4.8, moderate: 7.0, vigorous: 8.5 }, hints: { light: "easy, ~50 W", moderate: "~100 W", vigorous: "~150 W" }, distance: true, aliases: ["rower", "erg", "concept2", "row"] }),
  A({ key: "jump-rope", name: "Jump rope", category: "Gym cardio", met: { light: 8.8, moderate: 11.8, vigorous: 12.3 }, aliases: ["skipping", "jumping rope"] }),
  A({ key: "hiit", name: "HIIT / circuit training", category: "Gym cardio", met: { moderate: 4.3, vigorous: 8.0 }, aliases: ["circuit", "interval training", "crossfit", "bootcamp", "f45", "orangetheory"] }),
  A({ key: "calisthenics", name: "Calisthenics (burpees, jumping jacks)", category: "Gym cardio", met: { light: 2.8, moderate: 3.8, vigorous: 8.0 }, aliases: ["bodyweight", "burpees", "jumping jacks", "mountain climbers"] }),
  A({ key: "boxing-bag", name: "Boxing (bag work)", category: "Gym cardio", met: { moderate: 5.5 }, aliases: ["punching bag", "heavy bag"] }),
  A({ key: "weightlifting", name: "Weightlifting session", category: "Gym cardio", met: { light: 3.5, moderate: 5.0, vigorous: 6.0 }, hints: { light: "lots of rest", moderate: "typical session", vigorous: "short rests, heavy" }, aliases: ["lifting", "weights", "strength training"] }),

  // Climbing and outdoors
  A({ key: "rock-climbing", name: "Rock climbing", category: "Climbing & outdoors", met: { light: 5.0, moderate: 5.8, vigorous: 7.5 }, hints: { light: "belaying and rappelling", moderate: "easy to moderate routes", vigorous: "hard routes" }, aliases: ["climbing", "top rope", "lead climbing", "sport climbing"] }),
  A({ key: "bouldering", name: "Bouldering / indoor climbing", category: "Climbing & outdoors", met: { moderate: 5.8, vigorous: 7.5 }, aliases: ["climbing gym", "boulder", "indoor climbing"], approx: true }),
  A({ key: "mountaineering", name: "Mountain climbing", category: "Climbing & outdoors", met: { moderate: 8.0 }, aliases: ["alpine", "scrambling"] }),
  A({ key: "skiing", name: "Skiing (downhill)", category: "Climbing & outdoors", met: { light: 4.3, moderate: 5.3, vigorous: 8.0 }, aliases: ["ski"] }),
  A({ key: "cross-country-skiing", name: "Cross-country skiing", category: "Climbing & outdoors", met: { light: 6.8, moderate: 9.0, vigorous: 12.5 }, aliases: ["xc ski", "nordic"] }),
  A({ key: "snowboarding", name: "Snowboarding", category: "Climbing & outdoors", met: { light: 4.3, moderate: 5.3, vigorous: 8.0 }, aliases: ["snowboard"] }),
  A({ key: "ice-skating", name: "Ice skating", category: "Climbing & outdoors", met: { moderate: 7.0 }, aliases: ["skating"] }),
  A({ key: "inline-skating", name: "Roller / inline skating", category: "Climbing & outdoors", met: { moderate: 7.5 }, aliases: ["rollerblading", "roller skating"] }),
  A({ key: "skateboarding", name: "Skateboarding", category: "Climbing & outdoors", met: { moderate: 5.0, vigorous: 6.0 }, aliases: ["skate", "skateboard"] }),
  A({ key: "horseback", name: "Horseback riding", category: "Climbing & outdoors", met: { moderate: 5.5 }, aliases: ["riding", "horse"] }),

  // Sports
  A({ key: "basketball", name: "Basketball", category: "Sports", met: { light: 4.5, moderate: 6.5, vigorous: 8.0 }, hints: { light: "shooting around", moderate: "pickup", vigorous: "full-court game" }, aliases: ["hoops", "bball"] }),
  A({ key: "soccer", name: "Soccer", category: "Sports", met: { moderate: 7.0, vigorous: 10.0 }, hints: { moderate: "casual", vigorous: "competitive" }, aliases: ["futbol", "football (soccer)"] }),
  A({ key: "football", name: "Football (flag or touch)", category: "Sports", met: { light: 4.0, moderate: 8.0 }, aliases: ["flag football", "touch football"] }),
  A({ key: "tennis", name: "Tennis", category: "Sports", met: { light: 6.0, moderate: 7.3, vigorous: 8.0 }, hints: { light: "doubles", moderate: "general", vigorous: "singles" } }),
  A({ key: "pickleball", name: "Pickleball", category: "Sports", met: { light: 4.0, moderate: 5.5, vigorous: 7.0 }, approx: true }),
  A({ key: "badminton", name: "Badminton", category: "Sports", met: { moderate: 5.5, vigorous: 7.0 } }),
  A({ key: "racquetball", name: "Racquetball", category: "Sports", met: { moderate: 7.0, vigorous: 10.0 } }),
  A({ key: "squash", name: "Squash", category: "Sports", met: { moderate: 7.3, vigorous: 12.0 } }),
  A({ key: "table-tennis", name: "Table tennis", category: "Sports", met: { moderate: 4.0 }, aliases: ["ping pong"] }),
  A({ key: "volleyball", name: "Volleyball", category: "Sports", met: { light: 3.0, moderate: 4.0, vigorous: 8.0 }, hints: { light: "casual", moderate: "competitive indoor", vigorous: "beach" }, aliases: ["beach volleyball", "spikeball", "roundnet"] }),
  A({ key: "ultimate", name: "Ultimate frisbee", category: "Sports", met: { moderate: 8.0 }, aliases: ["ultimate"] }),
  A({ key: "frisbee", name: "Frisbee / disc golf", category: "Sports", met: { moderate: 3.0 }, aliases: ["disc golf", "throwing a frisbee"] }),
  A({ key: "hacky-sack", name: "Hacky sack", category: "Sports", met: { moderate: 4.0 }, aliases: ["footbag", "hackysack", "hacky"] }),
  A({ key: "golf", name: "Golf", category: "Sports", met: { light: 3.5, moderate: 4.3, vigorous: 4.8 }, hints: { light: "riding a cart", moderate: "walking, carrying clubs", vigorous: "walking, fast pace" } }),
  A({ key: "baseball", name: "Baseball / softball", category: "Sports", met: { moderate: 5.0 }, aliases: ["softball"] }),
  A({ key: "hockey", name: "Hockey", category: "Sports", met: { moderate: 8.0, vigorous: 10.0 }, aliases: ["ice hockey", "field hockey"] }),
  A({ key: "lacrosse", name: "Lacrosse", category: "Sports", met: { moderate: 8.0 } }),
  A({ key: "rugby", name: "Rugby", category: "Sports", met: { moderate: 6.3, vigorous: 8.3 } }),
  A({ key: "wrestling", name: "Wrestling", category: "Sports", met: { moderate: 6.0 } }),
  A({ key: "martial-arts", name: "Martial arts", category: "Sports", met: { light: 5.3, moderate: 10.3 }, hints: { light: "drills, slower pace", moderate: "sparring, fast pace" }, aliases: ["karate", "taekwondo", "judo", "jiu jitsu", "bjj", "mma", "kickboxing"] }),
  A({ key: "boxing", name: "Boxing (sparring)", category: "Sports", met: { moderate: 7.8 } }),

  // Classes and mind-body
  A({ key: "yoga", name: "Yoga", category: "Classes & mind-body", met: { light: 2.5, moderate: 3.0, vigorous: 4.0 }, hints: { light: "gentle / hatha", moderate: "flow", vigorous: "power / hot" }, aliases: ["vinyasa", "hot yoga"] }),
  A({ key: "pilates", name: "Pilates", category: "Classes & mind-body", met: { moderate: 3.0 } }),
  A({ key: "stretching", name: "Stretching / mobility", category: "Classes & mind-body", met: { moderate: 2.3 }, aliases: ["mobility", "foam rolling"] }),
  A({ key: "tai-chi", name: "Tai chi", category: "Classes & mind-body", met: { moderate: 3.0 } }),
  A({ key: "dance", name: "Dancing", category: "Classes & mind-body", met: { light: 4.5, moderate: 5.0, vigorous: 7.3 }, hints: { light: "social", moderate: "ballet, modern", vigorous: "aerobic / Zumba" }, aliases: ["zumba", "dance class", "hip hop"] }),
  A({ key: "aerobics", name: "Aerobics class", category: "Classes & mind-body", met: { moderate: 5.0, vigorous: 7.3 }, aliases: ["step aerobics", "cardio class"] }),
  A({ key: "trampoline", name: "Trampoline", category: "Classes & mind-body", met: { moderate: 3.5 } }),

  // Everyday
  A({ key: "dog-walking", name: "Walking the dog", category: "Everyday", met: { moderate: 3.0 } }),
  A({ key: "yard-work", name: "Yard work / mowing", category: "Everyday", met: { light: 3.8, moderate: 5.5 }, hints: { light: "gardening", moderate: "mowing with a push mower" }, aliases: ["mowing", "gardening", "raking"] }),
  A({ key: "shoveling", name: "Shoveling snow", category: "Everyday", met: { moderate: 5.3 } }),
  A({ key: "moving", name: "Moving furniture / boxes", category: "Everyday", met: { moderate: 5.8 }, aliases: ["moving", "lifting boxes"] }),
  A({ key: "cleaning", name: "House cleaning", category: "Everyday", met: { moderate: 3.3 }, aliases: ["chores", "vacuuming"] }),
  A({ key: "playing-kids", name: "Playing with kids", category: "Everyday", met: { moderate: 4.0 } }),
];

export const findActivity = (key: string) => ACTIVITIES.find((a) => a.key === key);

/** The MET to use, falling back to the nearest defined intensity. */
export function metFor(a: Activity, intensity: Intensity): number {
  return a.met[intensity] ?? (intensity === "light" ? a.met.moderate : a.met.vigorous ?? a.met.moderate);
}

// ─── Calories burned ──────────────────────────────────────────────────────

export type Body = { weightKg: number; heightCm?: number | null; age?: number | null; sex?: "male" | "female" | null };

/** Resting calories per minute: Mifflin–St Jeor when we know enough about you, else the textbook 1 MET. */
export function restingPerMinute(b: Body): number {
  if (b.heightCm && b.age && b.sex) {
    const bmr = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + (b.sex === "male" ? 5 : -161);
    return bmr / 1440;
  }
  return (3.5 * b.weightKg) / 200;
}

export type BurnInput = Body & {
  minutes: number;
  met: number;
  avgHeartRate?: number | null;
  distanceM?: number | null;
  inclinePct?: number | null;
  speedModel?: SpeedModel;
};

export type Burn = { total: number; net: number; method: "heart-rate" | "acsm" | "met"; explain: string };

/**
 * Picks the most accurate method the inputs allow:
 * 1. Heart rate (Keytel et al., 2005), which reflects how hard YOU worked.
 * 2. ACSM walking/running equations, when distance (and incline) are known.
 * 3. MET × body weight × time.
 * "net" subtracts what you'd have burned resting anyway, which is the part
 * that should be added to your day (your daily target already covers rest).
 */
export function estimateBurn(i: BurnInput): Burn {
  const minutes = Math.max(0, i.minutes);
  const rest = restingPerMinute(i) * minutes;
  let perMin: number;
  let method: Burn["method"];
  let explain: string;

  const hrOk = i.avgHeartRate && i.avgHeartRate >= 80 && i.avgHeartRate <= 210 && i.age && i.sex;
  if (hrOk) {
    const hr = i.avgHeartRate!, w = i.weightKg, a = i.age!;
    const kj = i.sex === "male" ? -55.0969 + 0.6309 * hr + 0.1988 * w + 0.2017 * a : -20.4022 + 0.4472 * hr - 0.1263 * w + 0.074 * a;
    perMin = Math.max(kj / 4.184, (i.met * 3.5 * w) / 200 * 0.5); // never below half the MET estimate
    method = "heart-rate";
    explain = `your average heart rate (${hr} bpm), weight, age, and sex`;
  } else if (i.speedModel && i.distanceM && i.distanceM > 0 && minutes > 0) {
    const speed = i.distanceM / minutes; // meters per minute
    const grade = Math.max(0, (i.inclinePct ?? 0) / 100);
    const running = i.speedModel === "run" || speed > 134; // above ~5 mph walking turns into running
    const vo2 = running ? 0.2 * speed + 0.9 * speed * grade + 3.5 : 0.1 * speed + 1.8 * speed * grade + 3.5;
    perMin = (vo2 * i.weightKg * 5) / 1000; // ~5 calories per liter of oxygen
    method = "acsm";
    explain = `your pace${grade > 0 ? ", incline," : ""} and weight (ACSM ${running ? "running" : "walking"} equation)`;
  } else {
    perMin = (i.met * 3.5 * i.weightKg) / 200;
    method = "met";
    explain = `your weight and a ${i.met} MET activity`;
  }

  const total = Math.round(perMin * minutes);
  return { total, net: Math.max(0, Math.round(total - rest)), method, explain };
}

/** Calories to add to today's goal, given how much exercise credit the user wants (e.g. 75%). */
export const exerciseCreditCalories = (net: number, percent: number) => Math.round((net * Math.min(100, Math.max(0, percent))) / 100);
