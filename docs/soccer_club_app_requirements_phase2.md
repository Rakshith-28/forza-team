# Soccer Club Management App - Consolidated Requirements (Phase 1 + Phase 2)

## 1. Document Purpose
This document is a consolidated product and technical requirements specification for building a multi-tenant soccer club management platform similar to TeamSnap, extended with advanced player evaluation, scheduling, registration, payments, waivers, attendance, mobile app support, coach development tracking, and AI assistant / Copilot features.

This document is intended to be handed to Claude Code for implementation planning and development.

---

## 2. Product Vision
Build a modern, multi-tenant soccer club operating system that helps clubs run administration, communications, team management, player development, and parent engagement from one platform.

The product should support:
- System-wide master administration
- Club-specific administration
- Team-level coach workflows
- Parent / guardian access with one login for all linked children
- Roster management with privacy-safe access controls
- Team communication and announcements
- Scheduling, RSVP, attendance, and availability workflows
- Payments, registration, waivers, and season operations
- Player evaluation, ranking, radar charts, and development tracking
- AI assistant features for admins and coaches
- Mobile-first experience with real-time notifications

---

## 3. Core Design Principles
1. **Multi-tenant first**: each club is logically isolated.
2. **Role-based access**: permissions depend on user role and team/club relationships.
3. **Privacy by design**: parent visibility to other kids must be limited and safe.
4. **Single parent login**: one parent account can access all linked children across teams.
5. **Extensible platform**: architecture must support future modules without redesign.
6. **Auditability**: all privileged admin actions must be logged.
7. **Mobile-ready**: all user journeys should work smoothly on mobile.
8. **AI-ready**: workflows should expose structured data for automation and Copilot use cases.

---

## 4. User Roles

### 4.1 Master Admin
System-wide administrator.

#### Capabilities
- Create, edit, suspend, archive, and manage all clubs
- Manage system settings, global feature flags, subscription plans, and templates
- Create initial club admin users
- View all clubs, users, teams, rosters, chats, schedules, payments, registrations, evaluations, and audit logs
- Impersonate club admins for support (must be audited)
- Manage AI and notification settings globally
- Access reporting across all tenants

---

### 4.2 Club Admin
Admin for one specific club.

#### Capabilities
- Manage club profile, seasons, programs, teams, age groups, and divisions
- Manage all coaches, players, parents, and staff in the club
- Assign coaches to teams
- Configure club-level permissions, roster visibility, messaging rules, and payment settings
- Manage registration forms, waivers, and payment plans for the club
- Send club-wide announcements
- Access club-wide reports, development dashboards, attendance summaries, and finance summaries

#### Restrictions
- Cannot access other clubs
- Cannot change master system settings

---

### 4.3 Coach
Coach for one or more assigned teams.

#### Capabilities
- Manage roster for assigned teams
- Edit player profiles for assigned teams
- Record attendance, availability, and team notes
- Manage team schedule items
- Send team announcements and participate in team chat
- Perform player evaluations, rankings, and development tracking
- Use radar comparisons and player scoring tools
- Access AI assistant features for practice planning, lineups, recap generation, and development insights

#### Restrictions
- Cannot access teams outside assigned scope unless explicitly granted read-only access
- Cannot manage club billing or club-wide settings unless elevated role is granted

---

### 4.4 Parent / Guardian
Parent account linked to one or more children.

#### Capabilities
- One login can access all linked children across all teams within the club (and design should support multi-club future)
- View teams, rosters, schedule, announcements, attendance summaries, invoices, waivers, and team chat for linked children
- Update approved profile fields for own child only
- RSVP and update availability for own child
- Complete registration forms, sign waivers, and pay fees for linked children
- Receive AI-generated summaries, reminders, and translated announcements if enabled

#### Restrictions
- Cannot edit other players
- Cannot view sensitive data for other children
- Parent-to-parent chat should be optional and controlled by club setting

---

## 5. Recommended Roster Access Model
This remains the recommended access model.

### Coach Access
Coaches can:
- View all players on assigned teams
- Edit all player profile fields allowed by club policy
- Update jersey number, positions, notes, attendance, availability, emergency details, and evaluation data
- Link / unlink parents
- Upload photos and documents

