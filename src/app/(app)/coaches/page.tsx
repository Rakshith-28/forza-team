import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterSelect, FilterText, PageHeader, Pagination, TwoPane } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { listTeams } from "@/modules/clubs/service";
import { COACH_ROLE_LABELS, COACH_ROLE_TYPES } from "@/modules/clubs/schemas";
import { CopyInviteLinkButton } from "@/components/app/copy-invite-link-button";
import { copyCoachInviteLinkAction, removeCoachAssignmentAction } from "@/modules/coaches/actions";
import { listCoaches, type CoachRow } from "@/modules/coaches/service";
import { COACH_STATUSES, type CoachStatus } from "@/modules/coaches/schemas";
import { getMasterCoaches, listClubOptions } from "@/modules/master/service";
import { parseIntParam } from "@/modules/master/schemas";

import { AssignCoachForm, InviteCoachForm } from "./coach-forms";
import { MasterCoachesTable } from "./master-coaches-table";

const MASTER_COACH_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

function CoachStatusBadge({ status }: { status: CoachStatus }) {
  const tone =
    status === "ACTIVE"
      ? "bg-primary/10 text-primary"
      : status === "PENDING"
        ? "bg-amber-100 text-amber-700"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}

function roleLabel(roleType: string): string {
  return COACH_ROLE_LABELS[roleType as keyof typeof COACH_ROLE_LABELS] ?? roleType;
}

function initial(name: string, email: string): string {
  return (name.trim()[0] ?? email[0] ?? "?").toUpperCase();
}

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{
    team?: string;
    status?: string;
    search?: string;
    club_id?: string;
    role_type?: string;
    page?: string;
  }>;
}) {
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN");

  // Master Admin: platform-wide coaches table (not scoped to one club).
  if (ctx.role === "MASTER_ADMIN") {
    const sp = await searchParams;
    const status = (MASTER_COACH_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
    const roleType = (COACH_ROLE_TYPES as readonly string[]).includes(sp.role_type ?? "") ? sp.role_type : undefined;
    const [result, clubOptions] = await Promise.all([
      getMasterCoaches(ctx, {
        search: sp.search?.trim() || undefined,
        clubId: sp.club_id || undefined,
        status,
        roleType,
        page: parseIntParam(sp.page) ?? 1,
      }),
      listClubOptions(ctx),
    ]);

    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Coaches" description="Every coach across the platform." />

        <div className="mt-6">
          <FilterBar>
            <FilterText name="search" label="Search" defaultValue={sp.search} placeholder="Name or email" />
            <FilterSelect
              name="club_id"
              label="Club"
              defaultValue={sp.club_id}
              allLabel="All clubs"
              options={clubOptions.map((c) => ({ value: c.id, label: c.name }))}
            />
            <FilterSelect
              name="status"
              label="Status"
              defaultValue={sp.status}
              options={MASTER_COACH_STATUSES.map((s) => ({ value: s, label: s }))}
            />
            <FilterSelect
              name="role_type"
              label="Role Type"
              defaultValue={sp.role_type}
              options={COACH_ROLE_TYPES.map((r) => ({ value: r, label: COACH_ROLE_LABELS[r] }))}
            />
          </FilterBar>
        </div>

        <div className="mt-4">
          <MasterCoachesTable rows={result.rows} />
        </div>

        <div className="mt-4">
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            params={{ search: sp.search, club_id: sp.club_id, status: sp.status, role_type: sp.role_type }}
          />
        </div>
      </div>
    );
  }

  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;
  const sp = await searchParams;
  const statusFilter = COACH_STATUSES.includes(sp.status as CoachStatus) ? (sp.status as CoachStatus) : undefined;
  const filters = { team: sp.team || undefined, status: statusFilter, search: sp.search || undefined };

  const [coaches, teams] = await Promise.all([listCoaches(ctx, clubId, filters), listTeams(ctx, clubId)]);
  const teamOptions = teams.filter((t) => t.status !== "ARCHIVED").map((t) => ({ id: t.id, name: t.name }));

  return (
    <TwoPane
      title="Coaches"
      description="Invite coaches and assign them to teams."
      formTitle="Invite a coach"
      form={<InviteCoachForm teams={teamOptions} />}
    >
      {/* Filters */}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="f-search">Search</Label>
          <Input id="f-search" name="search" defaultValue={sp.search ?? ""} placeholder="Name or email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-team">Team</Label>
          <Select id="f-team" name="team" defaultValue={sp.team ?? ""}>
            <option value="">All teams</option>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-status">Status</Label>
          <Select id="f-status" name="status" defaultValue={sp.status ?? ""}>
            <option value="">All</option>
            {COACH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-3">
        {coaches.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No coaches yet — invite your first coach.
          </p>
        ) : (
          coaches.map((c) => <CoachCard key={`${c.kind}-${c.id}`} coach={c} teamOptions={teamOptions} />)
        )}
      </div>
    </TwoPane>
  );
}

function CoachCard({ coach, teamOptions }: { coach: CoachRow; teamOptions: { id: string; name: string }[] }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
            {initial(coach.name, coach.email)}
          </span>
          <div>
            <p className="font-sport text-base font-bold text-foreground">{coach.name}</p>
            <p className="text-sm text-muted-foreground">{coach.email}</p>
            {coach.lastLoginAt ? (
              <p className="text-xs text-muted-foreground">Last login {coach.lastLoginAt.toISOString().slice(0, 10)}</p>
            ) : null}
          </div>
        </div>
        <CoachStatusBadge status={coach.status} />
      </div>

      {/* Assigned teams + per-assignment remove */}
      <div className="mt-3 flex flex-wrap gap-2">
        {coach.teams.length === 0 ? (
          <span className="text-sm text-muted-foreground">No team assignments</span>
        ) : (
          coach.teams.map((t) => (
            <span key={t.teamId} className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
              <span className="font-medium text-foreground">{t.teamName}</span>
              <span className="text-muted-foreground">{roleLabel(t.roleType)}</span>
              {coach.kind === "USER" ? (
                <form action={removeCoachAssignmentAction}>
                  <input type="hidden" name="teamId" value={t.teamId} />
                  <input type="hidden" name="userId" value={coach.id} />
                  <button type="submit" className="font-medium text-muted-foreground hover:text-destructive" aria-label={`Remove from ${t.teamName}`}>
                    ✕
                  </button>
                </form>
              ) : null}
            </span>
          ))
        )}
      </div>

      {coach.kind === "USER" ? (
        <div className="mt-3 border-t pt-3">
          <AssignCoachForm userId={coach.id} teams={teamOptions} />
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <CopyInviteLinkButton invitationId={coach.id} action={copyCoachInviteLinkAction} />
        </div>
      )}
    </div>
  );
}
