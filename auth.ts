/**
 * NextAuth v5 — the server's source of truth for *real* identity (the kind that
 * can carry an entitlement across devices). This sits alongside the local-first
 * profile in `lib/auth/account.ts`: signed out, the app still works exactly as
 * before; signing in with Google is what unlocks a paid upgrade that follows you.
 *
 * Strategy is JWT, so there are NO auth tables in the database — the session is a
 * signed cookie. The only thing we persist server-side is entitlement (see
 * lib/db/schema.sql), keyed by the Google subject id we expose as `session.user.id`.
 *
 * Credentials come from the environment by convention: NextAuth automatically
 * reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET for the Google provider and
 * AUTH_SECRET to sign the cookie — nothing is hardcoded here.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Trust the deployment's own host header. Vercel sets this implicitly, but
  // making it explicit avoids "UntrustedHost" on the custom domain / previews.
  trustHost: true,
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    // Surface the stable Google subject id on the session so server code and the
    // checkout flow can key entitlement to *this* account.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