### Parent Access
Parents can:
- View the team roster
- Edit only their own child’s approved fields
- View only privacy-safe limited fields for other children
- Access messaging and team resources based on team membership

### Parent Visibility for Other Players
Visible:
- Player name
- Preferred name
- Jersey number
- Position
- Team name
- Age group
- Optional photo if club enables it

Hidden:
- Date of birth
- Address
- School info
- Emergency contact details
- Medical notes
- Insurance details
- Internal coach notes
- Player evaluations
- Payment data
- Legal documents

### Editable Fields for Parent on Own Child
- Preferred name
- Photo
- Jersey size
- Parent contact details
- Emergency contact
- Medical and allergy notes if enabled by club
- Availability / RSVP data
- Registration responses
- Waiver acknowledgements

---

## 6. Functional Scope Overview

### Phase 1 (Core Foundation)
- Authentication and user management
- Multi-tenant club and team management
- Roster page
- Parent-child linking
- Team chat and announcements
- Basic documents

### Phase 2 (Expanded Club Operations)
- Scheduling + RSVP + attendance
- Payments + registration + waivers
- Mobile app requirements
- Player evaluation, ranking, radar comparisons, and development tracking
- AI assistant / Copilot features
- Stronger reporting, notifications, and admin workflows

---

## 7. Phase 2 Feature: Player Evaluation, Ranking, and Radar Comparison
This phase must add functionality inspired by the attached player ranking workbook, including weighted scoring, buckets, dashboarding, and radar comparison. The workbook supports position-based weights, player ratings by criteria, ranking into Top 8 / Middle 8 / Bottom 8, dashboard metrics, and radar chart comparison for up to 2–3 players. The app should incorporate equivalent workflows in product form, not as spreadsheet dependency. 

### 7.1 Purpose
Allow coaches and club admins to evaluate players consistently, compare players visually, and track development over time.

### 7.2 Core Evaluation Criteria
At minimum support these criteria:
- Work Rate
- Passing
- Dribbling
- Physicality
- Aggression
- Pace
- Tactical Awareness
- Coach Notes

The design must support adding/removing criteria per club in future.

### 7.3 Position-Based Weight Profiles
The app must support different weights by position.
Default positions:
- GK
- CB
- FB
- DM
- CM
- AM
- Winger
- ST
- Utility

Each position must have its own weight distribution across the criteria. Total should equal 100.

### 7.4 Evaluation Behavior
- Coach or authorized club admin can score a player on each criterion on a 0–10 or 1–10 scale (configurable)
- System calculates overall weighted score automatically
- Score uses the player’s assigned position to determine weight profile
- Rank players across selected scope (team, age group, club, season)
- Bucket players into labels such as:
  - Top 8
  - Middle 8
  - Bottom 8
- Support tie-handling rules
- Preserve historical evaluations over time rather than overwriting previous cycles

### 7.5 Radar Comparison Feature
The app must include a radar comparison UI similar to the attached radar worksheet where coaches can pick 2–3 players and compare their shapes across the evaluation criteria. The attached sheet shows a comparison view with selected players and metrics for Work Rate, Passing, Dribbling, Physicality, Aggression, Pace, and Tactical Awareness. 

#### Radar Requirements
- Allow selection of 2–3 players from same team or same filtered scope
- Display radar chart overlay for selected players
- Show criterion values per selected player
- Support toggle between latest evaluation and selected date range / evaluation cycle
- Allow export as image or PDF in future

### 7.6 Evaluation Dashboard Requirements
Include dashboard widgets similar in intent to the spreadsheet dashboard:
- leaderboard by selected metric
- bucket distribution counts
- physicality vs aggression scatter plot
- position comparison summaries
- trend over time per player
- team average by criterion
- strongest and weakest attributes by team

### 7.7 Evaluation Use Cases
- Coach quarterly or seasonal evaluations
- Tryouts and selection
- Player promotion / demotion discussions
- Development planning with parents
- Identifying players with strong technical profile but weaker physicality/aggression
- Comparing players by position profile

### 7.8 Evaluation Roles
- Master Admin: view all
- Club Admin: configure templates and view all club evaluations
- Coach: create/update evaluations for assigned team(s)
- Parent: view only their own child’s evaluation summaries if club enables it

