/**
 * Accessible toggle switch backed by a real (visually hidden) checkbox, so any
 * surrounding form submits it by `name` exactly like a checkbox — no JS state or
 * server changes needed. The whole row is a label: a large, mobile-friendly tap
 * target. Shared across the account + club + system settings forms.
 */
export function ToggleSwitch({
  name,
  label,
  help,
  defaultChecked,
}: {
  name: string;
  label: string;
  help?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border bg-background/40 p-4 transition-colors hover:border-primary/40 has-checked:border-primary/40 has-checked:bg-primary/5">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {help ? <span className="block text-xs text-muted-foreground">{help}</span> : null}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card" />
        <span className="absolute left-0.5 size-5 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
