# Soccer Club Management App - RBAC Matrix Specification

## 1. Document Purpose
This document defines the Role-Based Access Control (RBAC) matrix for the Soccer Club Management App. It is intended to remove ambiguity during implementation by clearly specifying:
- role permissions by module
- allowed actions by page and API domain
- field-level visibility rules
- scope restrictions by club, team, and linked child
- special rules for sensitive data and AI-generated workflows

This document should be used together with the product requirements, technical architecture, database schema, API contract, and UI/UX page specification.

---

## 2. Roles in Scope
The RBAC model currently includes four primary roles:

1. **Master Admin**
2. **Club Admin**
3. **Coach**
4. **Parent / Guardian**

### Future-Ready Note
The architecture supports eventual multi-role users (for example, one user acting as both Coach and Parent), but MVP enforcement should assume one active role context at a time.

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
- **Child Scope**: only linked child(ren)

### 4.2 Scope Enforcement Rules
- **Master Admin** = system scope
- **Club Admin** = one club scope only
- **Coach** = assigned team scope only
- **Parent** = linked child scope, plus safe view of related team roster and team content

### 4.3 Parent Safety Rule
Parent access must never expose restricted data for other children.
Parent can only fully access:
- own linked child profile
- own invoices / waivers / registrations
- own child development summary if club enables it

---

## 5. Global Permission Summary

## 5.1 High-Level Matrix

### Master Admin
- Full system-wide access
- Can create/manage clubs
- Can manage club admins
- Can access all modules and audit logs
- Can impersonate club admins with audit logging

### Club Admin
- Full access within own club
- Can manage teams, players, parents, coaches, schedules, registrations, billing, waivers, evaluations, reports, and club settings
- Cannot access other clubs

### Coach
- Full operational access for assigned teams only
- Can manage team roster, schedule, attendance, messaging, evaluations, development goals, and team documents
- Cannot manage club-wide billing, settings, or unrelated teams

### Parent
- Can access all linked children with one login
- Can view safe roster details for team members
- Can edit only own child’s approved fields
- Can RSVP, pay invoices, sign waivers, complete registrations, and view child development if enabled
- Cannot access restricted data for other players

---

## 6. Module-Level RBAC Matrix

## 6.1 Authentication / Identity

### Login / Logout / Profile
- Master Admin: View/Edit own profile
- Club Admin: View/Edit own profile
- Coach: View/Edit own profile
- Parent: View/Edit own profile

### Role Switching (future-ready)
- Master Admin: Allowed
- Club Admin: Allowed if multiple assignments exist
- Coach: Allowed if multiple assignments exist
- Parent: Allowed only if multiple role assignments exist in future

---

## 6.2 Clubs Module

### Clubs List
- Master Admin: View all / Create / Edit / Archive / Suspend
- Club Admin: No access to clubs list outside own club admin dashboard context
- Coach: No access
- Parent: No access

### Club Detail
- Master Admin: Full view / Edit / Manage
- Club Admin: View/Edit own club only
- Coach: View limited own club summary only if surfaced in team context
- Parent: View limited club info only if surfaced (for example club name/logo/contact)

### Club Settings
- Master Admin: Manage all clubs
- Club Admin: Manage own club only
- Coach: No access
- Parent: No access

---

## 6.3 Seasons Module

### Seasons List / Detail
- Master Admin: View all
- Club Admin: Create / View / Edit / Archive within own club
- Coach: View seasons relevant to assigned team(s)
- Parent: View season label only when attached to team/program context

---

## 6.4 Teams Module

### Teams List
- Master Admin: View all teams
- Club Admin: Create / View / Edit / Archive own club teams
- Coach: View assigned teams only
- Parent: View teams of linked children only

### Team Detail
- Master Admin: Full view
- Club Admin: Full view within club
- Coach: Full operational view for assigned team(s)
- Parent: View limited team detail for linked child’s team(s)

### Create Team
- Master Admin: Yes
- Club Admin: Yes (own club)
- Coach: No
- Parent: No

### Edit Team Metadata
- Master Admin: Yes
- Club Admin: Yes (own club)
- Coach: No by default (optional limited edit if club allows specific fields)
- Parent: No

### Archive Team
- Master Admin: Yes
- Club Admin: Yes (own club)
- Coach: No
- Parent: No

---

## 6.5 Team Coach Assignment Module

### View Assigned Coaches
- Master Admin: Yes
- Club Admin: Yes
- Coach: View assigned coaches for own team(s)
- Parent: View coach display info for linked child’s team if allowed