### 7.9 Parent Visibility Recommendation
Default recommendation:
- Parents should see development summaries for their own child only
- Parents should not see rankings of other children by default
- Club can optionally enable child-only development reports, not teamwide ranking visibility

### 7.10 Data Entities for Evaluation Module
- evaluation_templates
- evaluation_criteria
- position_weight_profiles
- evaluation_cycles
- player_evaluations
- player_evaluation_scores
- player_evaluation_comments
- player_development_goals
- player_development_progress

---

## 8. Scheduling + RSVP + Attendance

### 8.1 Scheduling Scope
Support scheduling for:
- practices
- games
- tournaments
- meetings
- team events
- club-wide events

### 8.2 Event Fields
- Event ID
- Club ID
- Team ID (nullable for club-wide)
- Event Type
- Title
- Description
- Start DateTime
- End DateTime
- Time Zone
- Location Name
- Address / Map Link
- Opponent (for game)
- Home/Away flag
- Uniform / equipment notes
- Arrival time
- Status (Scheduled, Cancelled, Completed, Postponed)
- Created By / Updated By

### 8.3 Scheduling Capabilities
- Club admin can create club-wide and team events
- Coach can create team events for assigned teams
- Parents can view events for linked children
- Calendar views: month / week / agenda / by team / by child
- Attach files to event
- Event reminders via app/email/push
- Recurring event support
- Weather/cancellation status field (future)

### 8.4 RSVP / Availability
Parents (and later players if player login exists) can mark:
- Going
- Not Going
- Maybe
- Late
- Needs Ride / Offering Ride (optional future)

#### RSVP Rules
- RSVP is per child, not per parent account globally
- Coach can see team attendance forecast
- RSVP deadline can be configured
- System should log who responded and when
- Late changes should trigger coach notification if configured

### 8.5 Attendance Tracking
Coaches can record attendance for events:
- Present
- Excused Absent
- Unexcused Absent
- Late
- Injured
- Partial

#### Attendance Features
- Quick attendance entry from event page
- Bulk update attendance
- Attendance history per player
- Team attendance rate dashboards
- Export attendance report
- Attendance visible to parent for own child only

### 8.6 Entities
- events
- event_participants
- event_rsvps
- attendance_records
- event_attachments
- event_reminders

---

## 9. Payments / Registration / Waivers

### 9.1 Registration Module
Allow clubs to create registration workflows for programs, teams, camps, and seasons.

### 9.2 Registration Form Features
- Dynamic forms by program/team/season
- Required and optional questions
- Medical info fields
- Emergency contact fields
- Uniform size fields
- Prior experience fields
- Payment plan selection
- Waiver acceptance
- Document upload

### 9.3 Registration Capabilities
- Club admin can publish registration windows
- Parent can register one or multiple children
- Parent can resume partially completed registration
- Club admin can review registration status
- Registration status values: Draft, Submitted, Approved, Waitlisted, Rejected, Cancelled

### 9.4 Payments
Support fees for:
- registration fees
- season dues
- tournament fees
- uniform fees
- installment plans
- late fees
- discounts / scholarships / coupon codes

### 9.5 Payment Features
- invoice generation
- partial payments
- payment plans with due dates
- receipts
- overdue reminders
- ledger per family
- refund tracking
- manual offline payment entry by admin
- export finance reports

### 9.6 Waivers
Support digital waivers and acknowledgements:
- liability waiver
- medical consent
- media consent
- travel consent
- club code of conduct

#### Waiver Requirements
- versioned templates
- e-sign acknowledgement timestamp
- accepted by parent / guardian for each child
- immutable accepted copy stored for audit
- expiration / renewal support

### 9.7 Finance Roles
- Master Admin: full view
- Club Admin: full club finance/admin access
- Coach: no payment access by default, optional view-only to registration completeness for assigned team
- Parent: own family invoices, receipts, and waivers only

### 9.8 Entities
- registration_programs
- registration_forms
- registration_submissions
- registration_answers
- invoices
- invoice_items
- payments
- payment_plans
- discounts
- waivers
- waiver_versions
- waiver_acceptances
- refunds

