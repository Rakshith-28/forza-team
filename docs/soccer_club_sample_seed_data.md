# Soccer Club Management App - Sample Seed Data Specification

## 1. Document Purpose
This document defines a **sample seed data strategy** for the Soccer Club Management App. It is intended to help Claude Code and engineering teams populate local, QA, staging, and automated test environments with **realistic, privacy-safe, role-aware synthetic data**.

This seed specification should be used together with:
- Product Requirements (Phase 1 + Phase 2)
- Technical Architecture
- Database Schema
- API Contract
- UI/UX Page Specification
- RBAC Matrix
- Frontend Component Specification
- Testing Strategy

The goal is to provide:
- realistic synthetic clubs, teams, users, players, parents, events, invoices, waivers, and evaluations
- consistent relationships between entities
- enough variety to validate RBAC, linked-child behavior, billing flows, and evaluation/radar features
- predictable fixtures for automated tests and manual QA

---

## 2. Seed Data Principles
1. **Use synthetic data only** — never use real children’s data or real payment credentials.
2. **Model realistic relationships** — parents with one child, multiple children on the same team, and multiple children across different teams.
3. **Preserve tenant separation** — at least two clubs with overlapping role types so cross-tenant leakage can be tested.
4. **Include all major statuses** — active, archived, overdue, pending, approved, paid, etc.
5. **Support Phase 2 workflows** — schedule, RSVP, attendance, registrations, billing, waivers, evaluations, radar comparisons, development goals, notifications, and AI testing contexts.
6. **Make data human-readable** — names, team codes, invoice numbers, and evaluation labels should be easy for QA and developers to understand.
7. **Be deterministic where needed** — fixture IDs and naming patterns should be stable enough for test scripts.

---

## 3. Recommended Seed Data Sets
Create at least **four seed data profiles**:

### 3.1 Minimal Seed Set
Used for local development and smoke tests.

Includes:
- 1 club
- 1 season
- 2 teams
- 1 club admin
- 1 coach per team
- 6–8 players total
- 3–4 parent accounts
- 1 parent with multiple children
- 4 events
- 2 announcements
- 1 registration program
- 2 invoices
- 1 waiver template
- 1 evaluation template
- 1 evaluation cycle

### 3.2 Standard QA Seed Set
Used for feature validation.

Includes:
- 2 clubs
- 2 seasons per club
- 4–6 teams total
- multiple coaches
- 20–30 players total
- 12–15 parent accounts
- mix of invoice/waiver/registration statuses
- full evaluation/radar data for at least one team

### 3.3 Complex Relationship Seed Set
Used for RBAC and parent-child scope testing.

Includes:
- parent with 3 children
- children spread across 2 teams
- one child with multiple guardians
- one coach assigned to 2 teams
- one club admin with many mixed-status entities

### 3.4 Performance / Volume Seed Set
Used for pagination, dashboard load, leaderboard testing.

Includes:
- 3 clubs
- 12–20 teams
- 150–300 players
- 200+ events
- 500+ messages
- 100+ invoices
- 100+ evaluations

---

## 4. Recommended Synthetic Tenants
Use at least two clubs in the standard QA seed set.

## 4.1 Club A - Charlotte United SC
### Suggested Values
- Club Name: `Charlotte United SC`
- Short Code: `CHARU`
- Timezone: `America/New_York`
- Status: `ACTIVE`

### Suggested Teams
- `U12 Blue`
- `U14 Blue`
- `U14 White`

---

## 4.2 Club B - Piedmont Strikers FC
### Suggested Values
- Club Name: `Piedmont Strikers FC`
- Short Code: `PSFC`
- Timezone: `America/New_York`
- Status: `ACTIVE`

### Suggested Teams
- `U13 Red`
- `U15 Red`

---

## 4.3 Optional Club C (Volume / Staging)
### Suggested Values
- Club Name: `Lakeview Soccer Academy`
- Short Code: `LSA`
- Status: `ACTIVE`

---

## 5. Suggested Users and Roles

## 5.1 Master Admin Seed Users
Create at least **one** master admin.

### Example
```yaml
email: masteradmin@platform.test
first_name: Master
last_name: Admin
role: MASTER_ADMIN
status: ACTIVE
```

Optional second master admin for audit/approval scenarios:
```yaml
email: opsadmin@platform.test
first_name: Ops
last_name: Admin
role: MASTER_ADMIN
status: ACTIVE
```

---

## 5.2 Club Admin Seed Users
Create at least **one club admin per club**.