### Assign / Remove Coach
- Master Admin: Yes
- Club Admin: Yes (own club)
- Coach: No
- Parent: No

---

## 6.6 Players Module

### Player List (Club-Wide)
- Master Admin: View all
- Club Admin: View all own club
- Coach: No club-wide page access unless filtered to assigned teams
- Parent: No club-wide page access

### Team Roster List
- Master Admin: View all
- Club Admin: View full within club
- Coach: View full for assigned teams
- Parent: View limited/safe roster for linked child team(s)

### Create Player
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams
- Parent: No

### Edit Player (Full)
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for players on assigned teams
- Parent: No full edit

### Edit Player (Limited Own Child Fields)
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes
- Parent: Yes, but only for linked child and only approved fields

### Archive Player
- Master Admin: Yes
- Club Admin: Yes
- Coach: Optional if club allows, otherwise No
- Parent: No

### View Player Detail
- Master Admin: Full
- Club Admin: Full
- Coach: Full for assigned-team players
- Parent: Full approved view for linked child only; limited view or blocked for other children

---

## 6.7 Parent / Guardian Module

### Parent List
- Master Admin: View all
- Club Admin: View own club parents
- Coach: View contact summary for parents of assigned team(s) if club policy allows
- Parent: No general parent list access

### Create / Invite Parent
- Master Admin: Yes
- Club Admin: Yes
- Coach: Optional invite request only if club allows; otherwise No
- Parent: No

### Edit Parent Profile
- Master Admin: Yes
- Club Admin: Yes
- Coach: No, except possibly limited contact note field if club permits
- Parent: Edit own parent profile only

### Link / Unlink Parent to Player
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned-team players if club policy allows
- Parent: No direct linking actions

---

## 6.8 Roster Safe Visibility Matrix

### For Other Players in Team Roster
#### Fields Parent Can View
- display name
- preferred name
- jersey number
- primary position
- optional photo (if club setting enabled)
- team name / age group in context

#### Fields Parent Cannot View for Other Players
- date of birth
- medical notes
- emergency contacts
- address
- school information
- internal coach notes
- evaluation scores
- bucket labels / rankings unless club explicitly enables a limited view (not recommended)
- invoices, waivers, registration details
- parent contact info for other families unless club explicitly shares it

### For Own Linked Child
Parent can view and potentially edit approved fields based on club policy.

---

## 6.9 Files / Documents Module

### Upload Files
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams/resources
- Parent: Yes only in approved contexts (registration uploads, child photo, waiver related docs, team chat attachments if allowed)

### View Files
- Master Admin: All
- Club Admin: Own club files
- Coach: Team-scoped files and permitted player/team docs
- Parent: Only files tied to linked child or shared team/club documents

### Delete / Archive Files
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for coach-uploaded team documents if within scope and policy allows
- Parent: No by default, except remove own draft upload before submit in limited workflows

---

## 6.10 Announcements Module

### View Announcements
- Master Admin: All
- Club Admin: Own club
- Coach: Assigned teams + club announcements visible to coaches
- Parent: Linked child team announcements + club announcements relevant to parents

### Create Announcement
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned team announcements only
- Parent: No

### Edit Draft Announcement
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for own team drafts
- Parent: No

### Publish Announcement
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned team announcements only
- Parent: No

### Delete / Archive Announcement
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for own team announcement drafts/posted announcements if policy allows
- Parent: No

---

## 6.11 Chat / Messaging Module

### View Team Chat
- Master Admin: Yes if support/audit policy permits
- Club Admin: Yes for club teams if policy permits moderation visibility
- Coach: Yes for assigned teams
- Parent: Yes for linked child teams

### Send Team Message
- Master Admin: Not typical but allowed in support/admin context if needed
- Club Admin: Yes for club/team channels where permitted
- Coach: Yes for assigned teams
- Parent: Yes for linked child team chat if chat is enabled

### Parent-to-Parent Messaging
- Master Admin: N/A admin visibility only
- Club Admin: Configure allowed/disabled
- Coach: N/A for controlling, may participate in shared channel
- Parent: Allowed only if club setting enables it

### Delete / Moderate Message
- Master Admin: Yes
- Club Admin: Yes for moderation
- Coach: Limited moderation for assigned team chat if policy allows
- Parent: No, except delete/edit own message within short grace window if product supports it

### View Direct Messages
- Master Admin: Only if policy/support review permits
- Club Admin: Optional moderation visibility by policy
- Coach: Yes where part of conversation
- Parent: Yes where part of conversation

---

## 6.12 Events / Schedule Module

