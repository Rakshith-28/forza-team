"use client";

import { useState } from "react";

import {
  FilterBar,
  FilterSelect,
  FilterText,
  Pagination,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/console";
import { Button } from "@/components/ui/button";
import type { PlatformAnnouncementRow, PlatformTemplateRow } from "@/modules/announcements/platform-service";
import { ANNOUNCEMENT_STATUSES, SEVERITIES, SEVERITY_LABELS } from "@/modules/announcements/platform-schemas";

import { AnnouncementsTable } from "./announcements-table";
import { ComposerDialog } from "./composer-dialog";
import { TemplatesManager } from "./templates-manager";

export function PlatformAnnouncementsView({
  rows,
  total,
  page,
  pageSize,
  filters,
  clubOptions,
  templates,
}: {
  rows: PlatformAnnouncementRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: { search?: string; status?: string; severity?: string };
  clubOptions: { id: string; name: string }[];
  templates: PlatformTemplateRow[];
}) {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <Tabs defaultValue="announcements">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <Button type="button" onClick={() => setComposerOpen(true)}>
          New announcement
        </Button>
      </div>

      <TabsContent value="announcements">
        <div className="mb-4">
          <FilterBar>
            <FilterText name="search" label="Search" defaultValue={filters.search} placeholder="Title" />
            <FilterSelect
              name="status"
              label="Status"
              defaultValue={filters.status}
              options={ANNOUNCEMENT_STATUSES.map((s) => ({ value: s, label: s }))}
            />
            <FilterSelect
              name="severity"
              label="Severity"
              defaultValue={filters.severity}
              options={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
            />
          </FilterBar>
        </div>

        <AnnouncementsTable rows={rows} clubOptions={clubOptions} templates={templates} />

        <div className="mt-4">
          <Pagination page={page} pageSize={pageSize} total={total} params={filters} />
        </div>
      </TabsContent>

      <TabsContent value="templates">
        <TemplatesManager templates={templates} />
      </TabsContent>

      <ComposerDialog open={composerOpen} onOpenChange={setComposerOpen} clubOptions={clubOptions} templates={templates} />
    </Tabs>
  );
}
