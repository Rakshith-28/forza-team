import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterBar, FilterSelect, FilterText, PageHeader, Pagination } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { getMasterClubs } from "@/modules/master/service";
import { CLUB_STATUSES, parseIntParam, type ClubStatus } from "@/modules/master/schemas";

import { CreateClubForm } from "./club-forms";
import { ClubsTable } from "./clubs-table";

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const ctx = await requireRole("MASTER_ADMIN");
  const sp = await searchParams;
  const status = CLUB_STATUSES.includes(sp.status as ClubStatus) ? (sp.status as ClubStatus) : undefined;
  const search = sp.search?.trim() || undefined;
  const page = parseIntParam(sp.page) ?? 1;

  const result = await getMasterClubs(ctx, { search, status, page });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Clubs" description="Every club on the platform." />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">New club</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateClubForm />
        </CardContent>
      </Card>

      <div className="mt-6">
        <FilterBar>
          <FilterText name="search" label="Search" defaultValue={sp.search} placeholder="Name or short code" />
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={sp.status}
            options={CLUB_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </FilterBar>
      </div>

      <div className="mt-4">
        <ClubsTable rows={result.rows} />
      </div>

      <div className="mt-4">
        <Pagination
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          params={{ search: sp.search, status: sp.status }}
        />
      </div>
    </div>
  );
}
