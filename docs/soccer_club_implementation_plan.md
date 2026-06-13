# Soccer Club Management App - Implementation Plan Specification

## 1. Document Purpose
This document defines the recommended implementation plan for the Soccer Club Management App. It translates the previously created requirements, architecture, schema, API, UI/UX, RBAC, component, testing, and seed-data documents into a practical build sequence for Claude Code and engineering teams.

The implementation plan is designed to:
- reduce delivery risk
- sequence work by dependency and business value
- support incremental releases
- enable early testing and demo readiness
- keep the architecture modular while maintaining delivery speed

This plan assumes a **modular monolith** approach for the initial product and can later evolve into more distributed services if scale or organizational needs require it.

---

## 2. Delivery Strategy Overview
The recommended delivery approach is:

1. **Foundation first**
   - auth, roles, club/team structure, shared app shell, base RBAC
2. **Core operations second**
   - roster, parent-child linking, announcements/chat, schedule, RSVP, attendance
3. **Operational monetization and compliance third**
   - registration, billing, payments, waivers
4. **Player development and competitive differentiation fourth**
   - evaluations, position weights, radar comparison, development tracking
5. **Scale-up and productivity enhancements fifth**
   - AI assistant features, richer reports, performance hardening, mobile optimization

This order maximizes business usability early while preserving a clean path for advanced features.

---

## 3. Delivery Assumptions

### Team Assumptions
This implementation plan assumes some or all of the following delivery roles may exist, even if one engineer or Claude Code is handling multiple responsibilities:
- product/spec owner
- frontend engineer
- backend engineer
- QA / validation
- DevOps / release support

### Technical Assumptions
- Next.js + TypeScript frontend
- NestJS + TypeScript backend
- PostgreSQL database
- Redis-backed async jobs
- object storage for files
- REST API first
- role-aware web UI first
- mobile-ready architecture, mobile app later or parallel if capacity exists

### Release Assumptions
- early internal demo release after foundational modules
- later club pilot after core admin/parent workflows are stable
- phased release toggles possible using feature flags

---

## 4. Guiding Implementation Principles
1. **Build vertical slices**, not only horizontal layers.
2. **Protect security and privacy early** — tenant isolation and linked-child access must not wait until later.
3. **Keep data model stable first** before adding more advanced reporting.
4. **Prioritize operational workflows** that make the app usable by real clubs quickly.
5. **Add AI only after source workflows and permissions are stable**.
6. **Use seed data and automated tests continuously**, not just near release.
7. **Demoable at every phase** whenever possible.

---

## 5. Implementation Phases

## Phase 0 - Project Bootstrap and Engineering Foundation
### Objective
Create the repo, runtime scaffolding, architecture skeleton, and engineering conventions.

### Goals
- establish project structure
- create backend and frontend skeletons
- set up CI basics
- establish coding standards and shared types
- prepare migrations and seed infrastructure

### Backend Work
- initialize NestJS app structure
- set up modules directory structure
- configure PostgreSQL connection and migration tooling
- configure Redis connection for background jobs
- add environment configuration system
- create health-check endpoint
- add structured logging base

### Frontend Work
- initialize Next.js app
- set up app shell skeleton
- configure routing structure
- install query, form, chart, and state libraries
- create design-system primitive folder structure

### Shared Work
- configure linting, formatting, type checking
- define branch/PR conventions
- define naming conventions for DTOs/entities/components
- set up seed data package structure
- create initial test harness

### Deliverables
- running frontend shell
- running backend service
- DB connection verified
- CI pipeline with lint/typecheck/unit-test placeholders
- basic local environment documentation

### Exit Criteria
- repo runs locally end-to-end
- empty app shell loads
- backend health endpoint works
- DB migrations can be applied and reset

---

## Phase 1 - Identity, Auth, and RBAC Foundation
### Objective
Implement login, role model, access scoping, and protected navigation.

### Goals
- authenticate users securely
- model master admin, club admin, coach, and parent roles
- enforce tenant/team/child scoping at backend and frontend
- enable invitation-based onboarding skeleton

### Backend Work
- implement `users`, `roles`, `user_role_assignments`
- build login, logout, refresh, forgot/reset password
- add password hashing and token/session strategy
- implement auth guards
- implement role guard and scope helper services
- implement audit log base for auth-sensitive actions
- add invitation and password reset token flows