### Charlotte United Club Admin
```yaml
email: clubadmin.charu@platform.test
first_name: Casey
last_name: Morgan
role: CLUB_ADMIN
club: Charlotte United SC
status: ACTIVE
```

### Piedmont Strikers Club Admin
```yaml
email: clubadmin.psfc@platform.test
first_name: Riley
last_name: Carter
role: CLUB_ADMIN
club: Piedmont Strikers FC
status: ACTIVE
```

---

## 5.3 Coach Seed Users
Create multiple coaches per club, with some assigned to multiple teams.

### Examples
```yaml
- email: coach.u14blue@platform.test
  first_name: Taylor
  last_name: Jordan
  role: COACH
  club: Charlotte United SC
  teams: [U14 Blue]

- email: coach.multiteam@platform.test
  first_name: Avery
  last_name: Brooks
  role: COACH
  club: Charlotte United SC
  teams: [U12 Blue, U14 White]

- email: coach.u15red@platform.test
  first_name: Cameron
  last_name: Ellis
  role: COACH
  club: Piedmont Strikers FC
  teams: [U15 Red]
```

### Suggested Coach Role Types
- `HEAD_COACH`
- `ASSISTANT_COACH`
- `TEAM_MANAGER`

---

## 5.4 Parent Seed Users
Create diverse parent relationships.

### Parent Types to Include
1. Parent with **one child on one team**
2. Parent with **two children on the same team**
3. Parent with **two children across different teams**
4. Child with **two linked guardians**
5. Parent with **open invoices** and **pending waivers**
6. Parent with **fully completed registration/payment state**

### Example Parent Users
```yaml
- email: parent.alex@platform.test
  first_name: Alex
  last_name: Miles
  role: PARENT
  club: Charlotte United SC

- email: parent.jamie@platform.test
  first_name: Jamie
  last_name: Rivera
  role: PARENT
  club: Charlotte United SC

- email: parent.chris@platform.test
  first_name: Chris
  last_name: Bennett
  role: PARENT
  club: Piedmont Strikers FC
```

---

## 6. Suggested Seasons
Create at least two seasons per club in QA seed data.

### Example Seasons
```yaml
- name: Fall 2026
  club: Charlotte United SC
  start_date: 2026-08-01
  end_date: 2026-12-15
  status: ACTIVE

- name: Spring 2027
  club: Charlotte United SC
  start_date: 2027-02-01
  end_date: 2027-06-15
  status: PLANNED

- name: Fall 2026
  club: Piedmont Strikers FC
  start_date: 2026-08-01
  end_date: 2026-12-15
  status: ACTIVE
```

---

## 7. Suggested Teams
Include age groups and mixed competition levels.

### Charlotte United Teams
```yaml
- name: U12 Blue
  team_code: U12B
  age_group: U12
  division: Classic
  competitive_level: Development
  season: Fall 2026

- name: U14 Blue
  team_code: U14B
  age_group: U14
  division: Premier
  competitive_level: Competitive
  season: Fall 2026

- name: U14 White
  team_code: U14W
  age_group: U14
  division: Challenge
  competitive_level: Competitive
  season: Fall 2026
```

### Piedmont Strikers Teams
```yaml
- name: U13 Red
  team_code: U13R
  age_group: U13
  division: Classic
  competitive_level: Development
  season: Fall 2026

- name: U15 Red
  team_code: U15R
  age_group: U15
  division: Premier
  competitive_level: Competitive
  season: Fall 2026
```

---

## 8. Suggested Players
Seed at least 5–8 players per team in minimal set and 12–18 per team in QA/staging.

### Player Data Pattern
For each player, include:
- full name
- preferred name (for some records)
- date of birth
- jersey number
- primary position
- secondary position
- status
- team membership
- linked parent(s)

### Position Coverage
Ensure coverage for:
- GK
- CB
- FB
- DM
- CM
- AM
- WINGER
- ST
- UTILITY

### Example Player Records (Charlotte U14 Blue)
```yaml
- first_name: Jordan
  last_name: Miles
  preferred_name: Jo
  dob: 2012-06-10
  jersey_number: 8
  primary_position: CM
  secondary_position: DM
  status: ACTIVE
  team: U14 Blue
  parents: [Alex Miles]

- first_name: Logan
  last_name: Rivera
  preferred_name: null
  dob: 2012-03-21
  jersey_number: 4
  primary_position: CB
  secondary_position: FB
  status: ACTIVE
  team: U14 Blue
  parents: [Jamie Rivera]

- first_name: Hayden
  last_name: Brooks
  preferred_name: Hay
  dob: 2012-01-13
  jersey_number: 1
  primary_position: GK
  secondary_position: null
  status: ACTIVE
  team: U14 Blue
  parents: [Pat Brooks, Morgan Brooks]
```

