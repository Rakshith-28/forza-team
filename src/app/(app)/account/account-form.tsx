"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MyAccount, NotificationPrefs } from "@/modules/identity/account";

import { updateMyAccountAction, type AccountFormState } from "./actions";

const INITIAL: AccountFormState = { ok: false, error: null };

const TOGGLES: { name: keyof NotificationPrefs; label: string; help: string }[] = [
  { name: "emailEnabled", label: "Email", help: "Receive notifications by email." },
  { name: "pushEnabled", label: "Push", help: "Browser/device push notifications." },
  { name: "smsEnabled", label: "SMS", help: "Text-message notifications." },
  { name: "announcementNotificationsEnabled", label: "Announcements", help: "New club & platform announcements." },
  { name: "chatNotificationsEnabled", label: "Team chat", help: "New chat messages." },
  { name: "scheduleNotificationsEnabled", label: "Schedule", help: "Event and attendance reminders." },
  { name: "billingNotificationsEnabled", label: "Billing", help: "Invoices and payment reminders." },
];

export function AccountForm({ account }: { account: MyAccount }) {
  const [state, action, pending] = useActionState(updateMyAccountAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-sport text-base font-bold text-foreground">Profile</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</dt>
            <dd className="mt-0.5 text-sm text-foreground">{account.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="mt-0.5 text-sm text-foreground">{account.email}</dd>
          </div>
        </dl>
        <div className="mt-4 flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={account.phone ?? ""} placeholder="(555) 555-5555" />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-sport text-base font-bold text-foreground">Notifications</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Choose how you&apos;re notified. In-app notices always show.</p>
        <div className="mt-4 flex flex-col gap-4">
          {TOGGLES.map((t) => (
            <label key={t.name} className="flex items-start gap-3">
              <input type="checkbox" name={t.name} defaultChecked={account.notifications[t.name]} className="mt-1 size-4" />
              <span>
                <span className="block text-sm font-medium text-foreground">{t.label}</span>
                <span className="block text-xs text-muted-foreground">{t.help}</span>
              </span>
            </label>
          ))}
        </div>

        {state.error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="mt-3 text-sm text-primary" role="status">
            Saved.
          </p>
        ) : null}

        <div className="mt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>
    </form>
  );
}