### Frontend Work
- login page
- forgot/reset password pages
- invitation acceptance page
- auth context/provider
- protected route handling
- basic role-aware navigation rendering
- profile menu shell

### QA / Validation Work
- unit tests for auth and scope helpers
- integration tests for role/scope enforcement
- E2E login and redirect by role

### Deliverables
- authenticated user can log in
- role-specific dashboard shell route works
- unauthorized access blocked
- invitation acceptance skeleton works

### Dependencies
- Phase 0 complete

### Exit Criteria
- auth flow stable across all roles
- role-aware routing works
- backend guards enforced for sample endpoints

---

## Phase 2 - Multi-Tenant Club / Season / Team Management
### Objective
Enable club structure, seasons, teams, coach assignments, and basic club administration.

### Goals
- create/manage clubs (master admin)
- create/manage seasons and teams (club admin)
- assign coaches to teams
- expose team detail views

### Backend Work
- clubs module
- club settings base
- seasons module
- teams module
- team coach assignment module
- master admin club management APIs
- club dashboard summary API skeleton

### Frontend Work
- master admin dashboard
- clubs list/detail pages
- club admin dashboard skeleton
- teams list/create/edit pages
- team detail page skeleton
- coaches assignment UI basic flow

### QA / Validation Work
- cross-tenant negative tests
- create/edit/archive team tests
- team assignment tests

### Deliverables
- master admin can create club
- club admin can create season and teams
- coach can see assigned team context

### Exit Criteria
- club/team structure stable enough for player/roster data onboarding

---

## Phase 3 - Roster, Players, Parents, and Linked-Child Access
### Objective
Build the first truly usable team-management workflows.

### Goals
- manage players and parent links
- support one parent login with multiple linked children
- enforce privacy-safe roster visibility
- allow parent to edit only own child approved fields

### Backend Work
- `players`, `parents`, `player_parent_links`, `player_team_memberships`
- roster list endpoints with safe/full projections
- player detail/update endpoints
- parent linked-children endpoint
- parent-safe serializer/projection logic

### Frontend Work
- players page
- player detail page
- parents page
- parent detail page
- coach roster page
- parent roster page (safe projection)
- child switcher
- child profile edit page

### QA / Validation Work
- parent-safe roster tests
- parent cannot edit another child tests
- coach unassigned team access denied tests
- multi-child parent workflow tests

### Deliverables
- club admin can add players and link parents
- coach can manage roster for assigned teams
- parent can access all linked children in one login

### Exit Criteria
- parent privacy behavior validated
- roster is fully usable for coaches and parents

---

## Phase 4 - Announcements, Chat, and Documents
### Objective
Enable core team communication and shared file workflows.

### Goals
- club/team announcements
- team chat
- file upload and shared document support
- parent and coach communication flows

### Backend Work
- announcements module
- chats/messages/chat_members module
- files module
- upload endpoint and storage integration
- realtime gateway for team chat
- notification event hooks for new announcements/messages

### Frontend Work
- announcements list/create/edit pages
- team chat page
- conversation list/thread/composer
- documents page
- file uploader integration in applicable modules

### QA / Validation Work
- message send/read flow tests
- attachment tests
- announcement publish notification tests
- parent-to-parent chat disabled behavior tests

### Deliverables
- coach can send team messages
- club admin can publish announcements
- parent can read announcements and participate in team chat where enabled

### Exit Criteria
- communication workflow stable enough for pilot use

---

## Phase 5 - Scheduling, RSVP, and Attendance
### Objective
Add daily operational team-management workflows.

### Goals
- coaches/admins can create events
- parents can RSVP per child
- coaches can mark attendance quickly
- dashboards can summarize upcoming events and attendance

### Backend Work
- events module
- event attachments
- RSVPs
- attendance records
- reminder job hooks
- attendance summary endpoints

### Frontend Work
- schedule page (calendar/list)
- event create/edit form
- event detail drawer/page
- parent schedule page
- RSVP selector
- attendance table and quick-entry UI
- dashboard upcoming events panels

### QA / Validation Work
- event CRUD tests
- RSVP own-child-only tests
- attendance coach-only write tests
- multi-child schedule aggregation tests
- mobile attendance flow exploratory tests

### Deliverables
- coach can create team events and take attendance
- parent can RSVP for each linked child
- club admin can see attendance trends