### Suggested Status Mix
Include at least one player in each relevant status where possible:
- ACTIVE
- INJURED
- INACTIVE
- ARCHIVED (optional historical only)

---

## 9. Parent-Child Relationship Fixtures
These are essential for scope testing.

## 9.1 Single Child Parent Fixture
```yaml
parent: Alex Miles
children:
  - Jordan Miles (U14 Blue)
```

## 9.2 Same Team Siblings Fixture
```yaml
parent: Jamie Rivera
children:
  - Logan Rivera (U12 Blue)
  - Mason Rivera (U12 Blue)
```

## 9.3 Multi-Team Parent Fixture
```yaml
parent: Chris Bennett
children:
  - Riley Bennett (U13 Red)
  - Avery Bennett (U15 Red)
```

## 9.4 Dual Guardian Fixture
```yaml
player: Hayden Brooks
guardians:
  - Pat Brooks (primary_guardian: true, can_pickup: true, can_pay: true)
  - Morgan Brooks (primary_guardian: false, can_pickup: true, can_pay: false)
```

---

## 10. Announcements Seed Data
Create announcements with mixed audiences and states.

### Suggested Records
```yaml
- title: Practice Cancelled Tonight
  audience_type: TEAM_ONLY
  team: U14 Blue
  status: PUBLISHED
  published_at: 2026-09-10T14:00:00Z

- title: Fall Registration Opens Next Week
  audience_type: CLUB_ALL
  club: Charlotte United SC
  status: PUBLISHED

- title: Draft Tournament Reminder
  audience_type: TEAM_ONLY
  team: U15 Red
  status: DRAFT
```

### Why
This supports list filtering, draft vs published behavior, and AI draft editing tests.

---

## 11. Chat Seed Data
Seed chat rooms and messages for realistic thread testing.

### Suggested Chat Types
- Team chat for each active team
- Announcement thread chat (optional)
- one direct message sample (if enabled in build)

### Suggested Message Volume
- Minimal set: 5–10 messages in 1–2 team chats
- QA set: 20–50 messages across multiple team chats
- Volume set: 500+ total messages

### Message Content Examples
- event reminders
- arrival instructions
- parent responses
- attachment-containing messages

### Sample Messages
```yaml
- chat: U14 Blue Team Chat
  sender: coach.u14blue@platform.test
  body: Please arrive 15 minutes early for practice.
  created_at: 2026-09-10T13:45:00Z

- chat: U14 Blue Team Chat
  sender: parent.alex@platform.test
  body: Jordan will be on time.
  created_at: 2026-09-10T13:52:00Z
```

---

## 12. Events / Schedule Seed Data
Seed a realistic schedule per team.

### Event Types to Include
- PRACTICE
- GAME
- TOURNAMENT
- MEETING
- TEAM_EVENT
- CLUB_EVENT

### Suggested Per-Team Event Mix
- 2 practices in next 14 days
- 1 upcoming game
- 1 completed past event
- 1 canceled or postponed event

### Example Event Records
```yaml
- title: Tuesday Practice
  event_type: PRACTICE
  team: U14 Blue
  start_at: 2026-09-12T22:00:00Z
  end_at: 2026-09-12T23:30:00Z
  location_name: Training Field 2
  status: SCHEDULED

- title: League Match vs Falcons
  event_type: GAME
  team: U14 Blue
  opponent_name: Falcons
  home_away: AWAY
  start_at: 2026-09-20T18:00:00Z
  end_at: 2026-09-20T20:00:00Z
  status: SCHEDULED

- title: Team Meeting
  event_type: MEETING
  team: U14 Blue
  start_at: 2026-09-05T22:00:00Z
  end_at: 2026-09-05T22:30:00Z
  status: COMPLETED
```

---

## 13. RSVP Seed Data
Seed RSVP responses per child, not per parent account globally.

### Suggested RSVP Mix Per Event
- 50% GOING
- 20% MAYBE
- 10% LATE
- 20% NOT_GOING

### Example RSVP Records
```yaml
- event: Tuesday Practice
  player: Jordan Miles
  responded_by: Alex Miles
  response_status: GOING
  comment: Will arrive on time

- event: Tuesday Practice
  player: Logan Rivera
  responded_by: Jamie Rivera
  response_status: LATE
  comment: 10 minutes late due to school pickup
```

