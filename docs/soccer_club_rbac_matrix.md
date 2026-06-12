# Soccer Club Management App - RBAC Matrix Specification

## 1. Document Purpose
This document defines the Role-Based Access Control (RBAC) matrix for the Soccer Club Management App. It is intended to remove ambiguity during implementation by clearly specifying:
- role permissions by module
- allowed actions by page and API domain
- field-level visibility rules
- scope restrictions by club, team, and linked player profile
- special rules for sensitive data and AI-generated workflows

This document should be used together with the product requirements, technical architecture, database schema, API contract, and UI/UX page specification.

---

## 2. Roles in Scope
The RBAC model currently includes four primary roles:

1. **Master Admin**
2. **Club Manager**
3. **Coach**
4. **Player**

### Future-Ready Note
The architecture supports eventual multi-role users (for example, one user acting as both Coach and Player), but MVP enforcement should assume one active role context at a time.

---

## 3. Permission Vocabulary
Use these permission terms consistently:

- **No Access** = user cannot access module/page/resource
- **View** = user can read resource data
- **View Limited** = user can only see a restricted/safe projection of the resource
- **Create** = user can create a resource
- **Edit** = user can update a resource
- **Delete** = user can hard-delete resource (generally discouraged)
- **Archive** = user can soft-delete / disable / archive resource
- **Manage** = user can perform full administrative actions including assignment/configuration
- **Override** = user can bypass standard workflow restrictions where policy allows
- **Publish** = user can make draft content live/visible
- **Approve / Review** = user can review and move workflow state forward

---

## 4. Scope Rules
Permissions are not determined only by role. Permissions also depend on scope.

### 4.1 Scope Types
- **System Scope**: all tenants / clubs
- **Club Scope**: all resources inside one club
- **Team Scope**: only assigned team(s)
- **Profile Scope**: only linked player profile(s)

### 4.2 Scope Enforcement Rules
- **Master Admin** = system scope
- **Club Manager** = one club scope only
- **Coach** = assigned team scope only
- **Player** = linked profile scope, plus safe view of related team roster and team content

### 4.3 Player Safety Rule
Player access must never expose restricted data for other players' profiles.
A player account can only fully access:
- own linked player profile
- own invoices / waivers / registrations
- own profile development summary if club enables it

---

## 5. Global Permission Summary

## 5.1 High-Level Matrix

### Master Admin
- Full system-wide access
- Can create/manage clubs
- Can manage club managers
- Can access all modules and audit logs
- Can impersonate club managers with audit logging

### Club Manager
- Full access within own club
- Can manage teams, players, player accounts, coaches, schedules, registrations, billing, waivers, evaluations, reports, and club settings
- Cannot access other clubs

### Coach
- Full operational access for assigned teams only
- Can manage team roster, schedule, attendance, messaging, evaluations, development goals, and team documents
- Cannot manage club-wide billing, settings, or unrelated teams

### Player
- Can access all linked player profiles with one login
- Can view safe roster details for team members
- Can edit only own profile’s approved fields
- Can RSVP, pay invoices, sign waivers, complete registrations, and view profile development if enabled
- Cannot access restricted data for other players

---

## 6. Module-Level RBAC Matrix

## 6.1 Authentication / Identity

### Login / Logout / Profile
- Master Admin: View/Edit own profile
- Club Manager: View/Edit own profile
- Coach: View/Edit own profile
- Player: View/Edit own profile

### Role Switching (future-ready)
- Master Admin: Allowed
- Club Manager: Allowed if multiple assignments exist
- Coach: Allowed if multiple assignments exist
- Player: Allowed only if multiple role assignments exist in future

---

## 6.2 Clubs Module

### Clubs List
- Master Admin: View all / Create / Edit / Archive / Suspend
- Club Manager: No access to clubs list outside own club manager dashboard context
- Coach: No access
- Player: No access

### Club Detail
- Master Admin: Full view / Edit / Manage
- Club Manager: View/Edit own club only
- Coach: View limited own club summary only if surfaced in team context
- Player: View limited club info only if surfaced (for example club name/logo/contact)

### Club Settings
- Master Admin: Manage all clubs
- Club Manager: Manage own club only
- Coach: No access
- Player: No access

---

## 6.3 Seasons Module

### Seasons List / Detail
- Master Admin: View all
- Club Manager: Create / View / Edit / Archive within own club
- Coach: View seasons relevant to assigned team(s)
- Player: View season label only when attached to team/program context

---

## 6.4 Teams Module

