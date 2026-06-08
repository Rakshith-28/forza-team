# Soccer Club Management App - UI/UX Page Specification

## 1. Document Purpose
This document defines the UI/UX page specification for the Soccer Club Management App. It is intended to be a development handoff artifact for Claude Code and should be used together with the product requirements, technical architecture, database schema, and API contract documents.

This document covers:
- app navigation
- information architecture
- page-by-page behavior
- role-based visibility and actions
- forms, tables, filters, drawers, and modals
- mobile behavior guidance
- recommended interaction patterns

The goal is to provide enough detail for implementation of the web application and serve as a strong basis for mobile app design later.

---

## 2. Design Principles
1. **Role-first UX**: every page should adapt to the user’s role and scope.
2. **Multi-tenant clarity**: club context must always be obvious.
3. **Parent simplicity**: parents should quickly see child-specific information with minimal friction.
4. **Coach efficiency**: common coach actions should take as few clicks as possible.
5. **Privacy by design**: parent-safe roster views must never expose restricted data.
6. **Mobile-friendly workflows**: all critical actions should work cleanly on smaller screens.
7. **Modular growth**: new features should fit into predictable navigation and layout patterns.
8. **Actionable dashboards**: summarize what needs attention, not just counts.

---

## 3. Global UX Framework

## 3.1 Primary App Shell
All authenticated areas should use a common shell with:
- left navigation (desktop) / bottom or drawer navigation (mobile)
- top bar
- page title area
- global search or contextual search where appropriate
- notifications icon
- profile menu
- role / club context display

### Top Bar Contents
- club logo or platform logo
- current page title
- breadcrumbs for nested pages
- notifications icon with unread badge
- quick-create button where appropriate
- user avatar / initials menu

### User Menu Options
- My Profile
- Notification Preferences
- Switch Role (future-ready)
- Switch Child Context (for parents)
- Sign Out

---

## 3.2 Global Context Switching
### Parent Context Switching
A parent with multiple linked children must have a **child switcher** visible in the parent dashboard and on any child-specific page.

Recommended behavior:
- dropdown at top of page
- “All Children” summary option on dashboard only
- selected child persists during session until changed

### Club Context
For Master Admin or future multi-club users:
- club selector in top bar or admin shell

---

## 3.3 Shared UI Patterns
Use these reusable patterns consistently:
- **Data tables** for lists (teams, players, invoices, registrations)
- **Cards** for dashboard summaries
- **Drawers** for quick view and edit
- **Modals** for confirmations and small creation flows
- **Tabbed detail pages** for complex entities
- **Inline status badges** for state visibility
- **Filter bars** above tables
- **Empty state panels** when no data exists
- **Sticky action bar** on mobile for primary actions

---

## 3.4 Shared Status Badge Styles
Recommended visual system:
- Active / Completed / Paid / Present = green
- Draft / Pending / Maybe = gray or blue
- Overdue / Cancelled / Absent / Expired = red
- Partially Paid / Late / Waitlisted = amber

---

## 4. Navigation Structure by Role

## 4.1 Master Admin Navigation
- Dashboard
- Clubs
- Users
- Plans / Feature Flags
- Audit Logs
- Support / Impersonation
- System Settings

---

## 4.2 Club Admin Navigation
- Dashboard
- Teams
- Players
- Parents
- Coaches
- Schedule
- Attendance
- Registration
- Payments
- Waivers
- Announcements
- Evaluations
- Reports
- AI Assistant
- Settings

---

## 4.3 Coach Navigation
- Dashboard
- Team Roster
- Schedule
- Attendance
- Chat
- Announcements
- Evaluations
- Radar Comparison
- Development Tracking
- Documents
- AI Assistant

---

## 4.4 Parent Navigation
- My Kids
- Schedule
- Team Roster
- Chat
- Announcements
- Registration
- Payments
- Waivers
- Development
- Documents

---

## 5. Public / Authentication Pages

## 5.1 Login Page
### Purpose
Allow all users to sign in.

### Layout
- centered sign-in card
- email field
- password field
- remember me checkbox (optional)
- sign-in button
- forgot password link
- invite acceptance link or support note

### States
- loading
- invalid credentials error
- account disabled error
- password reset success banner

### Actions
- Sign In
- Forgot Password

---

## 5.2 Forgot Password Page
### Fields
- email

### Actions
- Send Reset Link
- Back to Login

---

## 5.3 Reset Password Page
### Fields
- new password
- confirm password

### Actions
- Reset Password
- Back to Login

