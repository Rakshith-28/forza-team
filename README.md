# Forza Team

A multi-tenant soccer club management platform (Next.js 16, React 19, Prisma 7
on Neon, Tailwind v4 + shadcn/ui). Because it stores **minors' personal data**,
tenant isolation and child-safety are architectural requirements.

- **Build plan / source of truth:** [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)
- **Working conventions & rules:** [CLAUDE.md](CLAUDE.md)

## Getting started

Requires Node 20.19+, 22.12+, or 24+ (Prisma 7 does not support odd releases
like 23.x).

```bash
npm install
cp .env.example .env   # then fill in Neon + auth values
npm run db:generate    # generate the Prisma client
npm run dev            # http://localhost:3000
```

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | `prisma migrate dev` (needs a database) |
| `npm run db:studio` | Prisma Studio |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, and build on every PR.
