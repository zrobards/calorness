import type { DefaultSession } from "next-auth";

// Teach TypeScript that our session.user carries the database id.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
