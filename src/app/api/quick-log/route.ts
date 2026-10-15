import { revalidatePath } from "next/cache";
import { z } from "zod";
import { summaryText } from "@/lib/apiKeys";
import { consumeAiQuota } from "@/lib/aiLimit";
import { plainText, userFromApiKey } from "@/lib/apiAuth";
import { estimateFoods } from "@/lib/ai/foodVision";
import { getDiaryDay, MEALS, MEAL_LABELS, type MealName } from "@/lib/nutrition/diary";
import { nowInZone, saveAiItems } from "@/lib/nutrition/aiLog";

/*
  POST /api/quick-log : log a meal from outside the app (an iPhone Shortcut).

  Authorization: Bearer cal_…   (a key made in Profile → Phone shortcut)
  Body, any of:
    • multipart form:   photo=<image file>, text=<words>, meal=<LUNCH…>, day=<YYYY-MM-DD>
    • a raw image body: Content-Type image/jpeg (or png/webp)
    • JSON:             { "text": "2 eggs and toast", "meal": "BREAKFAST" }

  The AI estimate is logged straight away (you can edit it in the Diary), and
  the reply is one line of plain text for the phone to show as a notification.
*/

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const text = plainText;
const authenticate = userFromApiKey;

/** Quick check for the shortcut setup: is the key valid? */
export async function GET(req: Request) {
  const user = await authenticate(req);
  return user ? text(`Calorness key works for ${user.name ?? "you"}.`) : text("That Calorness key isn't valid. Make a new one in Profile.", 401);
}

export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return text("That Calorness key isn't valid. Make a new one in Profile → Phone shortcut.", 401);


  // Read whichever body format the shortcut sent
  let image: { base64: string; mediaType: (typeof IMAGE_TYPES)[number] } | undefined;
  let words: string | undefined;
  let mealParam: string | undefined;
  let dayParam: string | undefined;
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

  const takeImage = async (blob: Blob, mediaType: string) => {
    if (mediaType === "image/heic" || mediaType === "image/heif")
      return "iPhone HEIC photos aren't supported. Add a “Convert Image” action (to JPEG) before sending.";
    if (!IMAGE_TYPES.includes(mediaType as (typeof IMAGE_TYPES)[number])) return "Send the photo as a JPEG, PNG, or WebP image.";
    if (blob.size > MAX_IMAGE_BYTES) return "That photo is too big. Add a “Resize Image” action (width 1024) before sending.";
    image = { base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mediaType: mediaType as (typeof IMAGE_TYPES)[number] };
    return null;
  };

  try {
    if (type === "multipart/form-data" || type === "application/x-www-form-urlencoded") {
      const form = await req.formData();
      const photo = form.get("photo");
      if (photo instanceof Blob && photo.size > 0) {
        const problem = await takeImage(photo, photo.type || "image/jpeg");
        if (problem) return text(problem, 415);
      }
      words = form.get("text")?.toString();
      mealParam = form.get("meal")?.toString();
      dayParam = form.get("day")?.toString();
    } else if (type.startsWith("image/")) {
      const problem = await takeImage(await req.blob(), type);
      if (problem) return text(problem, 415);
    } else if (type === "application/json") {
      const body = z.object({ text: z.string().max(500).optional(), meal: z.string().optional(), day: z.string().optional() }).parse(await req.json());
      ({ text: words, meal: mealParam, day: dayParam } = body);
    } else {
      return text("Send a photo (form field “photo”) or a description (field “text”).", 400);
    }
  } catch {
    return text("Couldn't read what the shortcut sent.", 400);
  }

  words = words?.trim().slice(0, 500) || undefined;
  if (!image && !words) return text("Nothing to log. Send a photo or describe the meal.", 400);

  const now = nowInZone(user.timeZone);
  const meal: MealName = MEALS.includes(mealParam?.toUpperCase() as MealName) ? (mealParam!.toUpperCase() as MealName) : now.meal;
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : now.day;

  const allowed = await consumeAiQuota(user.id, "shortcut");
  if ("error" in allowed) return text(allowed.error ?? "AI limit reached.", 429);
  const result = await estimateFoods({ image, text: words });
  if ("error" in result) return text(result.error, 422);

  await saveAiItems(user.id, day, meal, result.items);
  revalidatePath("/diary");
  revalidatePath("/log");

  const diary = await getDiaryDay(user.id, day, user.timeZone);
  return text(
    summaryText({
      meal: MEAL_LABELS[meal],
      items: result.items,
      caloriesLeft: diary.goal ? diary.goal.calories - diary.totals.calories : null,
    }),
  );
}
