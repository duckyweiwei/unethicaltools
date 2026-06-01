/**
 * The Auth.js HTTP endpoints (sign-in, callback, sign-out, session, …). All of
 * them are served by NextAuth's generated handlers; this file just mounts them
 * at /api/auth/*. The Google OAuth "Authorized redirect URI" points here:
 *   <origin>/api/auth/callback/google
 */
import { handlers } from "@/auth";

export const runtime = "nodejs";

export const { GET, POST } = handlers;