### View Team Events
- Master Admin: Yes
- Club Admin: Yes within club
- Coach: Yes for assigned teams
- Parent: Yes for linked child teams

### Create Event
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams
- Parent: No

### Edit Event
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams
- Parent: No

### Cancel Event
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams
- Parent: No

### View Club-Wide Events
- Master Admin: Yes
- Club Admin: Yes
- Coach: View relevant club events if exposed
- Parent: View relevant club events if exposed

---

## 6.13 RSVP Module

### Submit RSVP
- Master Admin: Override only if needed
- Club Admin: Override yes
- Coach: Optional override yes if club allows
- Parent: Yes for linked child only

### View RSVP Summary
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams/events
- Parent: View own child RSVP and possibly aggregate counts if shown, but not necessarily all individual child responses unless allowed in UI

### Edit RSVP After Submission
- Master Admin: Yes
- Club Admin: Yes
- Coach: Override yes if policy allows
- Parent: Yes for linked child until event lock/deadline rules apply

---

## 6.14 Attendance Module

### Record Attendance
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams
- Parent: No

### View Attendance Summary
- Master Admin: All
- Club Admin: Own club
- Coach: Assigned teams and assigned players
- Parent: Own child only

### Export Attendance
- Master Admin: Yes
- Club Admin: Yes
- Coach: Optional for assigned team if policy allows
- Parent: No

---

## 6.15 Registration Module

### View Registration Programs
- Master Admin: Yes
- Club Admin: Yes
- Coach: View published programs if needed, generally read-only
- Parent: Yes for club or linked child relevant programs

### Create / Edit Registration Program
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### Create / Edit Registration Form Schema
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### Submit Registration
- Master Admin: Yes for admin support use case
- Club Admin: Yes for support/manual entry
- Coach: No by default
- Parent: Yes for linked child only

### Review / Approve / Reject Registration
- Master Admin: Yes
- Club Admin: Yes
- Coach: View-only completeness status optional for assigned team if club allows, but no approve/reject by default
- Parent: No

### View Registration Submission Detail
- Master Admin: Full
- Club Admin: Full within club
- Coach: Limited view only if allowed and only for assigned team players; no financial/private legal details unless explicitly allowed
- Parent: Full for own linked child submissions

---

## 6.16 Billing / Payments Module

### View Invoice List
- Master Admin: All
- Club Admin: Own club
- Coach: No by default
- Parent: Own family / linked child invoices only

### Create Invoice
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### Edit Invoice / Void Invoice
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### Record Offline Payment
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### Initiate Online Payment
- Master Admin: Support/admin action yes if needed
- Club Admin: Optional support action yes
- Coach: No
- Parent: Yes for own invoice only

### View Payment History
- Master Admin: All
- Club Admin: Own club
- Coach: No
- Parent: Own family only

### Refund Payment
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### View Billing Summary Reports
- Master Admin: Yes
- Club Admin: Yes
- Coach: No by default
- Parent: No aggregated reports; only own invoice summary pages

---

## 6.17 Waivers Module

### View Waiver List
- Master Admin: All
- Club Admin: Own club
- Coach: No by default, but may view compliance summary for assigned team if club allows
- Parent: Own linked child required waivers only

### Create / Edit Waiver
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### Add Waiver Version
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### Accept Waiver
- Master Admin: Support/admin action yes if acting on behalf under policy
- Club Admin: Support/manual action yes if policy permits
- Coach: No
- Parent: Yes for linked child only

### View Waiver Compliance Summary
- Master Admin: All
- Club Admin: Own club
- Coach: Limited team-level compliance yes if club allows (for operational readiness only)
- Parent: Own linked child only

---

## 6.18 Evaluations Module

### View Evaluation Templates
- Master Admin: All
- Club Admin: Own club
- Coach: View active template(s) for assigned team use
- Parent: No

### Create / Edit Evaluation Template
- Master Admin: Yes
- Club Admin: Yes
- Coach: No by default
- Parent: No

### View / Edit Evaluation Criteria
- Master Admin: Yes
- Club Admin: Yes
- Coach: View only
- Parent: No

### View / Edit Position Weight Profiles
- Master Admin: Yes
- Club Admin: Yes
- Coach: View only by default; optional propose changes if business wants later
- Parent: No

### Create Evaluation Cycle
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams if club allows
- Parent: No

### Create Player Evaluation
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for players on assigned teams
- Parent: No

### Edit Player Evaluation
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for evaluations within assigned scope
- Parent: No

### View Player Evaluation
- Master Admin: Full
- Club Admin: Full within club
- Coach: Full for assigned-team players
- Parent: Own child parent-visible evaluation summary only if club setting allows

