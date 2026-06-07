"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";

// Stable no-op subscription: useSyncExternalStore returns the server snapshot
// (false) during SSR + the first hydration render, then the client snapshot
// (true) — a hydration-safe "are we mounted?" flag with no setState-in-effect.
const emptySubscribe = () => () => {};

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Gate submission until after hydration: a click before the JS handler is
  // attached would submit the bare form as a GET to /sign-in, leaking the
  // credentials into the URL and triggering a stray navigation.
  const ready = useSyncExternalStore(emptySubscribe, () => true, () => false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // guard against double-submit
    setLoading(true);
    setError(null);
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Sign-in failed. Check your email and password.");
      setLoading(false);
      return;
    }
    // Full-document navigation (not router.push + router.refresh): forces the
    // browser to send the freshly set session cookie and re-render the protected
    // layout server-side, bypassing the client Router Cache
    // (experimental.staleTimes.dynamic). This lands the user authenticated on
    // the FIRST attempt instead of bouncing back to /sign-in — which also
    // remounted this page and re-fired the /forgot-password prefetch. Keep
    // `loading` true so the button stays disabled while the page navigates away.
    window.location.href = "/dashboard";
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-xl">
      {/* Brand accent strip. */}
      <div className="h-1.5 w-full bg-linear-to-r from-primary via-primary/70 to-primary/40" />

      <CardHeader className="gap-2 p-7 pb-0">
        <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
        <CardDescription>Sign in to continue to your club dashboard.</CardDescription>
      </CardHeader>

      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-5 p-7">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@club.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" prefetch={false} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-3 p-7 pt-0">
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={loading || !ready}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Access is invite-only — ask your club admin to send you an invite.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
