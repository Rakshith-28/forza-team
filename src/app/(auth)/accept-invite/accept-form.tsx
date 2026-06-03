"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { acceptInviteAction, type AcceptInviteState } from "./actions";

const initialState: AcceptInviteState = { error: null };

export function AcceptInviteForm({ id, token }: { id: string; token: string }) {
  const [state, formAction, pending] = useActionState(acceptInviteAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept your invitation</CardTitle>
        <CardDescription>Set up your account to join your club.</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="token" value={token} />
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" required autoComplete="given-name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" required autoComplete="family-name" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
