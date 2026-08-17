import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

// Base URL defaults to the current origin; the Better Auth handler is mounted
// on the same Express server under /api/auth.
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
