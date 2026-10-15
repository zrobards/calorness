// Ready-made programs you can add to your routines in one tap.
// Exercises are referenced by their library name; a test checks they all exist.
// Format per exercise: [name, sets, minReps, maxReps, restSeconds]

export type TemplateExercise = [string, number, number, number, number];
export type ProgramTemplate = {
  id: string;
  name: string;
  days: string; // how often to train
  level: "Beginner" | "Intermediate" | "Any";
  description: string;
  routines: { name: string; exercises: TemplateExercise[] }[];
};

export const TEMPLATES: ProgramTemplate[] = [
  {
    id: "ppl",
    name: "Push / Pull / Legs",
    days: "3 or 6 days a week",
    level: "Intermediate",
    description: "The classic split. Run it once a week, or twice for more volume.",
    routines: [
      { name: "Push", exercises: [
        ["Barbell Bench Press - Medium Grip", 4, 6, 8, 180], ["Incline Dumbbell Press", 3, 8, 12, 120], ["Machine Shoulder Press", 3, 8, 12, 120],
        ["Dumbbell Lateral Raise", 3, 12, 15, 60], ["Pec Deck", 3, 12, 15, 60], ["Triceps Rope Pushdown", 3, 10, 15, 60], ["Overhead Cable Triceps Extension", 2, 12, 15, 60],
      ] },
      { name: "Pull", exercises: [
        ["Pull-Up", 3, 6, 10, 150], ["Bent Over Barbell Row", 3, 6, 10, 150], ["Seated Cable Row", 3, 10, 12, 90],
        ["Face Pull", 3, 12, 15, 60], ["Reverse Pec Deck", 2, 12, 15, 60], ["EZ-Bar Curl", 3, 8, 12, 90], ["Cable Hammer Curl", 2, 10, 12, 60],
      ] },
      { name: "Legs", exercises: [
        ["Back Squat", 4, 5, 8, 180], ["Romanian Deadlift", 3, 8, 10, 150], ["Leg Press (45°)", 3, 10, 12, 120],
        ["Leg Extension", 3, 12, 15, 60], ["Seated Leg Curl Machine", 3, 10, 12, 60], ["Standing Calf Raise Machine", 4, 10, 15, 60], ["Hanging Leg Raise", 3, 10, 15, 60],
      ] },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    days: "4 days a week",
    level: "Intermediate",
    description: "Each muscle twice a week with time to recover. Alternate A and B weeks or just repeat.",
    routines: [
      { name: "Upper", exercises: [
        ["Barbell Bench Press - Medium Grip", 4, 5, 8, 180], ["Bent Over Barbell Row", 4, 6, 10, 150], ["Overhead Press", 3, 6, 10, 150],
        ["Lat Pulldown", 3, 8, 12, 90], ["Dumbbell Lateral Raise", 3, 12, 15, 60], ["EZ-Bar Curl", 2, 8, 12, 60], ["Triceps Rope Pushdown", 2, 10, 15, 60],
      ] },
      { name: "Lower", exercises: [
        ["Back Squat", 4, 5, 8, 180], ["Romanian Deadlift", 3, 6, 10, 150], ["Bulgarian Split Squat", 3, 8, 12, 90],
        ["Seated Leg Curl Machine", 3, 10, 12, 60], ["Standing Calf Raise Machine", 4, 10, 15, 60], ["Cable Crunch (Kneeling)", 3, 10, 15, 60],
      ] },
    ],
  },
  {
    id: "full-body",
    name: "Full Body for Beginners",
    days: "3 days a week (A, B, A…)",
    level: "Beginner",
    description: "Learn the main lifts with plenty of rest. Add weight when you hit the top of the rep range.",
    routines: [
      { name: "Full Body A", exercises: [
        ["Goblet Squat", 3, 8, 12, 120], ["Dumbbell Bench Press", 3, 8, 12, 120], ["Lat Pulldown", 3, 8, 12, 90],
        ["Dumbbell Romanian Deadlift", 3, 8, 12, 90], ["Plank", 3, 1, 1, 60],
      ] },
      { name: "Full Body B", exercises: [
        ["Leg Press (45°)", 3, 10, 12, 120], ["Machine Shoulder Press", 3, 8, 12, 90], ["Seated Cable Row", 3, 10, 12, 90],
        ["Walking Lunge", 2, 10, 12, 90], ["Dumbbell Curl", 2, 10, 12, 60], ["Triceps Rope Pushdown", 2, 10, 12, 60],
      ] },
    ],
  },
  {
    id: "5x5",
    name: "Strength 5×5",
    days: "3 days a week (A, B, A…)",
    level: "Beginner",
    description: "Five sets of five on the big barbell lifts. Simple, and you'll get strong fast.",
    routines: [
      { name: "5×5 A", exercises: [["Back Squat", 5, 5, 5, 180], ["Barbell Bench Press - Medium Grip", 5, 5, 5, 180], ["Bent Over Barbell Row", 5, 5, 5, 180]] },
      { name: "5×5 B", exercises: [["Back Squat", 5, 5, 5, 180], ["Overhead Press", 5, 5, 5, 180], ["Conventional Deadlift", 1, 5, 5, 240]] },
    ],
  },
  {
    id: "machines",
    name: "Machines Only",
    days: "3 days a week",
    level: "Beginner",
    description: "No barbell needed. Great for learning the gym or training around a sore back or shoulder.",
    routines: [
      { name: "Machines Day", exercises: [
        ["Machine Chest Press", 3, 10, 12, 90], ["Machine Seated Row", 3, 10, 12, 90], ["Machine Shoulder Press", 3, 10, 12, 90],
        ["Leg Press (45°)", 3, 10, 12, 120], ["Seated Leg Curl Machine", 3, 10, 12, 60], ["Leg Extension", 3, 12, 15, 60], ["Pec Deck", 2, 12, 15, 60],
      ] },
    ],
  },
  {
    id: "glutes-legs",
    name: "Glutes & Legs Focus",
    days: "2 days a week, plus upper body of your choice",
    level: "Any",
    description: "Hip thrusts, split squats, and hamstrings for stronger, rounder legs and glutes.",
    routines: [
      { name: "Glutes & Hamstrings", exercises: [
        ["Barbell Hip Thrust", 4, 8, 12, 120], ["Romanian Deadlift", 3, 8, 10, 120], ["Cable Kickback", 3, 12, 15, 60],
        ["Hip Abduction Machine", 3, 15, 20, 60], ["Lying Leg Curl Machine", 3, 10, 12, 60],
      ] },
      { name: "Quads & Glutes", exercises: [
        ["Hack Squat Machine", 4, 8, 12, 150], ["Bulgarian Split Squat", 3, 8, 12, 90], ["Leg Press (45°)", 3, 12, 15, 90],
        ["Leg Extension", 3, 12, 15, 60], ["Seated Calf Raise Machine", 3, 12, 15, 60],
      ] },
    ],
  },
  {
    id: "home-db",
    name: "Home Dumbbells",
    days: "3 days a week",
    level: "Any",
    description: "Just a pair of dumbbells and a bench (or the floor).",
    routines: [
      { name: "Dumbbell Full Body", exercises: [
        ["Goblet Squat", 3, 10, 15, 90], ["Dumbbell Bench Press", 3, 8, 12, 90], ["One-Arm Dumbbell Row", 3, 10, 12, 90],
        ["Dumbbell Romanian Deadlift", 3, 10, 12, 90], ["Dumbbell Shoulder Press (Seated)", 3, 8, 12, 90], ["Push-Up", 2, 8, 20, 60],
      ] },
    ],
  },
];
