import { describe, expect, it } from "vitest";

import * as clubs from "@/modules/clubs/service";
import * as roster from "@/modules/roster/service";

/**
 * Players & Teams are HARD-delete only — the soft-delete/archive path was removed
 * (deletion-spec). Guard against it creeping back: the archive services must be
 * gone, the hard-delete services must remain.
 */
describe("archive removed for players & teams", () => {
  it("no longer exports archivePlayer / archiveTeam", () => {
    expect((roster as Record<string, unknown>).archivePlayer).toBeUndefined();
    expect((clubs as Record<string, unknown>).archiveTeam).toBeUndefined();
  });

  it("still exposes the hard-delete services", () => {
    expect(typeof roster.deletePlayer).toBe("function");
    expect(typeof clubs.deleteTeam).toBe("function");
  });
});
