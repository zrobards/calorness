import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

// Notification signing keys (VAPID). Created once by the app and kept in the
// database, so notifications work without any extra setup in Vercel.
let cached: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys() {
  if (cached) return cached;
  const existing = await db.appSecret.findMany({ where: { key: { in: ["vapid_public", "vapid_private"] } } });
  let pub = existing.find((s) => s.key === "vapid_public")?.value;
  let priv = existing.find((s) => s.key === "vapid_private")?.value;
  if (!pub || !priv) {
    const fresh = webpush.generateVAPIDKeys();
    // skipDuplicates: if two requests race, the first one's keys win
    await db.appSecret.createMany({
      data: [{ key: "vapid_public", value: fresh.publicKey }, { key: "vapid_private", value: fresh.privateKey }],
      skipDuplicates: true,
    });
    const saved = await db.appSecret.findMany({ where: { key: { in: ["vapid_public", "vapid_private"] } } });
    pub = saved.find((s) => s.key === "vapid_public")!.value;
    priv = saved.find((s) => s.key === "vapid_private")!.value;
  }
  cached = { publicKey: pub, privateKey: priv };
  return cached;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Send to every device a user enabled notifications on. Cleans up dead subscriptions. */
export async function sendPush(userId: string, message: PushMessage) {
  const { publicKey, privateKey } = await vapidKeys();
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          { vapidDetails: { subject: "mailto:notifications@calorness.app", publicKey, privateKey }, TTL: 600 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }),
  );
  return sent;
}