---

## 5.4 Invitation Acceptance Page
### Purpose
Allow invited club admins, coaches, and parents to activate account.

### Fields
- first name
- last name
- password
- confirm password
- optional phone

### Actions
- Accept Invitation

### States
- invalid invite
- expired invite
- invite accepted success

---

## 6. Master Admin Pages

## 6.1 Master Admin Dashboard
### Purpose
Provide system-wide overview.

### Sections
- summary cards:
  - total clubs
  - active clubs
  - total users
  - total teams
  - active subscriptions (future)
- recent club activity
- system alerts
- audit log highlights
- support shortcuts

### Actions
- Create Club
- Open Clubs
- View Audit Logs

---

## 6.2 Clubs List Page
### Purpose
Manage all clubs.

### Main Components
- search bar
- status filter
- table with columns:
  - Club Name
  - Short Code
  - Status
  - Teams Count
  - Users Count
  - Created Date
  - Actions

### Row Actions
- View
- Edit
- Suspend / Activate
- Impersonate Club Admin

### Primary Actions
- Create Club

### Supporting UI
- bulk status update (optional future)
- pagination

---

## 6.3 Club Detail Page (Master Admin View)
### Tabs
- Overview
- Teams
- Users
- Settings
- Subscription / Features
- Audit Trail

### Overview Content
- club profile
- status
- quick metrics
- recent activity

---

## 6.4 Users Management Page
### Purpose
Search and inspect users across the platform.

### Filters
- role
- club
- status
- search by name/email

### Table Columns
- Name
- Email
- Role(s)
- Club
- Status
- Last Login
- Actions

---

## 6.5 Audit Logs Page
### Purpose
Review system and tenant-level audit logs.

### Filters
- date range
- actor
- club
- action type
- resource type

### Table Columns
- Timestamp
- Actor
- Club
- Action
- Resource Type
- Resource ID
- Details

### Actions
- open details drawer
- export logs (future)

---

## 7. Club Admin Pages

## 7.1 Club Admin Dashboard
### Purpose
Surface daily operational needs for a club admin.

### Summary Cards
- Teams
- Players
- Coaches
- Parents
- Upcoming Events
- Incomplete Registrations
- Open Invoices
- Pending Waivers

### Main Panels
- upcoming schedule
- recent announcements
- payment/registration alerts
- attendance trends
- evaluation cycle status
- AI quick actions

### Quick Actions
- Create Team
- Add Player
- Send Announcement
- Open Registration
- Create Invoice
- Launch Evaluation Cycle

---

## 7.2 Teams Page
### Purpose
Manage all teams in the club.

### Filters
- season
- age group
- status
- division
- search

### Table Columns
- Team Name
- Team Code
- Season
- Age Group
- Division
- Primary Coach
- Players Count
- Status
- Actions

### Actions
- Create Team
- Edit Team
- Archive Team
- Open Team Detail

### Create/Edit Team Drawer or Modal
Fields:
- team name
- team code
- season
- age group
- division
- competitive level
- primary coach

---

## 7.3 Team Detail Page (Club Admin View)
### Tabs
- Overview
- Roster
- Coaches
- Schedule
- Attendance
- Chat
- Evaluations
- Documents

### Overview Panel
- team metadata
- coaches summary
- players count
- next event
- quick actions

---

## 7.4 Players Page
### Purpose
Search and manage all club players.

### Filters
- team
- season
- status
- position
- search by player name

### Table Columns
- Player Name
- Preferred Name
- Team(s)
- Jersey Number
- Position
- Status
- Parent Count
- Actions

### Actions
- Add Player
- Bulk Import (future)
- View Player
- Edit Player
- Archive Player

---

## 7.5 Player Detail Page (Club Admin / Coach Shared Pattern)
### Header
- player photo
- player name
- preferred name
- age / DOB (role-restricted)
- jersey number
- primary position
- team badges
- status badge

### Tabs
- Profile
- Guardians
- Schedule
- Attendance
- Evaluations
- Development
- Registration
- Billing (admin only)
- Documents

### Profile Tab Sections
- basic info
- medical / emergency info (restricted)
- team memberships
- photo

### Guardians Tab
- linked parents list
- relationship type
- permissions (`can_pickup`, `can_pay`)
- add/remove parent

### Evaluations Tab
- evaluation timeline
- latest overall score
- bucket label
- criterion breakdown
- parent-visible summary vs coach-only notes split

### Development Tab
- goals list
- progress updates
- create goal
- add update

---