### View Team Ranking / Buckets
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams
- Parent: No by default

### View Radar Comparison
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams
- Parent: No by default

### Share Evaluation with Parent
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes if club setting allows
- Parent: N/A recipient only

---

## 6.19 Development Tracking Module

### View Development Goals
- Master Admin: All
- Club Admin: Own club
- Coach: Assigned team players
- Parent: Own child parent-visible goals only

### Create Development Goal
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned team players
- Parent: No

### Edit Goal / Add Updates
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned team players
- Parent: No, unless future parent reflection/comment feature is intentionally added

### Mark Goal Complete
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes
- Parent: No

### View Coach-Only Notes
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes
- Parent: No

### View Parent-Visible Notes
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes
- Parent: Yes for linked child only if club enables development view

---

## 6.20 Notifications Module

### View Own Notifications
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes
- Parent: Yes

### Update Notification Preferences
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes
- Parent: Yes

### Send Notifications (manual trigger)
- Master Admin: Yes
- Club Admin: Yes
- Coach: Limited for assigned team announcements/reminders where supported
- Parent: No

---

## 6.21 Reports Module

### View Attendance Reports
- Master Admin: All
- Club Admin: Own club
- Coach: Assigned team reports
- Parent: No aggregate report, own child attendance summary only

### View Registration Reports
- Master Admin: All
- Club Admin: Own club
- Coach: Limited completeness view only if allowed
- Parent: No aggregate reports

### View Billing Reports
- Master Admin: All
- Club Admin: Own club
- Coach: No
- Parent: No aggregate reports

### View Evaluation Reports
- Master Admin: All
- Club Admin: Own club
- Coach: Assigned team reports
- Parent: No aggregate reports

### Export Reports
- Master Admin: Yes
- Club Admin: Yes
- Coach: Limited export for team attendance/evaluation if policy allows
- Parent: No

---

## 6.22 AI Assistant Module

### Access AI Assistant Surface
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes
- Parent: Optional limited read/use cases if enabled later

### Draft Announcement with AI
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned teams
- Parent: No

### Draft Payment Reminder with AI
- Master Admin: Yes
- Club Admin: Yes
- Coach: No
- Parent: No

### Draft Training Plan with AI
- Master Admin: Optional
- Club Admin: Optional
- Coach: Yes
- Parent: No

### Generate Player Development Summary with AI
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned players
- Parent: No direct generation, only read shared summary if enabled

### Publish AI-Generated Content
- Master Admin: Yes
- Club Admin: Yes
- Coach: Yes for assigned team content where applicable
- Parent: No

### AI Guardrails
Regardless of role:
- AI must not expose hidden fields
- AI drafts require review before publish by default
- AI cannot autonomously send communication unless explicit admin setting allows in a future phase

---

## 6.23 Audit Logs Module

### View Audit Logs
- Master Admin: Full system-wide
- Club Admin: Own club logs only
- Coach: No by default
- Parent: No

### Export Audit Logs
- Master Admin: Yes
- Club Admin: Optional own club export if policy allows
- Coach: No
- Parent: No

---

## 7. Field-Level Visibility Matrix

## 7.1 Player Fields

### Fields Visible to Master Admin / Club Admin / Coach
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

### Fields Visible to Parent for Own Child
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
- own child registrations, waivers, invoices
- own child parent-visible evaluations/development if enabled

### Fields Visible to Parent for Other Players
- display name
- preferred name
- jersey number
- primary position
- optional photo if enabled

### Fields Hidden from Parent for Other Players
- DOB
- address
- medical notes
- emergency contacts
- evaluation scores
- rankings
- coach-only notes
- parent contact info
- invoice / waiver / registration records

---

## 7.2 Parent Fields

### Visible to Club Admin
- full parent business profile
- linked children
- contact details

### Visible to Coach
- parent display name
- contact methods for assigned team players, if club policy allows
- pickup/payment permission summaries if operationally needed and permitted

### Visible to Other Parents
- none by default
- optional limited contact sharing only if club setting intentionally enables directory-style sharing

---

## 7.3 Evaluation Fields

### Visible to Master Admin / Club Admin
- full template config
- criteria
- weight profiles
- all player scores
- rankings
- coach notes
- parent-visible notes

### Visible to Coach
- full evaluation data for assigned players

### Visible to Parent
- only own child
- only parent-visible notes/summary
- optionally criterion scores if club allows
- no teamwide ranking by default

---

## 7.4 Billing Fields

### Visible to Master Admin / Club Admin
- full invoice and payment details

