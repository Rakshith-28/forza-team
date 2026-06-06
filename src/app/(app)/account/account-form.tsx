"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
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
      <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-sport text-base font-bold text-foreground">Profile</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</dt>
            <dd className="mt-0.5 text-sm text-foreground">{account.name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="mt-0.5 truncate text-sm text-foreground">{account.email}</dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={account.phone ?? ""} placeholder="(555) 555-5555" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-sport text-base font-bold text-foreground">Notifications</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose how you&apos;re notified. In-app notices always show.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOGGLES.map((t) => (
            <ToggleSwitch
              key={t.name}
              name={t.name}
              label={t.label}
              help={t.help}
              defaultChecked={account.notifications[t.name]}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="text-sm text-primary" role="status">
              Saved.
            </p>
          ) : null}
        </div>
      </section>
    </form>
  );
}