### Exit Criteria
- schedule and attendance stable for daily operational use

---

## Phase 6 - Registration, Billing, Payments, and Waivers
### Objective
Enable club operations, monetization, and compliance.

### Goals
- create registration programs/forms
- collect registrations from parents
- generate invoices and payment flows
- manage waivers and acceptance tracking

### Backend Work
- registration programs/forms/submissions/answers
- family accounts and invoice model
- invoice items, payments, payment plans, refunds
- waiver and version model
- waiver acceptance tracking
- payment provider abstraction + webhook handling
- reminder jobs for overdue invoices and incomplete registration

### Frontend Work
- registration pages (programs, forms, submissions)
- parent registration wizard
- admin submissions review UI
- payments pages (admin + parent)
- invoice detail drawer/page
- waiver list and waiver viewer/sign flow
- payment reminders and status badges

### QA / Validation Work
- end-to-end registration + payment + waiver journey
- webhook idempotency tests
- invoice balance correctness tests
- parent invoice isolation tests
- waiver compliance tests

### Deliverables
- parent can register child, pay invoice, sign waiver
- club admin can manage registration and finance workflows

### Exit Criteria
- no critical billing/privacy issues
- payment and waiver flows validated in staging-like environment

---

## Phase 7 - Evaluations, Position Weights, Radar Comparison, Development Tracking
### Objective
Deliver the major differentiator inspired by the ranking/radar workbook.

### Goals
- configure evaluation templates and criteria
- configure position-based weight profiles
- score players and compute weighted results
- rank and bucket players
- compare 2–3 players via radar chart
- track development goals and updates

### Backend Work
- evaluation templates and criteria
- position weight profiles and items
- evaluation cycles
- player evaluations and criterion scores
- ranking and bucketing logic
- leaderboard and radar comparison endpoints
- development goals and updates

### Frontend Work
- evaluations admin pages (templates, criteria, position weights, cycles)
- coach evaluation form and leaderboard page
- radar comparison page
- player development tab and development tracking page
- parent development summary page (feature-flagged / settings-controlled)

### QA / Validation Work
- unit tests for scoring and bucket thresholds
- integration tests for position weights and radar payloads
- E2E evaluation + radar workflow
- parent visibility tests for own-child-only summaries

### Deliverables
- coach can evaluate players and compare them visually
- club admin can manage templates and weights
- development tracking workflows available

### Exit Criteria
- scoring accuracy validated
- parent privacy maintained for evaluations

---

## Phase 8 - Reporting and Notifications Hardening
### Objective
Strengthen the platform for operational visibility and ongoing use.

### Goals
- dashboards and reports across attendance, billing, registration, evaluations
- robust notification preferences and delivery flows
- summary panels for each role

### Backend Work
- reporting endpoints
- notifications list and preference endpoints
- summary aggregation optimization
- background jobs for reminders and digests

### Frontend Work
- reports page tabs
- notifications page and preference form
- richer dashboard summaries for club admin, coach, and parent

### QA / Validation Work
- report accuracy validation
- notification opt-out tests
- performance testing for dashboard/report queries

### Deliverables
- operational reporting available
- notifications configurable and reliable

### Exit Criteria
- key dashboards performant and accurate

---

## Phase 9 - AI Assistant Features
### Objective
Introduce AI-assisted workflows after source workflows and permissions are stable.

### Goals
- AI-drafted announcements
- AI payment reminders
- AI training plan generation
- AI team recap summaries
- AI player summaries from evaluation data

### Backend Work
- AI provider abstraction
- safe data projection layer for prompts
- AI draft endpoints
- audit hooks for AI use if needed
- feature flags and per-club AI settings

### Frontend Work
- AI assistant admin page
- AI assistant coach page
- AI draft editor components
- publish/review workflow integration

### QA / Validation Work
- AI safety tests
- prompt/output regression harness with seed data
- role/visibility boundary tests

### Deliverables
- club admins and coaches can generate editable drafts with AI assistance

### Exit Criteria
- AI outputs do not expose hidden data
- AI-generated content requires review before publishing by default

---

## Phase 10 - Mobile Optimization and Pilot Hardening
### Objective
Prepare the app for real-world club pilot usage and strong mobile experience.

### Goals
- refine responsive behavior for parents/coaches
- optimize coach attendance and parent schedule/payment flows on mobile
- harden performance, bug fixes, observability, and support readiness

