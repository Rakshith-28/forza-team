import { describe, expect, it } from "vitest";

import { computeCoachImpact } from "@/modules/coaches/service";

/**
 * Pure coach-deletion impact rule (deletion-spec §3): a team is "coachless" ONLY
 * when zero coaches remain after removing the target. Otherwise coverage remains
 * and a covering coach is named. Distinct from the "orphan club" concept.
 */

const TC = (teamId: string, teamName: string, userId: string, coachName: string) => ({
  teamId,
  teamName,
  userId,
  coachName,
});

describe("computeCoachImpact", () => {
  it("reports coachless when the target is the team's only coach", () => {
    const impact = computeCoachImpact("c1", [TC("t1", "U12", "c1", "Sam Sole")]);
    expect(impact).toEqual([{ teamId: "t1", teamName: "U12", willBeCoachless: true, remainingCoachName: null }]);
  });

  it("reports coverage remains when another coach is on the team", () => {
    const impact = computeCoachImpact("c1", [
      TC("t1", "U12", "c1", "Sam Sole"),
      TC("t1", "U12", "c2", "Ada Assist"),
    ]);
    expect(impact).toEqual([
      { teamId: "t1", teamName: "U12", willBeCoachless: false, remainingCoachName: "Ada Assist" },
    ]);
  });

  it("evaluates each of the target's teams independently", () => {
    const impact = computeCoachImpact("c1", [
      TC("t1", "U12", "c1", "Sam"), // solo on t1 → coachless
      TC("t2", "U14", "c1", "Sam"),
      TC("t2", "U14", "c2", "Bo"), // shared on t2 → coverage remains
    ]);
    const byTeam = Object.fromEntries(impact.map((i) => [i.teamId, i]));
    expect(byTeam.t1).toMatchObject({ willBeCoachless: true, remainingCoachName: null });
    expect(byTeam.t2).toMatchObject({ willBeCoachless: false, remainingCoachName: "Bo" });
    expect(impact).toHaveLength(2);
  });

  it("only includes teams the target actually coaches", () => {
    const impact = computeCoachImpact("c1", [TC("t1", "U12", "c2", "Other")]);
    expect(impact).toEqual([]);
  });
});