## 7.6 Parents Page
### Purpose
Manage parent/guardian records.

### Filters
- search
- status
- linked child/team

### Table Columns
- Parent Name
- Email
- Phone
- Children Count
- Primary Child Team(s)
- Status
- Actions

### Actions
- Add Parent
- Invite Parent
- View Parent
- Edit Parent

---

## 7.7 Parent Detail Page (Club Admin View)
### Tabs
- Profile
- Linked Children
- Invoices
- Waivers
- Activity

### Linked Children Tab
- child cards or table
- relationship type
- primary guardian marker
- manage links

---

## 7.8 Coaches Page
### Purpose
Manage coaches and assignments.

### Filters
- team
- status
- search

### Table Columns
- Coach Name
- Email
- Assigned Teams
- Role Type(s)
- Status
- Last Login
- Actions

### Actions
- Invite Coach
- Assign to Team
- Remove Assignment

---

## 7.9 Schedule Page (Club Admin)
### Purpose
Manage all club/team events.

### View Modes
- month
- week
- agenda
- list

### Filters
- team
- event type
- season
- date range
- status

### Event Card/List Fields
- title
- event type
- team
- start time
- location
- status

### Actions
- Create Event
- Edit Event
- Cancel Event
- Duplicate Event

### Event Detail Drawer
- full event info
- attachments
- RSVP summary
- attendance shortcut
- announcement shortcut

---

## 7.10 Attendance Page (Club Admin)
### Purpose
View attendance trends across teams.

### Filters
- team
- season
- date range
- attendance status

### Sections
- attendance summary cards
- team attendance chart
- player attendance table

### Table Columns
- Player Name
- Team
- Events Count
- Present
- Late
- Excused
- Unexcused
- Attendance Rate

---

## 7.11 Registration Page (Club Admin)
### Purpose
Manage programs, forms, and submissions.

### Tabs
- Programs
- Forms
- Submissions
- Settings

### Programs Tab
Table columns:
- Program Name
- Season
- Opens
- Closes
- Status
- Submission Count
- Actions

### Forms Tab
- form versions
- preview
- duplicate
- archive version

### Submissions Tab
Filters:
- program
- status
- team
- player

Columns:
- Player
- Parent
- Program
- Status
- Submitted At
- Reviewed By
- Actions

### Actions
- Approve
- Waitlist
- Reject
- Open details drawer

---

## 7.12 Payments Page (Club Admin)
### Purpose
Manage invoices and payments.

### Tabs
- Invoices
- Payments
- Refunds
- Discounts
- Reports

### Invoices Tab Filters
- status
- due date range
- family account
- player
- search

### Invoices Table Columns
- Invoice Number
- Family / Parent
- Player
- Total
- Paid
- Due
- Due Date
- Status
- Actions

### Actions
- Create Invoice
- Record Offline Payment
- Send Reminder
- Void Invoice
- View Detail

### Invoice Detail Page / Drawer
Sections:
- summary totals
- line items
- payment history
- payment plan
- related child / family
- activity log

---

## 7.13 Waivers Page (Club Admin)
### Purpose
Manage waiver templates and compliance.

### Tabs
- Waivers
- Versions
- Acceptances

### Waivers Table Columns
- Name
- Type
- Active Version
- Status
- Acceptances Count
- Actions

### Acceptances View Filters
- waiver
- team
- player
- accepted status

### Columns
- Player
- Parent
- Waiver
- Version
- Accepted At
- Status

---

## 7.14 Announcements Page (Club Admin)
### Purpose
Create and manage club communications.

### Layout
- create announcement button
- announcement list/table
- filters by audience/team/status/date

### Table Columns
- Title
- Audience
- Team
- Status
- Published At
- Created By
- Actions

### Create/Edit Announcement Page or Drawer
Fields:
- title
- message body (rich text optional)
- audience type
- target team (if team-specific)
- publish now / save draft
- send notification toggle
- AI draft button

---

## 7.15 Evaluations Page (Club Admin)
### Purpose
Manage templates, cycles, and club-level evaluation reporting.

### Tabs
- Templates
- Criteria
- Position Weights
- Cycles
- Reports

### Position Weights Tab
Table format by position:
- Position
- Work Rate
- Passing
- Dribbling
- Physicality
- Aggression
- Pace
- Tactical Awareness
- Total
- Actions

### Validation
- total must equal 100
- inline warning if not equal 100

### Reports Tab
- team averages
- position summaries
- bucket distribution
- evaluation completion rate

---