### Backend Work
- optimize critical mobile summary endpoints where necessary
- performance tuning for heavy list and dashboard endpoints
- improve log/trace visibility

### Frontend Work
- responsive polish across parent/coach critical flows
- mobile nav refinement
- full-screen drawer/modal behavior on mobile
- chart fallback for small screens

### QA / Validation Work
- manual mobile exploratory passes
- cross-browser runs
- pilot readiness regression suite

### Deliverables
- production-pilot-ready web experience with mobile-friendly behavior

### Exit Criteria
- critical user journeys validated on desktop and mobile
- no critical defects blocking pilot

---

## 6. Detailed Workstream Breakdown

## 6.1 Backend Workstreams
1. auth and RBAC
2. clubs/teams/seasons
3. players/parents/roster
4. communication and realtime
5. scheduling/attendance
6. registration/billing/waivers
7. evaluations/development
8. reporting/notifications
9. AI services
10. performance hardening

## 6.2 Frontend Workstreams
1. design system and shared shell
2. auth pages and protected navigation
3. admin CRUD pages
4. coach operational pages
5. parent dashboard and child-specific pages
6. billing/registration/waiver flows
7. evaluation/radar/development pages
8. reporting and AI pages
9. responsive/mobile polish

## 6.3 QA Workstreams
1. unit/integration coverage expansion alongside each phase
2. E2E coverage for major journeys
3. security/RBAC regression pack
4. staging validation and release sign-off

---

## 7. Recommended Sprint / Iteration Structure
If delivering in 2-week sprints, a practical sequence could look like this:

### Sprint 1
- Phase 0 bootstrap
- start Phase 1 auth foundation

### Sprint 2
- complete Phase 1
- begin Phase 2 clubs/teams

### Sprint 3
- complete Phase 2
- begin Phase 3 roster/parents

### Sprint 4
- complete Phase 3
- begin Phase 4 communications

### Sprint 5
- complete Phase 4
- begin Phase 5 schedule/RSVP/attendance

### Sprint 6
- complete Phase 5
- begin Phase 6 registration/billing/waivers

### Sprint 7
- continue/complete Phase 6

### Sprint 8
- begin Phase 7 evaluations/radar/development

### Sprint 9
- complete Phase 7
- begin Phase 8 reporting/notifications

### Sprint 10
- begin Phase 9 AI assistant
- pilot hardening starts

### Sprint 11+
- Phase 10 mobile optimization, bug fixing, pilot feedback incorporation

This can be compressed or expanded depending on team capacity.

---

## 8. Critical Dependency Map

## 8.1 Dependencies by Capability
- **Roster** depends on auth, roles, clubs, teams
- **Parent multi-child access** depends on players + parents + link model + auth scope
- **Chat** depends on auth, team membership, realtime gateway, notifications
- **Attendance** depends on events and roster
- **Billing** depends on parent/player/family relationships
- **Waivers** depend on players and parent linked-child flows
- **Evaluations** depend on roster, positions, templates, cycles
- **Radar comparison** depends on evaluations and chart components
- **AI summaries** depend on underlying modules being stable and safely scoped

## 8.2 Highest-Risk Dependencies
1. scope enforcement (tenant/team/child)
2. payment integration correctness
3. parent-safe data projection
4. weighted scoring correctness
5. realtime chat plus notification side effects

---

## 9. Recommended Milestones

## Milestone 1 - Secure Foundation
Includes:
- auth
- roles
- clubs/teams/seasons
- protected shell

### Demo Outcome
- admin can create clubs and teams
- users can log in with role-based navigation

---

## Milestone 2 - Operational Team Management
Includes:
- players
- parents
- roster
- parent child switcher
- announcements/chat
- documents

### Demo Outcome
- coach and parent can manage/view roster and communicate

---

## Milestone 3 - Daily Operations
Includes:
- schedule
- RSVP
- attendance

### Demo Outcome
- coaches and parents can coordinate events and attendance

---

## Milestone 4 - Club Admin Monetization & Compliance
Includes:
- registration
- billing
- payments
- waivers

### Demo Outcome
- parent can register, pay, and sign waivers
- club admin can manage finance/compliance workflows

---

## Milestone 5 - Player Development Differentiator
Includes:
- evaluations
- position weights
- leaderboard
- radar comparison
- development goals

