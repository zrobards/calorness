import "server-only";
import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { handoffStatus } from "@/lib/handoff";
import { emailSchema, passwordSchema, verifyPassword } from "@/lib/password";

export const DEMO_EMAIL = "demo@calorness.app";

// Each sign-in option only turns on when its environment variables exist,
// so the app runs locally before any OAuth apps are set up.
const providers: Provider[] = [];
// Kept separately because next-auth only merges custom ids (like "demo")
// into the provider objects at request time.
const providerList: { id: string; name: string }[] = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      // GitHub only gives out verified emails, so it's safe to let GitHub
      // sign-in open an email + password account with the same address
      allowDangerousEmailAccountLinking: true,
    }),
  );
  providerList.push({ id: "github", name: "GitHub" });
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
  providerList.push({ id: "google", name: "Google" });
}

// One shared demo account so recruiters can click around without signing up.
if (process.env.DEMO_LOGIN_ENABLED === "true") {
  providers.push(
    CredentialsProvider({
      id: "demo",
      name: "Demo account",
      credentials: {},
      async authorize() {
        const user = await db.user.upsert({
          where: { email: DEMO_EMAIL },
          update: {},
          create: { email: DEMO_EMAIL, name: "Demo Lifter" },
        });
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  );
  providerList.push({ id: "demo", name: "Demo account" });
}

// Email + password. Works everywhere, including the iPhone home-screen app,
// because it never leaves the app for another website.
providers.push(
  CredentialsProvider({
    id: "password",
    name: "Email",
    credentials: { email: { type: "email" }, password: { type: "password" } },
    async authorize(credentials) {
      const email = emailSchema.safeParse(credentials?.email);
      const password = passwordSchema.safeParse(credentials?.password);
      if (!email.success || !password.success) return null;
      const user = await db.user.findUnique({ where: { email: email.data } });
      if (!(await verifyPassword(password.data, user?.passwordHash))) return null;
      return { id: user!.id, name: user!.name, email: user!.email, image: user!.image };
    },
  }),
);

// Home-screen app handoff (see LoginRequest in schema.prisma). Always on; it
// only accepts a request that a signed-in browser has approved.
providers.push(
  CredentialsProvider({
    id: "handoff",
    name: "Home-screen app",
    credentials: { requestId: { type: "text" } },
    async authorize(credentials) {
      const id = credentials?.requestId;
      if (!id || id.length < 30) return null;
      const req = await db.loginRequest.findUnique({ where: { id } });
      if (handoffStatus(req, new Date()) !== "approved") return null;
      // updateMany with consumedAt: null makes this single-use even if two calls race
      const { count } = await db.loginRequest.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: new Date() } });
      if (count !== 1) return null;
      const user = await db.user.findUnique({ where: { id: req!.userId! } });
      return user ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
    },
  }),
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  providers,
  secret: process.env.AUTH_SECRET,
  // JWT sessions: the session lives in a signed cookie instead of a database
  // row. Required for the credentials (demo) provider, and it saves a DB
  // query on every request.
  // Stay signed in for 90 days on each device
  session: { strategy: "jwt", maxAge: 90 * 24 * 60 * 60 },
  pages: { signIn: "/signin" },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

export function enabledProviders() {
  return providerList;
}

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

// The one place the app asks "who is signed in?" (a Data Access Layer).
// Every page and server action that touches user data goes through here,
// and anyone not signed in is sent to /signin.
export async function requireUser(): Promise<CurrentUser> {
  // Tell Next.js this must run per request, never at build time.
  await connection();
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) redirect("/signin");
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

export async function getOptionalUser() {
  await connection();
  const session = await getServerSession(authOptions);
  return session?.user?.id ? session.user : null;
}
