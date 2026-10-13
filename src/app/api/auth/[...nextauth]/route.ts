import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Handles every /api/auth/* request: sign-in redirects, OAuth callbacks,
// sign-out, and session checks.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
