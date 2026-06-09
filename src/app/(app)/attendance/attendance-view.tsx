"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { MessageSquarePlus } from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/console";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { addPlayerRemarkAction, setRemarkVisibilityAction } from "@/modules/remarks/actions";
import { INITIAL_STATE } from "@/modules/remarks/action-state";

export interface AttendanceRow {
  playerId: string;
  name: string;
  attended: number;
  total: number;
  pct: number | null;
}

export interface RemarkItem {
  id: string;
  body: string;
  parentVisible: boolean;
  createdAt: string; // ISO
}

export interface PlayerRemarks {
  playerId: string;
  name: string;
  remarks: RemarkItem[];
}

export interface TrendPoint {
  /** Compact x-axis label, e.g. "Jun 3". */
  label: string;
  /** Full date/time for the hover tooltip. */
  fullLabel: string;
  pct: number;
  attended: number;
  total: number;
}

/** Color the attendance ratio: green ≥80%, amber ≥50%, red below, muted if none. */
function pctTone(pct: number | null): string {
  if (pct === null) return "bg-muted";
  if (pct >= 80) return "bg-primary";
  if (pct >= 50) return "bg-amber-500";
  return "bg-destructive";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Coach/admin attendance surface: an Overview tab (team-average graph + each
 * player's percentage) and a Remarks tab (private coach notes per player with a
 * parent-visibility toggle). Team selection stays URL-driven in the page; this
 * component handles the tabs and the remark dialogs/toggles.
 */
export function AttendanceView({
  rows,
  remarks,
  trend,
}: {
  rows: AttendanceRow[];
  remarks: PlayerRemarks[];
  trend: TrendPoint[];
}) {
  const tracked = rows.filter((r) => r.pct !== null);
  const teamAvg =
    tracked.length > 0 ? Math.round(tracked.reduce((sum, r) => sum + (r.pct ?? 0), 0) / tracked.length) : null;

  return (
    <Tabs defaultValue="overview" className="mt-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="remarks">Remarks</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewPanel rows={rows} teamAvg={teamAvg} tracked={tracked.length} trend={trend} />
      </TabsContent>

      <TabsContent value="remarks">
        <RemarksPanel players={remarks} />
      </TabsContent>
    </Tabs>
  );
}

function OverviewPanel({
  rows,
  teamAvg,
  tracked,
  trend,
}: {
  rows: AttendanceRow[];
  teamAvg: number | null;
  tracked: number;
  trend: TrendPoint[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        No players on this team yet.
      </p>
    );
  }

  return (
    <>
      {/* Attendance over time: a headline average + a date-vs-percentage line. */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Team average</p>
            <p className="text-4xl font-bold tabular-nums text-foreground">{teamAvg === null ? "—" : `${teamAvg}%`}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {tracked} of {rows.length} {rows.length === 1 ? "player" : "players"} tracked
          </p>
        </div>

        <AttendanceTrendChart points={trend} />
      </div>

      {/* Per-player detail (links to the drill-down). */}
      <div className="mt-6 flex flex-col gap-2">
        {rows.map((r) => (
          <Link
            key={r.playerId}
            href={`/attendance/${r.playerId}`}
            className="flex items-center gap-4 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{r.name}</p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${pctTone(r.pct)}`} style={{ width: `${r.pct ?? 0}%` }} />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold tabular-nums text-foreground">{r.pct === null ? "—" : `${r.pct}%`}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {r.total === 0 ? "no records" : `${r.attended}/${r.total} events`}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

/**
 * Date-vs-percentage attendance line graph. Dependency-free SVG (line + area
 * over a 0–100 viewBox, stretched with a non-scaling stroke) plus absolutely
 * positioned hit-dots: hovering or focusing a point shows a tooltip with the
 * event date, percentage, and attended/total.
 */
function AttendanceTrendChart({ points }: { points: TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <p className="mt-5 rounded-lg border border-dashed bg-background/40 p-6 text-center text-sm text-muted-foreground">
        No attendance recorded yet. Mark attendance on an event to start the trend.
      </p>
    );
  }

  const n = points.length;
  const xPct = (i: number) => (n === 1 ? 50 : 4 + (i / (n - 1)) * 92);
  const yPct = (pct: number) => 100 - pct; // 100% → top, 0% → bottom

  const line = points.map((p, i) => `${xPct(i)},${yPct(p.pct)}`).join(" ");
  const area = `M ${xPct(0)},100 L ${points.map((p, i) => `${xPct(i)},${yPct(p.pct)}`).join(" L ")} L ${xPct(n - 1)},100 Z`;

  return (
    <div className="mt-5">
      <div className="flex gap-2">
        {/* y-axis ticks */}
        <div className="flex h-56 w-9 shrink-0 flex-col justify-between py-1 text-right text-[10px] tabular-nums text-muted-foreground">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        {/* plot area */}
        <div className="relative h-56 flex-1">
          <svg
            className="absolute inset-0 h-full w-full overflow-visible text-primary"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {[0, 50, 100].map((y) => (
              <line
                key={y}
                x1="0"
                x2="100"
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} className="fill-primary/10" />
            <polyline
              points={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* hit-dots + tooltip */}
          {points.map((p, i) => {
            const isActive = active === i;
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                aria-label={`${p.fullLabel}: ${p.pct}% attendance, ${p.attended} of ${p.total}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                style={{ left: `${xPct(i)}%`, top: `${yPct(p.pct)}%` }}
              >
                <span
                  className={`block rounded-full border-2 border-card bg-primary transition-all ${
                    isActive ? "size-3.5 ring-2 ring-primary/40" : "size-2.5"
                  }`}
                />
                {isActive ? (
                  <span
                    className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border bg-popover px-2.5 py-1.5 text-left shadow-lg"
                    role="status"
                  >
                    <span className="block text-[11px] font-medium text-foreground">{p.fullLabel}</span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {p.pct}% · {p.attended}/{p.total} present
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* x-axis date labels, aligned under each point */}
      <div className="relative ml-11 mt-2 h-4">
        {points.map((p, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground"
            style={{ left: `${xPct(i)}%` }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RemarksPanel({ players }: { players: PlayerRemarks[] }) {
  if (players.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        No players on this team yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Remarks are private by default. Turn on “Visible to parents” to share a note — the player&apos;s
        parent(s) get a bell notification (it never appears in announcements).
      </p>
      {players.map((p) => (
        <PlayerRemarkCard key={p.playerId} player={p} />
      ))}
    </div>
  );
}

function PlayerRemarkCard({ player }: { player: PlayerRemarks }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">{player.name}</p>
        <AddRemarkDialog playerId={player.playerId} playerName={player.name} />
      </div>

      {player.remarks.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {player.remarks.map((r) => (
            <RemarkRow key={r.id} remark={r} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No remarks yet.</p>
      )}
    </div>
  );
}

function AddRemarkDialog({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Drive the server action manually so we can close the dialog in the result
  // callback (event-driven) rather than from an effect.
  function handleSubmit(fd: FormData) {
    startTransition(async () => {
      const res = await addPlayerRemarkAction(INITIAL_STATE, fd);
      if (res.ok) {
        setError(null);
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquarePlus className="size-4" aria-hidden />
          Add remark
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remark · {playerName}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form action={handleSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="playerId" value={playerId} />
            <textarea
              name="body"
              required
              rows={5}
              placeholder="Write a private note about this player…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <ToggleSwitch
              name="parentVisible"
              label="Visible to parents"
              help="Shares this note and sends the parent(s) a bell notification."
            />
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save remark"}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function RemarkRow({ remark }: { remark: RemarkItem }) {
  const [state, action, pending] = useActionState(setRemarkVisibilityAction, INITIAL_STATE);

  return (
    <li className="rounded-lg border bg-background/40 p-3">
      <p className="whitespace-pre-wrap text-sm text-foreground">{remark.body}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{fmtDate(remark.createdAt)}</span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              remark.parentVisible ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {remark.parentVisible ? "Shared" : "Private"}
          </span>
          <form action={action}>
            <input type="hidden" name="remarkId" value={remark.id} />
            {/* Submit the OPPOSITE of the current visibility. */}
            {!remark.parentVisible ? <input type="hidden" name="parentVisible" value="on" /> : null}
            <Button type="submit" variant="ghost" size="sm" disabled={pending} className="h-7 px-2 text-xs">
              {remark.parentVisible ? "Make private" : "Share with parents"}
            </Button>
          </form>
        </div>
      </div>
      {state.error ? <p className="mt-1 text-xs text-destructive" role="alert">{state.error}</p> : null}
    </li>
  );
}