---

## 10. Mobile App Requirements
The product should support responsive web immediately and native or cross-platform mobile app planning in Phase 2.

### 10.1 Mobile Personas
- Parent on the go
- Coach on the field
- Club admin handling operations remotely

### 10.2 Must-Have Mobile Flows
- login
- switch between linked children
- view schedule
- RSVP to events
- receive push notifications
- chat with team
- read announcements
- upload child photo / documents
- pay invoices
- sign waivers
- quick roster lookup
- coach attendance entry from sideline
- coach evaluation entry during/after training or game

### 10.3 Mobile UX Requirements
- bottom navigation for primary areas
- offline-aware behaviors where possible
- push notification deep linking
- camera upload for photos and documents
- fast event check-in / attendance modes
- mobile-optimized radar chart and player comparison views
- role-aware dashboards

### 10.4 Notification Requirements
Push notifications for:
- new event / changed event
- RSVP reminder
- attendance marked
- new message
- new announcement
- invoice due / overdue
- registration incomplete
- waiver expiring
- evaluation summary available if enabled

### 10.5 Technical Requirements
- API-first backend
- auth token refresh support
- realtime messaging support
- push notification service abstraction
- image optimization
- secure local token storage

---

## 11. Coach Evaluation + Player Development Tracking
This expands the evaluation feature into ongoing development.

### 11.1 Goals
- Track player progress across time
- Set goals and monitor improvement
- Give coaches structured observations
- Provide club leadership with development visibility

### 11.2 Development Features
- Create evaluation cycles (e.g., preseason, midseason, postseason, tryout)
- Define player goals by category
- Record strengths, improvement areas, and action plans
- Track progress status on each goal
- Attach notes, clips, or documents
- Show trend lines across cycles
- Compare player current vs previous evaluation
- Allow coach-only notes and parent-visible notes separately

### 11.3 Example Goal Types
- Improve weak foot passing
- Improve tactical awareness in transition
- Increase physical competitiveness
- Improve pressing work rate
- Improve attendance consistency

### 11.4 Development Views
- Player detail development tab
- Team development board
- Club talent overview dashboard
- Parent development summary page (limited)

### 11.5 Reporting
- evaluation cycle completion rate
- average score by criterion/team/position
- player improvement delta over time
- coach comments summary
- readiness / promotion candidates

### 11.6 Additional Entities
- development_goals
- development_goal_updates
- player_progress_snapshots
- development_visibility_rules

---

## 12. AI Assistant / Copilot Features
This phase should add optional AI-assisted workflows for admins and coaches.

### 12.1 AI Principles
- AI suggestions must be reviewable
- Sensitive actions should require user confirmation
- AI must respect tenant boundaries and role permissions
- AI outputs should be auditable if used in official workflows

### 12.2 AI Use Cases for Club Admins
- Generate club announcements from prompts or templates
- Summarize unread messages / club activity
- Draft reminder campaigns for incomplete registrations or overdue payments
- Generate registration FAQs from policy documents
- Summarize attendance trends by team
- Create season kickoff communication packs

### 12.3 AI Use Cases for Coaches
- Generate training session plans by age group and focus area
- Summarize recent team attendance and availability
- Generate match / practice recap drafts
- Suggest player development observations from evaluation data
- Draft parent update messages for team events
- Build lineup suggestions using availability, attendance, and player roles
- Generate player comparison summaries from radar/evaluation data

### 12.4 AI Use Cases for Parents (Optional and Controlled)
- Summarize upcoming events across all children
- Explain invoices and payment plan status in plain language
- Translate announcements or chat summaries
- Answer FAQs about schedules, registration, and waivers

### 12.5 AI Feature Guardrails
- No autonomous messaging by default without approval setting
- AI should never reveal another child’s hidden data
- AI outputs should cite source records internally where possible
- AI-generated development comments should be editable by coach before sharing
- Club setting should enable/disable AI features per module

### 12.6 AI Assistant Surfaces
- dashboard assistant panel
- chat-like copilot sidebar
- quick actions on roster, schedule, registration, payments, and evaluation pages
- scheduled digest generation

