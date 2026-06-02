# Domain modules

Each subdirectory is a **domain module** — the real boundary of the app (see
@docs/BUILD_PLAN.md §2). A module owns its slice of the Prisma schema, its
service/data-access layer, and its Zod validators. Modules talk to each other
**only through exported service functions**, never by importing another
module's tables or reaching into its internals.

Conventional layout inside a module (added as each phase needs it):

```
<module>/
├── service.ts        # data-access layer: the ONLY place that queries Prisma
├── <module>.schema.ts# Zod schemas (shared by client forms + server actions)
├── types.ts          # domain types derived from the schemas
└── index.ts          # the module's public surface (re-exports services)
```

## Modules & phases

| Module        | Owns                                              | Phase |
| ------------- | ------------------------------------------------- | ----- |
| `identity`    | users, roles, sessions (Better Auth glue)         | 1     |
| `clubs`       | clubs, seasons, teams, coach assignments          | 2     |
| `roster`      | players, parents, parent↔child linkage            | 3     |
| `comms`       | announcements, chat, documents                    | 4     |
| `schedule`    | events, RSVP, attendance                          | 5     |
| `reporting`   | per-role dashboards                               | 6     |
| `evaluations` | player evaluations, development tracking          | 7     |

## Non-negotiables (enforced in every service)

- **Tenant scoping.** Every tenant-owned query is scoped by the caller's active
  `clubId`. Cross-tenant reads must be impossible by construction.
- **Layered RBAC.** Services assert scope (`assertClubScope` /
  `assertTeamScope` / `assertChildScope`) — they never trust the UI or
  middleware alone.
- **Parent-safe projections.** Queries that can reach a `PARENT` strip other
  families' PII in the data layer, not the view.