### Visible to Coach
- none by default
- optional registration completeness or compliance summary only, not amounts/payment methods

### Visible to Parent
- own family invoices, balances, payment history, waiver status, registration status

---

## 8. Page-Level RBAC Summary

## 8.1 Master Admin Pages
- Dashboard: Master Admin only
- Clubs: Master Admin only
- Users: Master Admin only
- Audit Logs: Master Admin only
- System Settings: Master Admin only

## 8.2 Club Admin Pages
- Dashboard: Club Admin, Master Admin
- Teams: Club Admin, Master Admin
- Players: Club Admin, Master Admin
- Parents: Club Admin, Master Admin
- Coaches: Club Admin, Master Admin
- Schedule: Club Admin, Master Admin
- Attendance: Club Admin, Master Admin
- Registration: Club Admin, Master Admin
- Payments: Club Admin, Master Admin
- Waivers: Club Admin, Master Admin
- Announcements: Club Admin, Master Admin
- Evaluations: Club Admin, Master Admin
- Reports: Club Admin, Master Admin
- AI Assistant: Club Admin, Master Admin
- Settings: Club Admin, Master Admin

## 8.3 Coach Pages
- Dashboard: Coach, Club Admin, Master Admin (different views)
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

## 8.4 Parent Pages
- My Kids Dashboard: Parent only
- Child Profile: Parent linked child only
- Schedule: Parent linked child only
- Team Roster: Parent safe roster view only
- Chat: Parent linked child teams only
- Announcements: Parent linked child teams/clubs only
- Registration: Parent linked child only
- Payments: Parent own family only
- Waivers: Parent linked child only
- Development: Parent linked child only if enabled
- Documents: Parent linked child/team docs only

---

## 9. API Permission Mapping Guidance
Use this section as implementation guidance for service/controller authorization.

### Example Rules
- `GET /teams/{teamId}/players`
  - Coach: allowed if assigned to team
  - Parent: allowed if linked child is on team, but safe projection only

- `PUT /players/{playerId}`
  - Parent: allowed only if player linked to authenticated parent and only for whitelisted fields
  - Coach: allowed only if player belongs to assigned team

- `POST /events/{eventId}/attendance`
  - Coach: allowed only for assigned team event
  - Parent: forbidden

- `POST /waivers/{waiverId}/accept`
  - Parent: allowed only for linked child

- `POST /players/{playerId}/evaluations`
  - Coach: allowed only for assigned team player
  - Parent: forbidden

- `GET /teams/{teamId}/radar-comparison`
  - Coach: allowed
  - Club Admin: allowed
  - Parent: forbidden by default

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
parents.manage
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
4. **Field whitelist**: especially for parent edits and parent-safe reads
5. **Serializer projection**: enforce visible fields by role
6. **Audit logging**: record sensitive changes and overrides

---

## 12. Special Rules and Edge Cases

### 12.1 Coach Who Is Also a Parent (Future)
If a single user has both roles:
- require active role context selection or infer context from navigation area
- never merge coach-level and parent-level data accidentally
- parent-safe restrictions still apply when operating in parent context

### 12.2 Club Admin Viewing Chat
Club policy should decide whether club admin can view all chats for moderation/support. Default recommendation:
- yes for team chats and official communications
- direct message visibility only if policy/legal expectations allow

### 12.3 Parent Visibility to Evaluation Data
Default recommendation:
- off for teamwide rankings
- on only for own child summary if club explicitly enables

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

1. Parent cannot edit another child’s profile.
2. Parent team roster response excludes restricted fields for other children.
3. Coach cannot access roster for unassigned team.
4. Club Admin cannot access another club’s data.
5. Parent cannot view another family’s invoice.
6. Coach can create evaluation only for assigned team player.
7. Parent cannot access radar comparison endpoint.
8. Club Admin can update position weight profiles within own club.
9. Coach cannot void invoice.
10. Parent can RSVP only for linked child.
11. Parent cannot see coach-only development notes.
12. AI draft generation cannot include hidden fields in output context.

---

## 14. Final Recommendation
Use this RBAC matrix as the authoritative permission guide for backend authorization, frontend visibility rules, serializer projections, and QA test coverage.

The most important implementation priorities are:
- tenant scope enforcement by `club_id`
- team scope enforcement for coaches
- linked-child scope enforcement for parents
- strict field-level filtering for parent-safe roster views
- separation of coach-only vs parent-visible evaluation/development content
- no financial or sensitive child data leakage outside intended role/scope

This document should eliminate ambiguity for Claude Code when implementing guards, policies, DTO whitelists, and UI-level role behavior.