### Why
Supports coach forecast views, parent updates, and status badge validation.

---

## 14. Attendance Seed Data
Seed attendance for completed/past events.

### Suggested Status Mix
- PRESENT
- LATE
- EXCUSED_ABSENT
- UNEXCUSED_ABSENT
- INJURED
- PARTIAL

### Example Attendance Records
```yaml
- event: Team Meeting
  player: Jordan Miles
  attendance_status: PRESENT
  notes: Arrived early

- event: Team Meeting
  player: Logan Rivera
  attendance_status: LATE
  notes: 8 minutes late

- event: Team Meeting
  player: Hayden Brooks
  attendance_status: INJURED
  notes: Light recovery only
```

---

## 15. Registration Seed Data
Create at least one active registration program per club.

## 15.1 Registration Programs
```yaml
- name: Fall 2026 Registration
  club: Charlotte United SC
  season: Fall 2026
  opens_at: 2026-06-01T00:00:00Z
  closes_at: 2026-07-31T23:59:59Z
  status: ACTIVE
```

## 15.2 Registration Form Schema Scenarios
Seed forms that include:
- text field
- select field
- checkbox
- date field
- file upload field
- waiver requirement marker
- payment plan selection

### Example Fields
```yaml
fields:
  - key: uniform_size
    type: select
    required: true
    options: [YS, YM, YL, AS, AM, AL]
  - key: allergies
    type: textarea
    required: false
  - key: media_consent
    type: checkbox
    required: true
```

## 15.3 Registration Submission Status Mix
Seed at least these statuses:
- DRAFT
- SUBMITTED
- APPROVED
- WAITLISTED
- REJECTED

### Example Submission Fixtures
```yaml
- player: Jordan Miles
  program: Fall 2026 Registration
  status: SUBMITTED

- player: Logan Rivera
  program: Fall 2026 Registration
  status: APPROVED

- player: Avery Bennett
  program: Fall 2026 Registration
  status: DRAFT
```

---

## 16. Billing / Payments Seed Data
This is critical for finance flows and parent dashboard reminders.

## 16.1 Family Accounts
Create family grouping where applicable.

### Example
```yaml
- account_name: Miles Family Account
  primary_parent: Alex Miles
  club: Charlotte United SC

- account_name: Rivera Family Account
  primary_parent: Jamie Rivera
  club: Charlotte United SC
```

## 16.2 Invoice Status Mix
Include invoices in these states:
- OPEN
- PARTIALLY_PAID
- PAID
- OVERDUE
- VOID
- REFUNDED

### Example Invoices
```yaml
- invoice_number: INV-1001
  family_account: Miles Family Account
  player: Jordan Miles
  total_amount: 450.00
  amount_paid: 150.00
  amount_due: 300.00
  due_date: 2026-09-15
  status: PARTIALLY_PAID

- invoice_number: INV-1002
  family_account: Rivera Family Account
  player: Logan Rivera
  total_amount: 300.00
  amount_paid: 0.00
  amount_due: 300.00
  due_date: 2026-08-15
  status: OVERDUE

- invoice_number: INV-1003
  family_account: Bennett Family Account
  player: Avery Bennett
  total_amount: 500.00
  amount_paid: 500.00
  amount_due: 0.00
  status: PAID
```

## 16.3 Invoice Line Item Categories
Seed line items for:
- registration fee
- season dues
- uniform fee
- tournament fee
- discount

## 16.4 Payment Records
Create records for:
- successful card payment
- partial payment
- offline payment (check/cash)
- failed payment attempt (optional non-primary)
- refund entry (optional)

### Example Payments
```yaml
- invoice: INV-1001
  provider: stripe
  amount: 150.00
  status: SUCCEEDED
  paid_at: 2026-09-01T14:00:00Z

- invoice: INV-1002
  provider: offline
  amount: 50.00
  status: SUCCEEDED
  paid_at: 2026-08-10T18:00:00Z
```

## 16.5 Payment Plans
Seed at least one invoice with 3-installment plan.

---

## 17. Waiver Seed Data
Create waiver templates and versioned acceptance states.

## 17.1 Waiver Types to Include
- LIABILITY
- MEDICAL
- MEDIA
- CODE_OF_CONDUCT

## 17.2 Example Waivers
```yaml
- name: Fall 2026 Liability Waiver
  type: LIABILITY
  status: ACTIVE

- name: Media Release 2026
  type: MEDIA
  status: ACTIVE
```