## 7.16 Reports Page (Club Admin)
### Tabs
- Attendance
- Billing
- Registration
- Evaluations
- Activity

Each tab should support export (future or initial CSV).

---

## 7.17 AI Assistant Page (Club Admin)
### Purpose
Provide AI-assisted admin tools.

### Sections
- Draft Announcement
- Payment Reminder Campaign
- Registration FAQ Helper
- Attendance Summary
- Club Activity Summary

### Interaction Pattern
- prompt input
- configuration options (tone, audience, filters)
- generated draft panel
- edit before publish/send

---

## 7.18 Settings Page (Club Admin)
### Tabs
- Club Profile
- Communication Settings
- Parent Visibility
- AI Settings
- Notification Defaults
- Billing Settings
- Evaluation Settings

### Key Controls
- enable parent-to-parent chat
- enable parent evaluation view
- show photos to parents
- enable AI features
- default notification toggles
- default currency

---

## 8. Coach Pages

## 8.1 Coach Dashboard
### Purpose
Help coach run team day-to-day.

### Summary Cards
- roster size
- next event
- pending RSVPs
- attendance alert
- unread messages
- open evaluations

### Panels
- upcoming events
- RSVP snapshot
- attendance trend
- recent announcements
- development goals due

### Quick Actions
- Mark Attendance
- Send Message
- Create Event
- Start Evaluation
- Open Radar Comparison
- Ask AI Assistant

---

## 8.2 Team Roster Page (Coach)
### Purpose
Primary operational page for team player management.

### Layout
- search bar
- filters: status, position, jersey number
- roster table/grid
- actions bar

### Columns
- Photo
- Player Name
- Preferred Name
- Jersey Number
- Position
- Status
- Parent Count
- Last Attendance / optional
- Actions

### Actions
- Add Player
- Edit Player
- Link Parent
- Open Profile Drawer
- Export Roster (future)

### Player Row Click Behavior
Open side drawer with:
- player profile summary
- quick edit fields
- emergency contact (coach only)
- attendance summary
- last evaluation summary

---

## 8.3 Schedule Page (Coach)
### Purpose
Manage team events only.

### View Modes
- calendar
- agenda
- list

### Actions
- Create Event
- Edit Event
- Cancel Event
- Open Event Attendance
- Open RSVP Summary
- Send Event Reminder

### Event Card Quick Actions
- Mark attendance
- View RSVP counts
- Copy event

---

## 8.4 Event Detail Page (Coach)
### Sections
- event summary
- roster RSVP table
- attendance entry panel
- attachments
- discussion / related messages

### RSVP Table Columns
- Player Name
- Response Status
- Response Time
- Comment

### Attendance Entry Panel
Fast-select statuses:
- Present
- Late
- Excused
- Unexcused
- Injured
- Partial

Optimized for quick use from tablet/mobile on the field.

---

## 8.5 Attendance Page (Coach)
### Purpose
Quick team attendance management and trend review.

### Tabs
- Today / Recent
- By Event
- By Player

### By Player Table Columns
- Player Name
- Present
- Late
- Absent
- Attendance Rate
- Actions

---

## 8.6 Chat Page (Coach)
### Layout
- conversation list (if multiple chats)
- selected thread panel
- compose area
- attachments button

### Thread Types
- Team Chat
- Announcement Replies (if enabled)
- Direct Parent Messages (future/optional)

### Message Composer
- text input
- attach file/image
- send button
- AI draft assist (optional later)

---

## 8.7 Announcements Page (Coach)
### Purpose
Create team announcements only.

### Table Columns
- Title
- Team
- Status
- Published At
- Actions

### Create Announcement Form
- title
- body
- publish now / draft
- notify parents toggle
- AI draft button

---

## 8.8 Player Evaluations Page (Coach)
### Purpose
Manage evaluations for assigned teams.

### Filters
- evaluation cycle
- position
- bucket
- search player

### Table Columns
- Player Name
- Position
- Overall Score
- Rank
- Bucket
- Last Updated
- Actions

### Actions
- Create Evaluation
- Edit Evaluation
- View Detail
- Open Development Goals

### Evaluation Form Layout
- player header
- position selector
- criteria scoring grid
- calculated weighted total panel
- summary comment
- coach-only notes
- parent-visible notes
- save draft / submit

### Scoring Grid
Rows:
- Work Rate
- Passing
- Dribbling
- Physicality
- Aggression
- Pace
- Tactical Awareness

Columns:
- raw score input
- weight display
- weighted result

---

