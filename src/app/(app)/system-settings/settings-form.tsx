"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { INITIAL_STATE } from "@/modules/clubs/action-state";
import { updateSystemSettingsAction } from "@/modules/master/actions";
import { CURRENCIES } from "@/modules/master/schemas";

export interface SystemSettingsFormData {
  aiFeaturesEnabled: boolean;
  maintenanceMode: boolean;
  defaultCurrency: string;
  defaultRegistrationEnabled: boolean;
  defaultBillingEnabled: boolean;
  defaultSmsNotifications: boolean;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-sport text-base font-bold text-foreground">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function SystemSettingsForm({ settings }: { settings: SystemSettingsFormData }) {
  const [state, action, pending] = useActionState(updateSystemSettingsAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Section title="Platform features" description="Master switches that apply across every club.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleSwitch
            name="aiFeaturesEnabled"
            label="AI features"
            help="Global master switch for AI-assisted features platform-wide."
            defaultChecked={settings.aiFeaturesEnabled}
          />
          <ToggleSwitch
            name="maintenanceMode"
            label="Maintenance mode"
            help="When on, surfaces a maintenance state to clubs. Use with care."
            defaultChecked={settings.maintenanceMode}
          />
        </div>
      </Section>

      <Section title="New club defaults" description="Defaults applied to newly created clubs (each club can override later).">
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <Label htmlFor="defaultCurrency">Default currency</Label>
          <Select id="defaultCurrency" name="defaultCurrency" defaultValue={settings.defaultCurrency}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleSwitch
            name="defaultRegistrationEnabled"
            label="Registration enabled by default"
            help="New clubs start with registration turned on."
            defaultChecked={settings.defaultRegistrationEnabled}
          />
          <ToggleSwitch
            name="defaultBillingEnabled"
            label="Billing enabled by default"
            help="New clubs start with billing/invoicing turned on."
            defaultChecked={settings.defaultBillingEnabled}
          />
          <ToggleSwitch
            name="defaultSmsNotifications"
            label="SMS notifications on by default"
            help="New clubs start with SMS notifications enabled."
            defaultChecked={settings.defaultSmsNotifications}
          />
        </div>
      </Section>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-primary" role="status">
          Settings saved.
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