## 17.3 Waiver Version Fixtures
Include at least:
- one active version
- one superseded/historical version

## 17.4 Acceptance Status Mix
Seed players with:
- all waivers accepted
- one waiver pending
- one expired/old version accepted but current version pending

### Example Acceptance Fixtures
```yaml
- player: Jordan Miles
  waiver: Fall 2026 Liability Waiver v1
  accepted_by: Alex Miles
  accepted_at: 2026-06-05T14:30:00Z

- player: Logan Rivera
  waiver: Media Release 2026 v1
  accepted_by: Jamie Rivera
  accepted_at: null
  status: PENDING
```

---

## 18. Evaluation Seed Data
This is essential because your app includes spreadsheet-inspired ranking, weights, and radar comparison.

## 18.1 Evaluation Templates
Create at least one active template per club.

### Example
```yaml
- name: Standard Development Template
  club: Charlotte United SC
  status: ACTIVE
```

## 18.2 Default Evaluation Criteria
Seed at minimum:
- WORK_RATE
- PASSING
- DRIBBLING
- PHYSICALITY
- AGGRESSION
- PACE
- TACTICAL_AWARENESS

## 18.3 Position Weight Profiles
Seed default profiles for:
- GK
- CB
- FB
- DM
- CM
- AM
- WINGER
- ST
- UTILITY

### Example Weight Fixture for CB
```yaml
position: CB
weights:
  WORK_RATE: 15
  PASSING: 10
  DRIBBLING: 5
  PHYSICALITY: 25
  AGGRESSION: 15
  PACE: 10
  TACTICAL_AWARENESS: 20
total: 100
```

## 18.4 Evaluation Cycles
Create at least:
- TRYOUT
- PRESEASON
- MIDSEASON

### Example
```yaml
- name: Midseason Review
  cycle_type: MIDSEASON
  team: U14 Blue
  starts_at: 2026-10-01T00:00:00Z
  ends_at: 2026-10-15T23:59:59Z
```

## 18.5 Player Evaluation Fixtures
Seed at least 8–12 evaluations for one team so Top/Middle/Bottom buckets are meaningful.

### Suggested Distribution
- strong technical midfielder
- physical CB
- pace-heavy winger
- technically weaker but high work rate player
- balanced utility player
- low aggression / low physicality player to reflect your original use case

### Example Evaluation Records
```yaml
- player: Jordan Miles
  team: U14 Blue
  cycle: Midseason Review
  position: CM
  scores:
    WORK_RATE: 8
    PASSING: 9
    DRIBBLING: 7
    PHYSICALITY: 6
    AGGRESSION: 5
    PACE: 7
    TACTICAL_AWARENESS: 9
  overall_score: 7.55
  rank_in_scope: 3
  bucket_label: TOP_8

- player: Logan Rivera
  team: U14 Blue
  cycle: Midseason Review
  position: CB
  scores:
    WORK_RATE: 7
    PASSING: 6
    DRIBBLING: 4
    PHYSICALITY: 8
    AGGRESSION: 8
    PACE: 6
    TACTICAL_AWARENESS: 7
  overall_score: 7.10
  rank_in_scope: 5
  bucket_label: TOP_8

- player: Riley Chen
  team: U14 Blue
  cycle: Midseason Review
  position: WINGER
  scores:
    WORK_RATE: 6
    PASSING: 6
    DRIBBLING: 9
    PHYSICALITY: 4
    AGGRESSION: 3
    PACE: 9
    TACTICAL_AWARENESS: 6
  overall_score: 6.85
  rank_in_scope: 7
  bucket_label: MIDDLE_8
```

## 18.6 Radar Comparison Fixtures
Seed at least one comparison-friendly trio in same team:
- balanced CM
- physical CB
- pace/dribbling winger

This helps validate radar overlay and interpretation.

---

## 19. Development Goal Seed Data
Create both coach-only and parent-visible goals.

### Example Goals
```yaml
- player: Jordan Miles
  title: Improve weak foot passing
  category: TECHNICAL
  visibility: PARENT_VISIBLE
  status: IN_PROGRESS
  target_date: 2026-11-15

- player: Logan Rivera
  title: Improve body shape in build-out phase
  category: TACTICAL
  visibility: COACH_ONLY
  status: OPEN
```

### Goal Update Examples
```yaml
- goal: Improve weak foot passing
  progress_status: IN_PROGRESS
  notes: Showing quicker release in short passing drills.

- goal: Improve body shape in build-out phase
  progress_status: OPEN
  notes: Needs repetition under pressure scenarios.
```

