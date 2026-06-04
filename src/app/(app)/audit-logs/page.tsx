import { FilterBar, FilterSelect, PageHeader, Pagination } from "@/components/console";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth-guards";
import { getAuditFilterOptions, getMasterAuditLogs, listClubOptions } from "@/modules/master/service";
import { parseIntParam } from "@/modules/master/schemas";

import { AuditTable } from "./audit-table";

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const d = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date_from?: string;
    date_to?: string;
    actor?: string;
    club_id?: string;
    action?: string;
    resource_type?: string;
    page?: string;
  }>;
}) {
  const ctx = await requireRole("MASTER_ADMIN");
  const sp = await searchParams;

  const [result, options, clubOptions] = await Promise.all([
    getMasterAuditLogs(ctx, {
      dateFrom: parseDate(sp.date_from),
      dateTo: parseDate(sp.date_to, true),
      actorUserId: sp.actor || undefined,
      clubId: sp.club_id || undefined,
      action: sp.action || undefined,
      resourceType: sp.resource_type || undefined,
      page: parseIntParam(sp.page) ?? 1,
    }),
    getAuditFilterOptions(ctx),
    listClubOptions(ctx),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Audit Logs" description="System-wide record of sensitive actions." />

      <div className="mt-6">
        <FilterBar>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-date_from">From</Label>
            <Input id="f-date_from" name="date_from" type="date" defaultValue={sp.date_from ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-date_to">To</Label>
            <Input id="f-date_to" name="date_to" type="date" defaultValue={sp.date_to ?? ""} />
          </div>
          <FilterSelect
            name="actor"
            label="Actor"
            defaultValue={sp.actor}
            allLabel="All actors"
            options={options.actors.map((a) => ({ value: a.id, label: a.name }))}
          />
          <FilterSelect
            name="club_id"
            label="Club"
            defaultValue={sp.club_id}
            allLabel="All clubs"
            options={clubOptions.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            name="action"
            label="Action"
            defaultValue={sp.action}
            allLabel="All actions"
            options={options.actions.map((a) => ({ value: a, label: a }))}
          />
          <FilterSelect
            name="resource_type"
            label="Resource"
            defaultValue={sp.resource_type}
            allLabel="All resources"
            options={options.resourceTypes.map((r) => ({ value: r, label: r }))}
          />
        </FilterBar>
      </div>

      <div className="mt-4">
        <AuditTable rows={result.rows} />
      </div>

      <div className="mt-4">
        <Pagination
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          params={{
            date_from: sp.date_from,
            date_to: sp.date_to,
            actor: sp.actor,
            club_id: sp.club_id,
            action: sp.action,
            resource_type: sp.resource_type,
          }}
        />
      </div>
    </div>
  );
}