## 8.9 Radar Comparison Page (Coach)
### Purpose
Compare 2–3 players visually using radar chart.

### Layout
Top section:
- player selector 1
- player selector 2
- player selector 3 (optional)
- evaluation cycle filter
- scope filter (team / position)

Main section:
- large radar chart overlay
- legend with selected players
- criteria table below chart

Secondary widgets:
- score summary cards per selected player
- overall score comparison
- bucket labels
- trend sparkline (future)

### Actions
- clear selection
- export image/PDF (future)
- open player detail

---

## 8.10 Development Tracking Page (Coach)
### Purpose
Track goals and progress for player development.

### Filters
- player
- goal category
- visibility
- status

### Table Columns
- Player
- Goal Title
- Category
- Status
- Visibility
- Target Date
- Last Update
- Actions

### Actions
- Create Goal
- Add Update
- Mark Complete
- View Timeline

### Goal Detail Drawer
- goal summary
- progress timeline
- related evaluation insights
- parent-visible note preview

---

## 8.11 Documents Page (Coach)
### Purpose
Team document hub.

### Tabs
- Team Docs
- Event Attachments
- Shared Forms

### Columns
- File Name
- Purpose
- Uploaded By
- Uploaded At
- Actions

---

## 8.12 AI Assistant Page (Coach)
### Sections
- Draft Training Plan
- Draft Team Announcement
- Draft Match / Practice Recap
- Player Summary Generator
- Attendance / Availability Summary
- Lineup Suggestion (future)

### Interaction Pattern
- select team or event context
- input focus prompt
- generate result
- edit draft
- copy or publish where relevant

---

## 9. Parent Pages

## 9.1 My Kids Dashboard
### Purpose
Central parent landing page.

### Top Area
- child switcher
- summary cards:
  - upcoming events
  - unread messages
  - open invoices
  - pending waivers

### Main Sections
- child cards with team badges
- upcoming events timeline
- latest announcements
- invoice reminders
- waiver reminders
- development summary (if enabled)

### Quick Actions
- RSVP
- Open Team Roster
- Message Team
- Pay Invoice
- Sign Waiver
- Update Child Profile

---

## 9.2 Child Profile Page (Parent)
### Purpose
Update own child’s allowed information.

### Sections
- basic info
- jersey size
- photo upload
- emergency contact
- medical/allergy notes (if enabled)
- linked teams read-only

### Actions
- Save Changes

### Important
Only parent-approved editable fields should appear.

---

## 9.3 Schedule Page (Parent)
### Purpose
View all child events and RSVP.

### View Modes
- agenda
- month
- list by child

### Filters
- child
- team
- event type
- date range

### Event Card Fields
- child name
- team name
- event title
- date/time
- location
- RSVP status badge

### Event Detail Actions
- RSVP for this child
- add calendar (future)
- open map
- message coach/team

---

## 9.4 RSVP Interaction (Parent)
### On event detail or inline card
Show buttons:
- Going
- Not Going
- Maybe
- Late

Optional comment box.

After submit:
- show confirmation state
- allow update before deadline if rules allow

---

## 9.5 Team Roster Page (Parent)
### Purpose
View roster safely.

### Layout
- team selector / child context
- roster list or cards
- search by name or jersey number

### Visible Fields for Other Players
- name
- preferred name
- jersey number
- position
- optional photo

### Own Child Card Behavior
- show “Edit My Child” action
- open child profile form

### Restricted Fields
Never show:
- medical notes
- emergency contacts
- private evaluations
- parent contact info for others unless explicitly enabled

---

## 9.6 Chat Page (Parent)
### Layout
- team thread list if multiple teams
- selected conversation
- compose box

### Actions
- send message to team chat if enabled
- attach file/image if allowed

### Restrictions
- parent-to-parent direct messaging only if club setting allows

---

## 9.7 Announcements Page (Parent)
### Purpose
View all relevant announcements across linked children.

### Filters
- child
- team
- unread/read
- date range

### List Items
- title
- source team/club
- published date
- preview text

---

## 9.8 Registration Page (Parent)
### Purpose
Complete registration for linked children.

### Tabs
- Available Programs
- In Progress
- Submitted

### Program Card Fields
- program name
- season
- open/close dates
- status
- CTA: Start / Continue / View Submission

### Submission Form UX
- progress stepper
- dynamic fields
- save draft
- next / previous
- submit

### Review Screen
- answers summary
- missing required fields alert
- waiver/payment dependencies shown clearly

---

## 9.9 Payments Page (Parent)
### Purpose
Manage family invoices and payment history.