### Demo Outcome
- coach can evaluate and compare players visually
- parent can see own-child summary if enabled

---

## Milestone 6 - Pilot Ready
Includes:
- reports
- notifications hardening
- AI draft features
- responsive/mobile polish
- test and performance hardening

### Demo Outcome
- product is usable in a real club pilot setting

---

## 10. Definition of Done by Work Type

## 10.1 Backend Story Done
A backend feature is done when:
- schema/migration complete if needed
- endpoint/service implemented
- auth + RBAC enforced
- unit tests added
- integration tests added
- API contract updated if needed
- audit logging included where applicable

## 10.2 Frontend Story Done
A frontend feature is done when:
- page/component implemented
- loading/empty/error states handled
- role-specific visibility applied
- responsive/mobile behavior addressed
- component/unit tests added where appropriate
- connected to real or mocked API shape

## 10.3 Full Feature Done
A feature is done when:
- backend + frontend integrated
- happy path works end-to-end
- negative permission cases tested
- UX text/actions aligned with spec
- QA acceptance completed

---

## 11. Risks and Mitigation Plan

## 11.1 Risk: RBAC / Privacy Bugs
### Examples
- parent sees restricted child data
- coach accesses wrong team
- cross-club data leakage

### Mitigation
- enforce scope checks in service layer
- build parent-safe serializers early
- create automated RBAC regression pack

---

## 11.2 Risk: Payment / Waiver Workflow Errors
### Examples
- wrong invoice balance
- duplicate payments due to webhook replay
- waiver acceptance status incorrect

### Mitigation
- idempotency keys
- provider webhook verification
- integration tests for finance flows
- explicit reconciliation logic

---

## 11.3 Risk: Evaluation Calculation Disputes
### Examples
- weight totals incorrect
- ranking/buckets confusing
- position profile misapplied

### Mitigation
- unit-test scoring engine heavily
- expose weight/criteria clearly in UI
- seed known expected-score examples for validation

---

## 11.4 Risk: Chat / Notification Complexity
### Examples
- duplicate notifications
- message visibility inconsistencies
- real-time issues on reconnect

### Mitigation
- keep initial chat model simple
- treat notifications as asynchronous events with clear categories
- add replay-safe socket behaviors later as needed

---

## 11.5 Risk: Overbuilding Too Early
### Mitigation
- modular monolith first
- defer non-core advanced analytics and advanced mobile/offline work
- keep feature flags available for AI and optional parent visibility features

---

## 12. Testing Alignment by Phase

### Foundation Phases (0–2)
- auth
- tenant isolation
- navigation
- role tests

### Operational Phases (3–6)
- roster safety
- parent child scope
- event/attendance workflows
- registration/payment/waiver workflows

### Differentiation Phases (7–9)
- scoring logic
- radar comparison correctness
- AI safety tests

### Hardening Phase (10)
- full regression
- mobile validation
- performance and reliability testing

---

## 13. Suggested Release Strategy

## 13.1 Internal Demo Releases
Release after:
- Milestone 1
- Milestone 2
- Milestone 4
- Milestone 5

## 13.2 Pilot Release Candidate
Pilot RC should require:
- stable auth/RBAC
- stable roster and parent workflows
- stable schedule/RSVP/attendance
- stable registration/payment/waiver flows
- no critical privacy/security defects

## 13.3 Feature Flags
Recommended feature-flagged modules:
- AI assistant
- parent view of development summaries
- parent-to-parent chat
- advanced reports/export

---

## 14. Suggested Documentation Produced Along the Way
As implementation progresses, generate:
- environment setup guide
- migration/seeding guide
- API/OpenAPI artifact if desired
- admin user guide (later)
- club admin onboarding guide (later)
- pilot support runbook

---

## 15. Final Recommendation
Implement the Soccer Club Management App in **phased vertical slices** that deliver real business value early while protecting privacy and operational correctness.

### Highest Priority Early Wins
1. auth + RBAC
2. teams + roster + parent linking
3. schedule + attendance + communication
4. registration + payments + waivers

### Highest Value Differentiator
5. evaluations + position weights + radar comparison + development tracking

### Best Timing for AI
6. after operational workflows are stable and safely scoped

This implementation plan is detailed enough for Claude Code to sequence project scaffolding, module development, testing, and staged releases in a practical and low-risk way.
