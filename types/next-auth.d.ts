/**
 * Tell TypeScript that our session carries the user's stable id (set in the
 * `session` callback in auth.ts). Without this augmentation, `session.user.id`
 * would be a type error.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Stable identity key — the Google OAuth subject id. */
      id: string;
    } & DefaultSession["user"];
  }
}