### 12.7 AI Data Inputs
- roster data
- team schedules
- attendance history
- chat/announcement content where role permits
- evaluation and development records
- registration/payment metadata where role permits

---

## 13. Authentication & User Management

### Requirements
- Secure email/password login
- Forgot/reset password
- Optional MFA for master admin and club admin
- Invitation-based onboarding for coaches and parents
- Audit logs for sensitive account changes
- Parent account can link multiple children
- Coach account can be assigned to multiple teams
- Design schema to support user with multiple business roles in future

### Recommended Identity Model
- users table for authentication identity
- separate role assignment table with tenant and scope references
- child linkage via parent-child relationship table

---

## 14. Core Data Model
Suggested initial tables / collections:
- users
- roles
- user_role_assignments
- clubs
- seasons
- teams
- team_coaches
- players
- player_team_memberships
- parents
- player_parent_links
- announcements
- chats
- chat_members
- messages
- files
- events
- event_rsvps
- attendance_records
- registration_programs
- registration_forms
- registration_submissions
- registration_answers
- invoices
- invoice_items
- payments
- payment_plans
- waivers
- waiver_versions
- waiver_acceptances
- evaluation_templates
- evaluation_criteria
- position_weight_profiles
- evaluation_cycles
- player_evaluations
- player_evaluation_scores
- development_goals
- development_goal_updates
- audit_logs
- notifications
- notification_preferences
- invitations

---

## 15. Key Pages / Screens

### Master Admin
- System Dashboard
- Clubs Management
- Users Management
- Global Settings
- Plans / Feature Flags
- Audit Logs
- Support / Impersonation

### Club Admin
- Club Dashboard
- Teams
- Players
- Coaches
- Parents
- Schedule
- Attendance
- Registration
- Payments
- Waivers
- Announcements
- Evaluation Settings
- AI Assistant
- Reports
- Club Settings

### Coach
- Team Dashboard
- Roster
- Schedule
- RSVP / Availability View
- Attendance Entry
- Team Chat
- Announcements
- Documents
- Player Evaluations
- Radar Comparison
- Development Tracking
- AI Assistant

### Parent
- My Kids Dashboard
- Team Schedule
- RSVP / Availability
- Team Roster
- Team Chat
- Announcements
- Child Profile
- Registration
- Payments
- Waivers
- Child Development Summary (if enabled)

---

## 16. API Design (High-Level)

### Auth
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Clubs / Teams
- `GET /api/clubs`
- `POST /api/clubs`
- `GET /api/clubs/{clubId}`
- `PUT /api/clubs/{clubId}`
- `GET /api/clubs/{clubId}/teams`
- `POST /api/clubs/{clubId}/teams`
- `GET /api/teams/{teamId}`
- `PUT /api/teams/{teamId}`

### Players / Roster
- `GET /api/teams/{teamId}/players`
- `POST /api/teams/{teamId}/players`
- `GET /api/players/{playerId}`
- `PUT /api/players/{playerId}`
- `POST /api/players/{playerId}/parents`
- `DELETE /api/players/{playerId}/parents/{parentId}`

### Events / RSVP / Attendance
- `GET /api/teams/{teamId}/events`
- `POST /api/teams/{teamId}/events`
- `GET /api/events/{eventId}`
- `PUT /api/events/{eventId}`
- `POST /api/events/{eventId}/rsvps`
- `GET /api/events/{eventId}/attendance`
- `POST /api/events/{eventId}/attendance`

### Registration / Payments / Waivers
- `GET /api/clubs/{clubId}/registration-programs`
- `POST /api/clubs/{clubId}/registration-programs`
- `POST /api/registration-submissions`
- `GET /api/parents/me/registrations`
- `GET /api/parents/me/invoices`
- `POST /api/invoices/{invoiceId}/payments`
- `GET /api/parents/me/waivers`
- `POST /api/waivers/{waiverId}/accept`

### Evaluations / Development
- `GET /api/teams/{teamId}/evaluation-cycles`
- `POST /api/teams/{teamId}/evaluation-cycles`
- `GET /api/players/{playerId}/evaluations`
- `POST /api/players/{playerId}/evaluations`
- `PUT /api/player-evaluations/{evaluationId}`
- `GET /api/teams/{teamId}/radar-comparison`
- `GET /api/players/{playerId}/development-goals`
- `POST /api/players/{playerId}/development-goals`