---

## 20. Notification Seed Data
Seed read and unread notifications for multiple roles.

### Suggested Notification Types
- event reminder
- new announcement
- payment due
- registration incomplete
- waiver pending
- evaluation shared

### Example Notifications
```yaml
- user: parent.alex@platform.test
  type: PAYMENT_DUE
  title: Invoice Due Soon
  status: UNREAD

- user: coach.u14blue@platform.test
  type: RSVP_UPDATE
  title: New RSVP Received
  status: READ
```

---

## 21. AI Context Seed Data
Seed enough source data to validate AI draft behaviors.

### Recommended AI Seed Contexts
1. Published and draft announcements
2. Mixed attendance data for summaries
3. Evaluation data for player summaries
4. Overdue invoices for reminder drafting
5. Team events for recap and planning prompts

### Important
AI test fixtures must include both:
- allowed visible data
- hidden restricted data

This ensures tests can verify that AI outputs respect data visibility boundaries.

---

## 22. Suggested Synthetic IDs / Naming Conventions
For deterministic testing, consider stable fixture naming or identifiers.

### Recommended Patterns
```text
club_charu
club_psfc
team_charu_u14_blue
player_jordan_miles
parent_alex_miles
invoice_inv_1001
cycle_midseason_u14blue
```

### Why
This makes automated tests and seeded fixture references easier to read and maintain.

---

## 23. Seed Generation Guidance

## 23.1 Seeding Order
Seed data in this order:
1. roles
2. users
3. clubs
4. club settings
5. seasons
6. teams
7. role assignments / team coaches
8. players
9. parents
10. player-parent links
11. player-team memberships
12. announcements / chats / messages
13. events
14. RSVPs
15. attendance
16. registration programs / forms / submissions / answers
17. family accounts / invoices / invoice items / payments / plans
18. waivers / versions / acceptances
19. evaluation templates / criteria / position weights / cycles / evaluations / scores
20. development goals / updates
21. notifications

---

## 23.2 Deterministic vs Randomized Seed Strategy
### Deterministic fixtures
Use for:
- automated tests
- screenshot tests
- E2E scenarios
- contract tests

### Randomized bulk generators
Use for:
- performance testing
- pagination/load testing
- volume scenarios

---

## 24. Recommended Seed Packages by Purpose

## 24.1 `seed-minimal`
Use for:
- local setup
- smoke tests
- frontend development

## 24.2 `seed-qa-standard`
Use for:
- QA validation
- integration and E2E tests

## 24.3 `seed-rbac-edge`
Use for:
- scope and privacy testing
- multi-child/multi-team edge cases
- coach multi-team assignment tests

## 24.4 `seed-performance`
Use for:
- load testing
- dashboard performance
- chat/event list scaling tests

---

## 25. Example Test Personas Mapped to Seed Data

### Persona 1 - Club Admin
`clubadmin.charu@platform.test`
- sees all Charlotte United data
- manages teams, registrations, invoices, waivers, evaluations

### Persona 2 - Head Coach, Single Team
`coach.u14blue@platform.test`
- sees U14 Blue only
- manages roster, events, attendance, evaluations

### Persona 3 - Coach, Multi-Team
`coach.multiteam@platform.test`
- sees U12 Blue and U14 White
- validates multi-team scope handling

### Persona 4 - Parent, Single Child
`parent.alex@platform.test`
- linked to Jordan Miles only
- has one partially paid invoice and accepted waivers

### Persona 5 - Parent, Multiple Children Across Teams
`parent.chris@platform.test`
- linked to 2 children on different teams
- validates child switcher and combined dashboard behavior

### Persona 6 - Parent, Pending Compliance
`parent.jamie@platform.test`
- has overdue invoice and pending waiver
- validates reminder flows and dashboard alert cards

---

## 26. Final Recommendation
Build a **deterministic, human-readable seed dataset** first, then optionally add randomized bulk generators for performance scenarios.

The most important seed coverage areas are:
1. multiple clubs for tenant isolation testing
2. multiple role types and role scopes
3. parent-child relationships with edge cases
4. mixed registration/payment/waiver states
5. completed and upcoming events with RSVP and attendance variation
6. realistic evaluation and radar comparison data with position-based weights

This seed data specification is detailed enough for Claude Code to create seed scripts, fixture files, test personas, and local/staging demo environments that support product development, QA, and demos.
