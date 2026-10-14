import { after } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendPush } from "@/lib/push";

// Rest timer on the lock screen. When you leave the app mid-rest, the logger
// asks for a notification at the end of the rest. Coming back cancels it.
export const maxDuration = 300; // rests are at most 5 minutes

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const userId = session.user.id;
  const body = z.object({ seconds: z.number().int().min(1).max(290), label: z.string().max(80).optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return new Response(null, { status: 400 });

  const due = new Date(Date.now() + body.data.seconds * 1000);
  await db.user.update({ where: { id: userId }, data: { restAlarmAt: due } });

  // Respond right away; the waiting happens after the response is sent
  after(async () => {
    await new Promise((r) => setTimeout(r, body.data.seconds * 1000));
    const user = await db.user.findUnique({ where: { id: userId }, select: { restAlarmAt: true } });
    // Only send if this is still the alarm that's set (not cancelled or replaced)
    if (user?.restAlarmAt?.getTime() !== due.getTime()) return;
    await db.user.update({ where: { id: userId }, data: { restAlarmAt: null } });
    await sendPush(userId, {
      title: "Rest's over",
      body: body.data.label ? `Next set: ${body.data.label}` : "Time for your next set.",
      tag: "rest",
      url: "/train",
    });
  });
  return new Response(null, { status: 204 });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response(null, { status: 401 });
  await db.user.update({ where: { id: session.user.id }, data: { restAlarmAt: null } });
  return new Response(null, { status: 204 });
}
