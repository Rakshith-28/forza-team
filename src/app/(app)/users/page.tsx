import { FilterBar, FilterSelect, FilterText, PageHeader, Pagination } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { ROLES, ROLE_LABELS } from "@/lib/rbac";
import { getMasterUsers, listClubOptions } from "@/modules/master/service";
import { USER_STATUSES, parseIntParam, type UserStatus } from "@/modules/master/schemas";

import { UsersTable } from "./users-table";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string; club_id?: string; status?: string; page?: string }>;
}) {
  const ctx = await requireRole("MASTER_ADMIN");
  const sp = await searchParams;
  const role = (ROLES as readonly string[]).includes(sp.role ?? "") ? sp.role : undefined;
  const status = USER_STATUSES.includes(sp.status as UserStatus) ? (sp.status as UserStatus) : undefined;

  const [result, clubOptions] = await Promise.all([
    getMasterUsers(ctx, {
      search: sp.search?.trim() || undefined,
      role,
      clubId: sp.club_id || undefined,
      status,
      page: parseIntParam(sp.page) ?? 1,
    }),
    listClubOptions(ctx),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Users" description="Every account across the platform." />

      <div className="mt-6">
        <FilterBar>
          <FilterText name="search" label="Search" defaultValue={sp.search} placeholder="Name or email" />
          <FilterSelect
            name="role"
            label="Role"
            defaultValue={sp.role}
            allLabel="All roles"
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          />
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
            options={USER_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </FilterBar>
      </div>

      <div className="mt-4">
        <UsersTable rows={result.rows} />
      </div>

      <div className="mt-4">
        <Pagination
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          params={{ search: sp.search, role: sp.role, club_id: sp.club_id, status: sp.status }}
        />
      </div>
    </div>
  );
}
