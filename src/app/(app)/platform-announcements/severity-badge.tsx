import { StatusBadge } from "@/components/console";

const TONE: Record<string, string> = {
  INFO: "bg-sky-100 text-sky-700",
  WARNING: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-destructive/10 text-destructive",
};

/** Severity pill: INFO=blue, WARNING=amber, CRITICAL=red (reuses StatusBadge). */
export function SeverityBadge({ severity }: { severity: string }) {
  return <StatusBadge status={severity} className={TONE[severity] ?? ""} />;
}
