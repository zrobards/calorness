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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  providers,
  secret: process.env.AUTH_SECRET,
  // JWT sessions: the session lives in a signed cookie instead of a database
  // row. Required for the credentials (demo) provider, and it saves a DB
  // query on every request.
  session: { strategy: "jwt" },
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