### Teams List
- Master Admin: View all teams
- Club Manager: Create / View / Edit / Archive own club teams
- Coach: View assigned teams only
- Player: View teams of linked children only

### Team Detail
- Master Admin: Full view
- Club Manager: Full view within club
- Coach: Full operational view for assigned team(s)
- Player: View limited team detail for linked child’s team(s)

### Create Team
- Master Admin: Yes
- Club Manager: Yes (own club)
- Coach: No
- Player: No

### Edit Team Metadata
- Master Admin: Yes
- Club Manager: Yes (own club)
- Coach: No by default (optional limited edit if club allows specific fields)
- Player: No

### Archive Team
- Master Admin: Yes
- Club Manager: Yes (own club)
- Coach: No
- Player: No

---

## 6.5 Team Coach Assignment Module

### View Assigned Coaches
- Master Admin: Yes
- Club Manager: Yes
- Coach: View assigned coaches for own team(s)
- Player: View coach display info for linked child’s team if allowed

### Assign / Remove Coach
- Master Admin: Yes
- Club Manager: Yes (own club)
- Coach: No
- Player: No

---

## 6.6 Players Module

### Player List (Club-Wide)
- Master Admin: View all
- Club Manager: View all own club
- Coach: No club-wide page access unless filtered to assigned teams
- Player: No club-wide page access

### Team Roster List
- Master Admin: View all
- Club Manager: View full within club
- Coach: View full for assigned teams
- Player: View limited/safe roster for linked child team(s)

### Create Player
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams
- Player: No

### Edit Player (Full)
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for players on assigned teams
- Player: No full edit

### Edit Player (Limited Own Child Fields)
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes
- Player: Yes, but only for linked child and only approved fields

### Archive Player
- Master Admin: Yes
- Club Manager: Yes
- Coach: Optional if club allows, otherwise No
- Player: No

### View Player Detail
- Master Admin: Full
- Club Manager: Full
- Coach: Full for assigned-team players
- Player: Full approved view for linked child only; limited view or blocked for other children

---

## 6.7 Player Account Module

### Player Account List
- Master Admin: View all
- Club Manager: View own club player accounts
- Coach: View contact summary for player accounts of assigned team(s) if club policy allows
- Player: No general player-account list access