### Messaging / Announcements
- `GET /api/teams/{teamId}/messages`
- `POST /api/teams/{teamId}/messages`
- `GET /api/announcements`
- `POST /api/announcements`

### AI Assistant
- `POST /api/ai/announcements/draft`
- `POST /api/ai/team-recap/draft`
- `POST /api/ai/training-plan/draft`
- `POST /api/ai/player-summary/draft`
- `POST /api/ai/payment-reminders/draft`

---

## 17. Business Rules
1. Master Admin can access all data.
2. Club Admin can access only own club.
3. Coach can access only assigned team(s).
4. Parent can edit only linked child records and only approved fields.
5. Parent visibility for other children must be limited.
6. Registration, payments, and waivers are scoped to the parent’s linked family records.
7. Attendance and RSVP are recorded per child per event.
8. Evaluation scores must be historical and cycle-based.
9. Position-based weights should be editable by club admin and used automatically in score calculation.
10. Parent should not see other players’ rankings by default.
11. All privileged actions must be audited.
12. Deletes should be soft delete where possible.
13. Invitations should expire.
14. AI-generated outputs must require review before publishing by default.

---

## 18. Security / Compliance Requirements
- Strong password hashing
- Secure sessions or JWT with refresh strategy
- Tenant isolation at service and query layer
- Role-based authorization middleware on every API
- PII minimization for parent-visible data
- Encryption in transit and at rest where applicable
- File upload validation and malware scanning hooks
- Audit logging for sensitive actions
- Rate limiting for auth, messaging, and payment-related APIs
- Access logging for impersonation and administrative data export

---

## 19. Audit Logging Requirements
Log at minimum:
- login success/failure
- club create/update/archive
- role assignment changes
- team create/update/archive
- coach assignment changes
- player create/update/archive
- parent-child linkage changes
- event create/update/cancel
- RSVP changes
- attendance updates
- registration submission status changes
- invoice creation/payment/refund updates
- waiver acceptance
- evaluation create/update/share actions
- AI draft generation and publish actions where relevant
- impersonation by master admin

---

## 20. Suggested MVP + Phase 2 Delivery Plan

### Phase 1
- Auth and RBAC
- Club/team/player/parent data model
- Roster and child linking
- Messaging and announcements
- Basic documents

### Phase 2A
- Scheduling
- RSVP / availability
- Attendance
- Notifications

### Phase 2B
- Registration
- Payments
- Waivers
- Parent family finance views

### Phase 2C
- Player evaluation and radar comparison
- Position weight profiles
- Development tracking
- Reporting

### Phase 2D
- Mobile app optimized flows / push notifications
- AI assistant features
- Admin and coach copilots

---

## 21. Acceptance Criteria Highlights

### Roster
- Coach can edit all players on assigned team
- Parent can edit only own child
- Parent sees limited fields for others

### Schedule / RSVP / Attendance
- Parent can RSVP per child
- Coach can record attendance from event page
- Team schedule is visible by child/team

### Registration / Payments / Waivers
- Parent can register and pay for one or multiple linked children
- Club admin can track incomplete forms and overdue payments
- Waivers are versioned and auditable

### Evaluation / Development
- Coach can create evaluation cycle
- Score calculation uses position-based weights automatically
- Players can be ranked and bucketed within selected scope
- Radar comparison supports 2–3 selected players
- Historical trends are preserved

### AI
- User can generate draft announcement / recap / summary
- AI respects role permissions and data visibility
- Publishing AI content requires review by default

---

## 22. Final Recommendation
Adopt the recommended access model and privacy model from Phase 1, and extend the product with these Phase 2 capabilities in a modular way.

The most strategic additions are:
1. Scheduling + RSVP + attendance for day-to-day operations
2. Registration + payments + waivers for club administration
3. Evaluation + radar + development tracking for player growth
4. Mobile-first workflows for parents and coaches
5. AI assistant features for communication, planning, and insights

This creates a stronger product than a basic TeamSnap clone by combining club operations, player development, and AI-assisted productivity into one platform.
