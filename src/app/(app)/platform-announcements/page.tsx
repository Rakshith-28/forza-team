import { PageHeader } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { getPlatformAnnouncements, listPlatformTemplates } from "@/modules/announcements/platform-service";
import { listClubOptions } from "@/modules/master/service";
import { ANNOUNCEMENT_STATUSES, SEVERITIES, type AnnouncementStatus, type Severity } from "@/modules/announcements/platform-schemas";
import { parseIntParam } from "@/modules/master/schemas";

import { PlatformAnnouncementsView } from "./view";

export default async function PlatformAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; severity?: string; page?: string }>;
}) {
  const ctx = await requireRole("MASTER_ADMIN");
  const sp = await searchParams;
  const status = ANNOUNCEMENT_STATUSES.includes(sp.status as AnnouncementStatus) ? (sp.status as AnnouncementStatus) : undefined;
  const severity = SEVERITIES.includes(sp.severity as Severity) ? (sp.severity as Severity) : undefined;

  const [result, clubOptions, templates] = await Promise.all([
    getPlatformAnnouncements(ctx, { search: sp.search?.trim() || undefined, status, severity, page: parseIntParam(sp.page) ?? 1 }),
    listClubOptions(ctx),
    listPlatformTemplates(ctx),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Platform Announcements" description="Broadcast system notices to clubs across the platform." />
      <div className="mt-6">
        <PlatformAnnouncementsView
          rows={result.rows}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          filters={{ search: sp.search, status: sp.status, severity: sp.severity }}
          clubOptions={clubOptions}
          templates={templates}
        />
      </div>
    </div>
  );
}