### Create / Invite Player Account (always profile-linked)
Player-account invitations are **always created from a specific player's context** (the
player's *Guardians* section), never as a standalone account record. The invite
carries which profile to link; on acceptance the player account is provisioned and
the `player_account_link` is created together. There is intentionally **no
standalone "invite" action** on the Club Admin Player Accounts page (that page
is view + link only).
- Master Admin: Yes (any player, within scope)
- Club Manager: Yes (any player in own club, from the player's detail page)
- Coach: Yes for a player on an assigned team, when the club's
  `allow_coach_invite_players` setting is on; otherwise No
- Player: No

> **Access pattern.** This repo has no committed OpenAPI/REST contract for these
> flows. Coach and player-account invites (and invite acceptance) are implemented as
> **Next.js server actions** (`inviteCoach` / `inviteGuardianAction` →
> `invitePlayerForProfile`; `acceptInviteAction` → `acceptInvitation`), not public
> `/api/v1/...` REST endpoints. A REST surface is **TBD** and would only be added
> when a non-web client (e.g. mobile) needs one.

### Edit Player Account Profile
- Master Admin: Yes
- Club Manager: Yes
- Coach: No, except possibly limited contact note field if club permits
- Player: Edit own account profile only

### Link / Unlink Player Account to Player
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned-team players if club policy allows
- Player: No direct linking actions

---

## 6.8 Roster Safe Visibility Matrix

### For Other Players in Team Roster
#### Fields a Player Account Can View
- display name
- preferred name
- jersey number
- primary position
- optional photo (if club setting enabled)
- team name / age group in context

#### Fields a Player Account Cannot View for Other Players
- date of birth
- medical notes
- emergency contacts
- address
- school information
- internal coach notes
- evaluation scores
- bucket labels / rankings unless club explicitly enables a limited view (not recommended)
- invoices, waivers, registration details
- player-account contact info for other families unless club explicitly shares it

### For Own Linked Profile
A player account can view and potentially edit approved fields based on club policy.

---

## 6.9 Files / Documents Module

### Upload Files
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams/resources
- Player: Yes only in approved contexts (registration uploads, child photo, waiver related docs, team chat attachments if allowed)

### View Files
- Master Admin: All
- Club Manager: Own club files
- Coach: Team-scoped files and permitted player/team docs
- Player: Only files tied to linked child or shared team/club documents

### Delete / Archive Files
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for coach-uploaded team documents if within scope and policy allows
- Player: No by default, except remove own draft upload before submit in limited workflows

---

## 6.10 Announcements Module

### View Announcements
- Master Admin: All
- Club Manager: Own club
- Coach: Assigned teams + club announcements visible to coaches
- Player: Linked profile team announcements + club announcements relevant to players

### Create Announcement
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned team announcements only
- Player: No

### Edit Draft Announcement
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for own team drafts
- Player: No

### Publish Announcement
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned team announcements only
- Player: No

### Delete / Archive Announcement
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for own team announcement drafts/posted announcements if policy allows
- Player: No

---

## 6.11 Chat / Messaging Module

### View Team Chat
- Master Admin: Yes if support/audit policy permits
- Club Manager: Yes for club teams if policy permits moderation visibility
- Coach: Yes for assigned teams
- Player: Yes for linked child teams

### Send Team Message
- Master Admin: Not typical but allowed in support/admin context if needed
- Club Manager: Yes for club/team channels where permitted
- Coach: Yes for assigned teams
- Player: Yes for linked child team chat if chat is enabled

### Player-to-Player Messaging
- Master Admin: N/A admin visibility only
- Club Manager: Configure allowed/disabled
- Coach: N/A for controlling, may participate in shared channel
- Player: Allowed only if club setting enables it

### Delete / Moderate Message
- Master Admin: Yes
- Club Manager: Yes for moderation
- Coach: Limited moderation for assigned team chat if policy allows
- Player: No, except delete/edit own message within short grace window if product supports it

### View Direct Messages
- Master Admin: Only if policy/support review permits
- Club Manager: Optional moderation visibility by policy
- Coach: Yes where part of conversation
- Player: Yes where part of conversation

---

## 6.12 Events / Schedule Module

### View Team Events
- Master Admin: Yes
- Club Manager: Yes within club
- Coach: Yes for assigned teams
- Player: Yes for linked child teams

### Create Event
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams
- Player: No

### Edit Event
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams
- Player: No

### Cancel Event
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams
- Player: No

### View Club-Wide Events
- Master Admin: Yes
- Club Manager: Yes
- Coach: View relevant club events if exposed
- Player: View relevant club events if exposed

---

## 6.13 RSVP Module

### Submit RSVP
- Master Admin: Override only if needed
- Club Manager: Override yes
- Coach: Optional override yes if club allows
- Player: Yes for linked child only

### View RSVP Summary
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams/events
- Player: View own child RSVP and possibly aggregate counts if shown, but not necessarily all individual child responses unless allowed in UI

### Edit RSVP After Submission
- Master Admin: Yes
- Club Manager: Yes
- Coach: Override yes if policy allows
- Player: Yes for linked child until event lock/deadline rules apply

---

## 6.14 Attendance Module

### Record Attendance
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams
- Player: No

### View Attendance Summary
- Master Admin: All
- Club Manager: Own club
- Coach: Assigned teams and assigned players
- Player: Own child only

### Export Attendance
- Master Admin: Yes
- Club Manager: Yes
- Coach: Optional for assigned team if policy allows
- Player: No

---

## 6.15 Registration Module

### View Registration Programs
- Master Admin: Yes
- Club Manager: Yes
- Coach: View published programs if needed, generally read-only
- Player: Yes for club or linked child relevant programs

### Create / Edit Registration Program
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### Create / Edit Registration Form Schema
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### Submit Registration
- Master Admin: Yes for admin support use case
- Club Manager: Yes for support/manual entry
- Coach: No by default
- Player: Yes for linked child only

### Review / Approve / Reject Registration
- Master Admin: Yes
- Club Manager: Yes
- Coach: View-only completeness status optional for assigned team if club allows, but no approve/reject by default
- Player: No

### View Registration Submission Detail
- Master Admin: Full
- Club Manager: Full within club
- Coach: Limited view only if allowed and only for assigned team players; no financial/private legal details unless explicitly allowed
- Player: Full for own linked child submissions

---

## 6.16 Billing / Payments Module

### View Invoice List
- Master Admin: All
- Club Manager: Own club
- Coach: No by default
- Player: Own family / linked child invoices only

### Create Invoice
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### Edit Invoice / Void Invoice
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### Record Offline Payment
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### Initiate Online Payment
- Master Admin: Support/admin action yes if needed
- Club Manager: Optional support action yes
- Coach: No
- Player: Yes for own invoice only

### View Payment History
- Master Admin: All
- Club Manager: Own club
- Coach: No
- Player: Own family only

### Refund Payment
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### View Billing Summary Reports
- Master Admin: Yes
- Club Manager: Yes
- Coach: No by default
- Player: No aggregated reports; only own invoice summary pages

---

## 6.17 Waivers Module

### View Waiver List
- Master Admin: All
- Club Manager: Own club
- Coach: No by default, but may view compliance summary for assigned team if club allows
- Player: Own linked child required waivers only

### Create / Edit Waiver
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### Add Waiver Version
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### Accept Waiver
- Master Admin: Support/admin action yes if acting on behalf under policy
- Club Manager: Support/manual action yes if policy permits
- Coach: No
- Player: Yes for linked child only

### View Waiver Compliance Summary
- Master Admin: All
- Club Manager: Own club
- Coach: Limited team-level compliance yes if club allows (for operational readiness only)
- Player: Own linked child only

---

## 6.18 Evaluations Module

### View Evaluation Templates
- Master Admin: All
- Club Manager: Own club
- Coach: View active template(s) for assigned team use
- Player: No

### Create / Edit Evaluation Template
- Master Admin: Yes
- Club Manager: Yes
- Coach: No by default
- Player: No

### View / Edit Evaluation Criteria
- Master Admin: Yes
- Club Manager: Yes
- Coach: View only
- Player: No

### View / Edit Position Weight Profiles
- Master Admin: Yes
- Club Manager: Yes
- Coach: View only by default; optional propose changes if business wants later
- Player: No

### Create Evaluation Cycle
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams if club allows
- Player: No

### Create Player Evaluation
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for players on assigned teams
- Player: No

### Edit Player Evaluation
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for evaluations within assigned scope
- Player: No

### View Player Evaluation
- Master Admin: Full
- Club Manager: Full within club
- Coach: Full for assigned-team players
- Player: Own child player-visible evaluation summary only if club setting allows

### View Team Ranking / Buckets
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams
- Player: No by default

### View Radar Comparison
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams
- Player: No by default

### Share Evaluation with Player
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes if club setting allows
- Player: N/A recipient only

---

## 6.19 Development Tracking Module

### View Development Goals
- Master Admin: All
- Club Manager: Own club
- Coach: Assigned team players
- Player: Own child player-visible goals only

### Create Development Goal
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned team players
- Player: No

### Edit Goal / Add Updates
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned team players
- Player: No, unless future player reflection/comment feature is intentionally added

### Mark Goal Complete
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes
- Player: No

### View Coach-Only Notes
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes
- Player: No

### View Player-Visible Notes
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes
- Player: Yes for linked child only if club enables development view

---

## 6.20 Notifications Module

### View Own Notifications
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes
- Player: Yes

### Update Notification Preferences
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes
- Player: Yes

### Send Notifications (manual trigger)
- Master Admin: Yes
- Club Manager: Yes
- Coach: Limited for assigned team announcements/reminders where supported
- Player: No

---

## 6.21 Reports Module

### View Attendance Reports
- Master Admin: All
- Club Manager: Own club
- Coach: Assigned team reports
- Player: No aggregate report, own child attendance summary only

### View Registration Reports
- Master Admin: All
- Club Manager: Own club
- Coach: Limited completeness view only if allowed
- Player: No aggregate reports

### View Billing Reports
- Master Admin: All
- Club Manager: Own club
- Coach: No
- Player: No aggregate reports

### View Evaluation Reports
- Master Admin: All
- Club Manager: Own club
- Coach: Assigned team reports
- Player: No aggregate reports

### Export Reports
- Master Admin: Yes
- Club Manager: Yes
- Coach: Limited export for team attendance/evaluation if policy allows
- Player: No

---

## 6.22 AI Assistant Module

### Access AI Assistant Surface
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes
- Player: Optional limited read/use cases if enabled later

### Draft Announcement with AI
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned teams
- Player: No

### Draft Payment Reminder with AI
- Master Admin: Yes
- Club Manager: Yes
- Coach: No
- Player: No

### Draft Training Plan with AI
- Master Admin: Optional
- Club Manager: Optional
- Coach: Yes
- Player: No

### Generate Player Development Summary with AI
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned players
- Player: No direct generation, only read shared summary if enabled

### Publish AI-Generated Content
- Master Admin: Yes
- Club Manager: Yes
- Coach: Yes for assigned team content where applicable
- Player: No

### AI Guardrails
Regardless of role:
- AI must not expose hidden fields
- AI drafts require review before publish by default
- AI cannot autonomously send communication unless explicit admin setting allows in a future phase

---

## 6.23 Audit Logs Module

### View Audit Logs
- Master Admin: Full system-wide
- Club Manager: Own club logs only
- Coach: No by default
- Player: No

### Export Audit Logs
- Master Admin: Yes
- Club Manager: Optional own club export if policy allows
- Coach: No
- Player: No

---

## 7. Field-Level Visibility Matrix

## 7.1 Player Fields

### Fields Visible to Master Admin / Club Manager / Coach
- first_name
- last_name
- preferred_name
- date_of_birth
- jersey_number
- primary_position
- secondary_position
- status
- photo_url
- medical_notes
- allergy_notes
- emergency_contact_name
- emergency_contact_phone
- team memberships
- evaluation data within allowed scope
- development notes within allowed scope

### Fields Visible to a Player Account for Own Profile
- first_name
- last_name
- preferred_name
- date_of_birth (optional based on UI)
- jersey_number
- primary_position
- secondary_position
- status
- photo_url
- approved medical/emergency fields
- linked teams
- own child schedule
- own child attendance summary
- own profile registrations, waivers, invoices
- own profile player-visible evaluations/development if enabled

### Fields Visible to a Player Account for Other Players
- display name
- preferred name
- jersey number
- primary position
- optional photo if enabled

### Fields Hidden from a Player Account for Other Players
- DOB
- address
- medical notes
- emergency contacts
- evaluation scores
- rankings
- coach-only notes
- player-account contact info
- invoice / waiver / registration records

---

## 7.2 Player Account Fields

### Visible to Club Manager
- full player-account business profile
- linked player profiles
- contact details

### Visible to Coach
- player-account display name
- contact methods for assigned team players, if club policy allows
- pickup/payment permission summaries if operationally needed and permitted

### Visible to Other Player Accounts
- none by default
- optional limited contact sharing only if club setting intentionally enables directory-style sharing

---

## 7.3 Evaluation Fields

### Visible to Master Admin / Club Manager
- full template config
- criteria
- weight profiles
- all player scores
- rankings
- coach notes
- player-visible notes

### Visible to Coach
- full evaluation data for assigned players

### Visible to Player
- only own profile
- only player-visible notes/summary
- optionally criterion scores if club allows
- no teamwide ranking by default

---

## 7.4 Billing Fields

### Visible to Master Admin / Club Manager
- full invoice and payment details

### Visible to Coach
- none by default
- optional registration completeness or compliance summary only, not amounts/payment methods

### Visible to Player
- own family invoices, balances, payment history, waiver status, registration status

---

## 8. Page-Level RBAC Summary

## 8.1 Master Admin Pages
- Dashboard: Master Admin only
- Clubs: Master Admin only
- Users: Master Admin only
- Audit Logs: Master Admin only
- System Settings: Master Admin only

## 8.2 Club Manager Pages
- Dashboard: Club Manager, Master Admin
- Teams: Club Manager, Master Admin
- Players: Club Manager, Master Admin
- Player Accounts: Club Manager, Master Admin
- Coaches: Club Manager, Master Admin
- Schedule: Club Manager, Master Admin
- Attendance: Club Manager, Master Admin
- Registration: Club Manager, Master Admin
- Payments: Club Manager, Master Admin
- Waivers: Club Manager, Master Admin
- Announcements: Club Manager, Master Admin
- Evaluations: Club Manager, Master Admin
- Reports: Club Manager, Master Admin
- AI Assistant: Club Manager, Master Admin
- Settings: Club Manager, Master Admin

## 8.3 Coach Pages
- Dashboard: Coach, Club Manager, Master Admin (different views)
- Team Roster: Coach assigned team only
- Schedule: Coach assigned team only
- Attendance: Coach assigned team only
- Chat: Coach assigned team only
- Announcements: Coach assigned team only
- Evaluations: Coach assigned team only
- Radar Comparison: Coach assigned team only
- Development Tracking: Coach assigned team only
- Documents: Coach assigned team only
- AI Assistant: Coach assigned team only

## 8.4 Player Pages
- My Players Dashboard: Player only
- Profile: Player linked profile only
- Schedule: Player linked profile only
- Team Roster: Player safe roster view only
- Chat: Player linked profile teams only
- Announcements: Player linked profile teams/clubs only
- Registration: Player linked profile only
- Payments: Player own family only
- Waivers: Player linked profile only
- Development: Player linked profile only if enabled
- Documents: Player linked profile/team docs only

---

## 9. API Permission Mapping Guidance
Use this section as implementation guidance for service/controller authorization.

### Example Rules
- `GET /teams/{teamId}/players`
  - Coach: allowed if assigned to team
  - Player: allowed if linked child is on team, but safe projection only

- `PUT /players/{playerId}`
  - Player: allowed only if player linked to the authenticated player account and only for whitelisted fields
  - Coach: allowed only if player belongs to assigned team

- `POST /events/{eventId}/attendance`
  - Coach: allowed only for assigned team event
  - Player: forbidden

- `POST /waivers/{waiverId}/accept`
  - Player: allowed only for linked child

- `POST /players/{playerId}/evaluations`
  - Coach: allowed only for assigned team player
  - Player: forbidden

- `GET /teams/{teamId}/radar-comparison`
  - Coach: allowed
  - Club Manager: allowed
  - Player: forbidden by default

---

## 10. Suggested Permission Constants
Recommended backend permission constants (illustrative):

```text
clubs.view
clubs.manage
teams.view
teams.manage
roster.view_full
roster.view_safe
players.create
players.edit_full
players.edit_limited_own_child
playerAccounts.manage
events.manage
rsvp.respond_own_child
attendance.record
attendance.view_team
attendance.view_own_child
registrations.manage
registrations.submit_own_child
billing.manage
billing.view_own_family
waivers.manage
waivers.accept_own_child
evaluations.manage_templates
evaluations.score_players
evaluations.view_team
evaluations.view_own_child_summary
development.manage
development.view_own_child
announcements.publish_club
announcements.publish_team
chat.send_team
reports.view_club
reports.view_team
ai.use_admin
ai.use_coach
audit.view
```

These can map to roles plus scope evaluation.

---

## 11. Recommended Enforcement Layers
1. **Route-level auth**: authenticated user required
2. **Role check**: verify broad role eligibility
3. **Scope check**: verify club/team/child linkage
4. **Field whitelist**: especially for player-account edits and player-safe reads
5. **Serializer projection**: enforce visible fields by role
6. **Audit logging**: record sensitive changes and overrides

---

## 12. Special Rules and Edge Cases

### 12.1 Coach Who Is Also a Player (Future)
If a single user has both roles:
- require active role context selection or infer context from navigation area
- never merge coach-level and player-level data accidentally
- player-safe restrictions still apply when operating in player context

### 12.2 Club Manager Viewing Chat
Club policy should decide whether club manager can view all chats for moderation/support. Default recommendation:
- yes for team chats and official communications
- direct message visibility only if policy/legal expectations allow

### 12.3 Player Visibility to Evaluation Data
Default recommendation:
- off for teamwide rankings
- on only for own profile summary if club explicitly enables

### 12.4 Coach Access to Billing
Default recommendation:
- no financial access
- optional compliance indicator only, such as:
  - registration complete yes/no
  - waiver complete yes/no
  - eligible for play yes/no
without showing amounts or payment methods

---

## 13. Test Cases for RBAC Validation
The implementation should include automated tests for these examples:

1. A player account cannot edit another player’s profile.
2. A player-account team roster response excludes restricted fields for other players.
3. Coach cannot access roster for unassigned team.
4. Club Manager cannot access another club’s data.
5. A player account cannot view another family’s invoice.
6. Coach can create evaluation only for assigned team player.
7. A player account cannot access radar comparison endpoint.
8. Club Manager can update position weight profiles within own club.
9. Coach cannot void invoice.
10. A player account can RSVP only for a linked profile.
11. A player account cannot see coach-only development notes.
12. AI draft generation cannot include hidden fields in output context.

---

## 14. Final Recommendation
Use this RBAC matrix as the authoritative permission guide for backend authorization, frontend visibility rules, serializer projections, and QA test coverage.

The most important implementation priorities are:
- tenant scope enforcement by `club_id`
- team scope enforcement for coaches
- linked-profile scope enforcement for player accounts
- strict field-level filtering for player-safe roster views
- separation of coach-only vs player-visible evaluation/development content
- no financial or sensitive child data leakage outside intended role/scope

This document should eliminate ambiguity for Claude Code when implementing guards, policies, DTO whitelists, and UI-level role behavior.
