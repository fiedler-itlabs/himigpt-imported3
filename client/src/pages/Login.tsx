import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/authClient";
import { useState } from "react";
import { toast } from "sonner";

type Mode = "signIn" | "signUp";

export default function Login() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const isSignUp = mode === "signUp";

  // Recovery for users who already have an account (e.g. forgot their password).
  // The server enables magic links with sign-up disabled, so this only works for
  // existing accounts — migrated users still claim via their claim link first.
  const handleMagicLink = async () => {
    if (!email) {
      toast.error("Enter your email first.");
      return;
    }
    setSendingLink(true);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/",
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not send the sign-in link.");
        return;
      }
      toast.success("If that account exists, a sign-in link is on its way.");
    } catch {
      toast.error("Could not send the sign-in link. Please try again.");
    } finally {
      setSendingLink(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        toast.error(result.error.message ?? "Authentication failed");
        return;
      }
      // Full reload so the tRPC auth.me cache starts fresh with the session.
      window.location.href = "/";
    } catch {
      toast.error("Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isSignUp ? "Create account" : "Sign in"}</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Create a new account. Migrated from a previous version? Don't sign up — use the account-claim link you were sent to keep your data."
              : "Sign in with your email and password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? "Please wait…"
                : isSignUp
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
          {!isSignUp && (
            <Button
              variant="link"
              className="mt-2 w-full"
              disabled={sendingLink}
              onClick={handleMagicLink}
            >
              {sendingLink ? "Sending…" : "Forgot password? Email me a sign-in link"}
            </Button>
          )}
          <Button
            variant="link"
            className="mt-4 w-full"
            onClick={() => setMode(isSignUp ? "signIn" : "signUp")}
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "No account yet? Create one"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
