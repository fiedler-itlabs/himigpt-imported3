import "dotenv/config";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import { findPendingUserByEmail } from "./db";
import { isClaimInProgress } from "./_core/claimGuard";
import { renderMagicLinkEmail } from "./_core/magicLinkEmail";
import { sendMail } from "./_core/mail";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize auth");
}

const authDb = drizzle(databaseUrl);

export const auth = betterAuth({
  database: drizzleAdapter(authDb, {
    provider: "mysql",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    // Password recovery for users who already have an account. `disableSignUp`
    // keeps this recovery-only: a magic link never creates a new account, so it
    // can't be used to bypass the token-gated claim flow for migrated users
    // (they have no Better Auth account until they claim — see _core/claim.ts).
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        const { subject, html, text } = renderMagicLinkEmail(url);
        await sendMail({ to: email, subject, html, text });
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        // Defense in depth: a migrated user whose account-claim link is still
        // outstanding must not be pre-empted by a stranger signing up with
        // their email (which would occupy the address and block the real
        // owner's claim). The claim flow itself is exempt — it creates the
        // account on the owner's behalf; see server/_core/claim.ts.
        before: async (user) => {
          if (user.email && !isClaimInProgress(user.email)) {
            const pending = await findPendingUserByEmail(user.email);
            if (pending) {
              throw new APIError("BAD_REQUEST", {
                message:
                  "This account was migrated. Use the claim link you received to set your password.",
              });
            }
          }
          return { data: user };
        },
      },
    },
  },
});