### Tabs
- Open Invoices
- Payment History
- Payment Plans

### Open Invoices Table / Cards
- Invoice Number
- Child
- Total
- Paid
- Due
- Due Date
- Status
- Action: Pay Now

### Invoice Detail
- line items
- payment history
- remaining balance
- pay now button
- download receipt (future)

---

## 9.10 Waivers Page (Parent)
### Purpose
Review and sign waivers.

### Tabs
- Pending
- Completed

### Waiver Card Fields
- waiver name
- child
- version
- status
- action: Review & Sign

### Waiver Detail Modal/Page
- full waiver content
- acknowledge checkbox
- sign/accept button
- timestamp after completion

---

## 9.11 Development Page (Parent)
### Purpose
View own child’s development summary if club enables it.

### Sections
- latest overall summary
- strengths
- focus areas
- parent-visible goals
- progress timeline

### Restrictions
- no comparison to other children by default
- no teamwide ranking visibility by default

---

## 9.12 Documents Page (Parent)
### Purpose
View relevant team/club documents.

### Categories
- Team Docs
- Registration Docs
- Waiver Copies
- Shared Files

---

## 10. Shared Detail Components

## 10.1 Confirmation Modal
Use for:
- archive player
- remove parent link
- cancel event
- delete draft
- void invoice

Standard structure:
- title
- short warning text
- primary confirm button
- cancel button

---

## 10.2 Empty State Pattern
Every list page should have a friendly empty state with:
- title
- explanation text
- primary CTA

Examples:
- No teams yet -> Create Team
- No invoices -> Create Invoice
- No evaluations -> Start Evaluation Cycle
- No upcoming events -> Create Event

---

## 10.3 Filter Bar Pattern
Each major list page should have a consistent filter bar:
- search input on left
- filters as dropdown chips/selects
- clear filters action
- right-aligned primary CTA

---

## 11. Mobile UX Guidance

## 11.1 Mobile Navigation
Recommended:
- bottom nav for parent and coach primary actions
- drawer for secondary items

### Parent Bottom Nav
- My Kids
- Schedule
- Chat
- Payments
- More

### Coach Bottom Nav
- Dashboard
- Roster
- Schedule
- Attendance
- More

---

## 11.2 Mobile Priorities
Critical mobile actions must be optimized for one-hand or quick use:
- RSVP
- attendance marking
- roster lookup
- chat
- payment
- waiver signing
- event detail viewing
- evaluation note entry

---

## 11.3 Mobile Forms
- use single-column layout
- sticky bottom action bar for save/submit
- expand/collapse sections for long forms
- avoid excessive modal nesting

---

## 11.4 Mobile Charts
For radar and reporting charts:
- provide simplified view on small screens
- include numeric table below chart
- allow horizontal scroll only if unavoidable

---

## 12. Accessibility and Usability Notes
- keyboard-accessible forms and tables
- visible focus states
- sufficient color contrast
- icons paired with text labels for key actions
- avoid relying only on color for status
- use clear labels instead of jargon where parent-facing
- keep destructive actions distinct and confirmed

---

## 13. Recommended Interaction Rules
1. Save drafts where possible for long forms.
2. Prefer drawers for quick edits; use full pages for complex workflows.
3. Show toast/snackbar confirmation after save, send, RSVP, or payment initiation.
4. Use optimistic updates carefully for chat and RSVP.
5. Always display role-safe data only.
6. Show inline validation for scoring totals and weight totals.
7. Keep primary action visible at all times on important pages.

---

## 14. Suggested Page Implementation Order
1. Auth pages
2. Shared app shell and role-aware navigation
3. Club Admin dashboard
4. Teams / Players / Parents / Coaches pages
5. Coach dashboard and roster
6. Parent dashboard and schedule
7. Announcements and chat
8. Events / RSVP / attendance
9. Registration / payments / waivers
10. Evaluations / radar / development tracking
11. Reports and AI assistant pages
12. Settings and admin refinement

---

## 15. Final Recommendation
Implement the UI as a role-aware, modular dashboard experience with a consistent app shell, safe data projections, and reusable interaction patterns.

The most important UX priorities are:
- parent child-switching simplicity
- coach roster and attendance speed
- club admin operational visibility
- privacy-safe roster behavior
- clear evaluation and radar workflows
- clean billing and waiver completion experience

This page specification is detailed enough for Claude Code to generate routes, page components, layouts, tables, forms, drawers, and role-based views with strong alignment to the product, schema, and API specs.
