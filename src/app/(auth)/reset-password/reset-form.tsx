"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth-client";

export function ResetPasswordForm({ token, linkError }: { token: string | null; linkError: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalid = !token || linkError;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      setError(error.message ?? "This reset link is invalid or has expired.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/sign-in"), 1200);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a password of at least 8 characters.</CardDescription>
      </CardHeader>
      {invalid ? (
        <CardContent>
          <p className="text-sm text-destructive" role="alert">
            This reset link is invalid or has expired.
          </p>
          <Link href="/forgot-password" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
            Request a new link
          </Link>
        </CardContent>
      ) : done ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">Password updated. Redirecting to sign in…</p>
        </CardContent>
      ) : (
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
