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
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Account-claim / onboarding page for migrated users. Reached via the
// single-use claim link issued by the Sovyn control plane
// (…/claim?token=…). Verifies the token, then lets the owner set a password;
// on success a session is established and they land in the app. This lives in
// the Sovyn-injected auth scaffold on purpose — the app itself needs no
// password UI of its own.

type Phase = "verifying" | "invalid" | "ready" | "submitting" | "done";

async function postJson(
  url: string,
  body: unknown
): Promise<{ ok: boolean; data: { email?: string | null; error?: string } }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    email?: string | null;
    error?: string;
  };
  return { ok: res.ok, data };
}

export default function Claim() {
  const [phase, setPhase] = useState<Phase>("verifying");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setPhase("invalid");
        setError("This claim link is missing its token.");
        return;
      }
      const { ok, data } = await postJson("/api/claim/verify", { token });
      if (cancelled) return;
      if (!ok) {
        setPhase("invalid");
        setError(data.error ?? "This claim link is not valid.");
        return;
      }
      setEmail(data.email ?? null);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("The passwords do not match.");
      return;
    }
    setPhase("submitting");
    const { ok, data } = await postJson("/api/claim/complete", {
      token,
      password,
    });
    if (!ok) {
      toast.error(data.error ?? "Claiming your account failed.");
      setPhase("ready");
      return;
    }
    setPhase("done");
    // Full reload so the tRPC auth.me cache starts fresh with the new session.
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Claim your account</CardTitle>
          <CardDescription>
            {phase === "verifying" && "Checking your link…"}
            {phase === "invalid" && error}
            {(phase === "ready" ||
              phase === "submitting" ||
              phase === "done") &&
              `Set a password${email ? ` for ${email}` : ""} to finish moving your account over. Your data is waiting for you.`}
          </CardDescription>
        </CardHeader>
        {(phase === "ready" || phase === "submitting" || phase === "done") && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={phase !== "ready"}
              >
                {phase === "ready" ? "Set password & sign in" : "Working…"}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
