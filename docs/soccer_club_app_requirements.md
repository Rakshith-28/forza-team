# Soccer Club Management App - Product Requirements (MVP + Extensible Roadmap)

## 1. Product Overview
Build a multi-tenant soccer club management application similar in spirit to TeamSnap, designed for soccer clubs to manage clubs, teams, players, coaches, parents, rosters, communication, and day-to-day team operations.

The platform must support:
- **One Master Admin** for the entire system (all clubs)
- **One or more Club Admins** per soccer club
- **Coaches** who manage specific teams within a club
- **Parents/Guardians** who can access one or more children across one or more teams with a single login

The application should be built as a **multi-tenant SaaS platform**, where each club has isolated data and administration, while the Master Admin can manage the full ecosystem.

---

## 2. Primary Goals
1. Enable soccer clubs to manage rosters, teams, players, parents, and coaches in one place.
2. Provide role-based access control with clear ownership boundaries.
3. Allow parents to use one login to access all of their children and all corresponding teams.
4. Support secure team communication between coaches and parents.
5. Start with a strong MVP and leave room for future expansion (payments, scheduling, registration, attendance, etc.).

---

## 3. Recommended Product Scope

### MVP Scope
- Authentication and login
- Multi-club support
- Role-based access control
- Club and team management
- Roster management
- Parent-child linkage
- Team chat / announcements
- Basic player profile management
- Basic document and media attachment support

### Future Scope
- Schedule and calendar
- RSVP for games/practices
- Attendance tracking
- Payments and fees
- Registration and waivers
- Tryouts and evaluations
- Player availability
- Push notifications
- Mobile apps

---

## 4. User Roles and Access Model

## 4.1 Master Admin
**System-wide super admin**.

### Permissions
- Create, update, suspend, or delete clubs
- Create initial club admin accounts
- View all clubs, teams, rosters, users, and system metrics
- Manage feature flags and subscription plans
- Impersonate club admin for support (with audit logging)
- Configure global settings
- View system-wide audit logs
- Manage templates for notifications, email, and announcements
- Resolve data issues across all tenants

### Restrictions
- None functionally, but all actions must be audited.

---

## 4.2 Club Admin
**Admin for a single club**.

### Permissions
- Manage the club profile
- Create/manage teams under the club
- Assign coaches to teams
- Create/manage players, parent accounts, and staff accounts for the club
- Move players between teams in the same club
- View and manage all rosters inside the club
- Send club-wide or team-level announcements
- Access reports for their club
- Configure season, age groups, divisions, and team metadata

### Restrictions
- Cannot access other clubs
- Cannot change master/system-wide configuration

---

## 4.3 Coach
**Admin for a specific team or teams inside a club**.

### Permissions
- View and manage assigned team roster
- Edit player profile information for players on assigned teams
- Add team notes, jersey numbers, positions, availability status, and internal coach-only notes
- Send messages/announcements to parents and players (if player login is introduced later)
- Upload team documents, schedule items, and media
- Track attendance (future)
- Record game stats (future)

### Restrictions
- Cannot manage clubs outside assigned club
- Cannot view teams not assigned unless explicitly granted read-only permissions
- Cannot change billing/subscription/tenant-level settings

---

## 4.4 Parent / Guardian
**Parent account linked to one or more children**.

### Permissions
- One login gives access to all linked children
- View all teams associated with linked children
- View roster for those teams
- Update only their own child’s permitted profile fields
- Participate in team chat / direct communication where allowed
- View team announcements, documents, schedules, and attendance history (future)
- Set child availability for practice/games (future)

### Restrictions (Recommended)
- Parent should **not** be able to edit other players’ full profiles
- Parent should only see **limited roster fields** for other players
- Parent should never see sensitive data such as:
  - medical notes
  - full emergency contact details for other players
  - billing/financial info
  - internal coach notes
  - legal/waiver data

---

## 5. Recommended Access Design (Important Suggestion)
This is the recommended access model for the **Roster Page** and related profile views.

### Coach Access to Roster
Coaches can:
- View all players on the team
- Create/update player records for their assigned teams
- Manage jersey number, position, attendance, notes, parent linkage, and emergency contact fields
- Upload profile photos and documents where permitted

### Parent Access to Roster
Parents can:
- View all roster members in the team
- Edit only their own child’s editable fields
- Message coach/team per chat policy
- View only **safe roster information** for other players

### Recommended Parent View of Other Kids
For privacy and safety, parents should only see these fields for **other players**:
- Player name
- Preferred name (optional)
- Jersey number
- Position
- Team name
- Age group
- Optional player photo (if enabled)

### Recommended Hidden Fields from Parents for Other Kids
- Date of birth
- Address
- School info
- Emergency contacts
- Medical details
- Insurance details
- Internal coach evaluation notes
- Parent/guardian personal contact info unless explicitly shared

### Recommended Editable Fields for Parent on Own Child
- Preferred name
- Photo
- Jersey size
- Primary phone (if appropriate)
- Parent contact details
- Emergency contact
- Medical notes / allergy notes (if enabled)
- Availability status
- Consent/waiver acknowledgements

This access model improves privacy, avoids accidental modification of other children’s data, and matches real club governance expectations.

---

## 6. Core Functional Modules

## 6.1 Authentication & User Management
### Requirements
- Secure login via email + password
- Password reset flow
- Optional magic link login (future)
- Optional MFA for Master Admin and Club Admin
- Support for multiple roles per user if needed in future
- Single user account may be linked to multiple children
- Single coach account may be assigned to multiple teams
- Session timeout and token refresh handling

### Recommended Rules
- Email must be unique across the platform
- Parent account can belong to only one club by default in MVP, but design schema to support multiple clubs later
- Audit log required for sensitive updates

---

## 6.2 Club Management
### Club Fields
- Club ID
- Club Name
- Short Code
- Logo
- Club Colors
- Address
- City
- State
- Zip Code
- Phone
- Website
- Status (Active, Suspended, Archived)
- Season Settings
- Default Privacy Settings
- Created By / Created At / Updated At

### Capabilities
- Create club
- Edit club
- Archive club
- Manage teams under club
- Manage club staff

---

## 6.3 Team Management
### Team Fields
- Team ID
- Club ID
- Team Name
- Team Code
- Age Group
- Gender/Division label (store as neutral team descriptor if needed)
- Season
- Competitive Level
- Primary Coach
- Assistant Coaches
- Team Status
- Created At / Updated At

### Capabilities
- Create/edit/archive teams
- Assign coaches
- Add/remove players
- Link parents to players
- Team-level announcements and chat channels

---

## 6.4 Player Management
### Player Fields
- Player ID
- Club ID
- Team ID (support many-to-many later if player can be in multiple teams)
- First Name
- Last Name
- Preferred Name
- Date of Birth
- Jersey Number
- Primary Position
- Secondary Position
- Photo URL
- Medical Notes (restricted)
- Allergy Notes (restricted)
- Emergency Contact Name (restricted)
- Emergency Contact Phone (restricted)
- Status (Active, Injured, Inactive, Archived)
- Created At / Updated At

### Editable By
- Coach: yes for assigned teams
- Club Admin: yes for club
- Parent: only approved fields for own child
- Master Admin: yes

---

## 6.5 Parent/Guardian Management
### Parent Fields
- Parent ID
- User ID
- First Name
- Last Name
- Email
- Phone
- Secondary Phone
- Relationship to Child
- Preferred Contact Method
- Address (optional)
- Notification Preferences
- Created At / Updated At

### Child Linking
A parent can be linked to:
- one child on one team
- multiple children on same team
- multiple children across multiple teams

### Important Requirement
When a parent logs in, the UI should show:
- a list of all linked children
- a combined dashboard of all relevant team updates
- ability to switch between children quickly

---

## 6.6 Roster Page
This is one of the most important MVP pages.

### Purpose
Display all players associated with a team, along with relevant visible fields based on the user’s role.

### Common Roster Fields
- Player Photo
- Player Name
- Jersey Number
- Position
- Team Name
- Age Group
- Parent Contact Indicator (optional)
- Availability Status (future)

### Coach View
Coach can:
- Add player
- Edit all team player fields (except protected legal/system fields if desired)
- Link/unlink parents
- Add coach-only notes
- View emergency and medical info if permitted
- Filter/search roster
- Export roster CSV/PDF (future)

### Parent View
Parent can:
- View entire roster with limited player details
- Edit only their own child profile fields
- Tap into child detail page
- Contact coach/team per permissions
- Cannot edit another child

### Recommended UI Actions on Roster Page
- Search roster
- Filter by jersey number / position / status
- Click row to open player profile drawer/modal
- “Edit My Child” CTA for parent
- “Edit Player” CTA for coach
- “Message Team” CTA

---

## 6.7 Messaging / Chat
### MVP Messaging Scope
- Team chat channel for coach + parents
- Club announcements by club admin
- Direct message capability (optional MVP, recommended phase 2)

### Recommended Permissions
- Coach can message parents of assigned teams
- Parent can message coach(s)
- Parent-to-parent direct chat should be optional and controlled by club setting
- Club admin can send read-only announcements to whole club

### Recommended Chat Types
- Team Announcement Channel (coach/admin broadcast)
- Team Discussion Channel (optional)
- Direct Message Coach ↔ Parent (future or optional MVP)

### Moderation / Governance
- Message audit trail
- Report message function (future)
- Mute/disable chat per team or per club
- Attachments allowed with size/type restrictions

---

## 6.8 Notifications
### Channels
- In-app notifications
- Email notifications
- Push notifications (future mobile app)
- SMS (future / optional paid feature)

### Trigger Examples
- New announcement
- Team message
- Player added to team
- Parent linked to child
- Schedule change (future)
- RSVP reminder (future)

### User Preferences
Each user should be able to configure:
- email on/off
- push on/off
- digest vs immediate (future)

---

## 7. Data Model (Suggested Initial Entities)

## 7.1 Core Tables / Collections
- users
- clubs
- club_admins
- teams
- team_coaches
- players
- parents
- player_parent_links
- team_memberships
- chats
- chat_members
- messages
- announcements
- files
- audit_logs
- notification_preferences
- invitations

---

## 7.2 Suggested Entity Relationships
- One **club** has many **teams**
- One **club** has many **club admins**
- One **team** belongs to one **club**
- One **team** has many **coaches**
- One **team** has many **players**
- One **player** can have many **parents/guardians**
- One **parent** can have many **players/children**
- One **user** maps to one auth identity but may hold one or more business relationships

---

## 8. Permissions Matrix (High-Level)

## 8.1 Master Admin
- View/edit all clubs
- View/edit all teams
- View/edit all players
- View/edit all users
- View all chats and logs if policy allows

## 8.2 Club Admin
- View/edit all club teams and users within own club
- Create teams
- Assign coaches
- Manage roster across club
- Send club announcements

## 8.3 Coach
- View assigned teams
- Edit roster for assigned teams
- Message assigned teams
- View parent contact info for assigned teams as allowed

## 8.4 Parent
- View linked child(ren)
- View roster for linked teams with limited details
- Edit own child permitted fields only
- Participate in approved chat channels

---

## 9. Suggested Screens / Pages

## 9.1 Public / Auth Pages
- Login
- Forgot Password
- Reset Password
- Invite Acceptance

## 9.2 Master Admin Pages
- Dashboard
- Clubs Management
- Users Management
- System Settings
- Audit Logs
- Support / Impersonation

## 9.3 Club Admin Pages
- Club Dashboard
- Teams
- Coaches
- Players
- Parents
- Announcements
- Chat Moderation
- Club Settings

## 9.4 Coach Pages
- Team Dashboard
- Roster
- Team Chat
- Announcements
- Documents
- Schedule (future)
- Attendance (future)

## 9.5 Parent Pages
- My Kids Dashboard
- Team Roster
- Team Chat
- Announcements
- Child Profile
- Documents
- Availability (future)

---

## 10. Recommended Parent Dashboard UX
Because one parent can access multiple children and multiple teams, the parent dashboard should include:
- child switcher at top
- card for each child
- upcoming events by child/team (future)
- recent messages by team
- latest club/team announcements
- quick actions:
  - view roster
  - message coach
  - update child profile
  - submit availability (future)

---

## 11. Suggested API Design (High-Level)

## 11.1 Auth
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## 11.2 Clubs
- `GET /api/clubs`
- `POST /api/clubs`
- `GET /api/clubs/{clubId}`
- `PUT /api/clubs/{clubId}`
- `PATCH /api/clubs/{clubId}/status`

## 11.3 Teams
- `GET /api/clubs/{clubId}/teams`
- `POST /api/clubs/{clubId}/teams`
- `GET /api/teams/{teamId}`
- `PUT /api/teams/{teamId}`
- `POST /api/teams/{teamId}/coaches`
- `POST /api/teams/{teamId}/players`

## 11.4 Players
- `GET /api/teams/{teamId}/players`
- `GET /api/players/{playerId}`
- `PUT /api/players/{playerId}`
- `POST /api/players/{playerId}/parents`
- `DELETE /api/players/{playerId}/parents/{parentId}`

## 11.5 Parents
- `GET /api/parents/me/children`
- `GET /api/parents/me/teams`
- `PUT /api/parents/me/children/{playerId}`

## 11.6 Messaging
- `GET /api/teams/{teamId}/messages`
- `POST /api/teams/{teamId}/messages`
- `GET /api/announcements`
- `POST /api/announcements`

---

## 12. Business Rules
1. Every user belongs to exactly one primary role in MVP.
2. Master Admin can access all data.
3. Club Admin can only access users/data for their club.
4. Coach can only access assigned teams.
5. Parent can only edit linked children.
6. Parent can view roster but only limited fields for other children.
7. All sensitive changes must be logged.
8. Deletion should be soft-delete where possible.
9. Invitations should expire.
10. Chat access must follow team membership.

---

## 13. Security and Compliance Requirements
- Strong password hashing
- JWT or secure session auth
- Tenant isolation at query/service layer
- Authorization middleware on every API
- Audit logs for admin actions
- File upload validation
- PII minimization for parent-visible data
- Rate limiting for auth and messaging APIs
- Encryption in transit and at rest where supported

---

## 14. Audit Logging
Log these actions at minimum:
- login success/failure
- club creation/update/archive
- team creation/update/archive
- coach assignment/removal
- player creation/update/archive
- parent-child linkage updates
- role assignment changes
- message deletion/moderation actions
- impersonation by Master Admin

---

## 15. Non-Functional Requirements
- Responsive web app first
- Mobile-friendly UI
- Scalable for multiple clubs and hundreds/thousands of users
- Fast roster search/filtering
- Real-time or near-real-time messaging
- Clear error handling and validation
- Accessible UI (WCAG-minded)
- Clean auditability

---

## 16. Suggested Technical Architecture
### Frontend
- React / Next.js
- Role-based route protection
- Component library for dashboards, forms, roster tables, modals, chat

### Backend
- Node.js / NestJS or Express
- REST API (GraphQL optional later)
- WebSocket / realtime service for chat

### Database
- PostgreSQL recommended
- Multi-tenant design using club_id scoping for most business tables

### Storage
- Cloud object storage for player photos, files, documents

### Auth
- Email/password auth initially
- Optional SSO later

---

## 17. Suggested MVP Delivery Order
### Phase 1 - Foundation
- Auth
- User roles
- Club/team/player/parent data model
- Basic dashboards

### Phase 2 - Roster & Profile Management
- Roster page
- Parent-child linking
- Edit permissions
- Role-based player profile views

### Phase 3 - Communication
- Team chat
- Announcements
- Notification preferences

### Phase 4 - Admin & Hardening
- Audit logs
- Invitations
- Search/filter improvements
- File uploads

### Phase 5 - Future Enhancements
- Schedule
- RSVP
- Attendance
- Payments
- Registration
- Mobile app

---

## 18. Suggested Acceptance Criteria for MVP

### Authentication
- Users can log in securely
- Users are redirected to role-appropriate dashboard

### Role Access
- Master Admin can manage all clubs
- Club Admin can only manage own club
- Coach can only manage own team(s)
- Parent can only edit linked child fields

### Roster Page
- Coach can view/edit all players in assigned team
- Parent can view full roster with restricted fields
- Parent can edit only linked child profile
- Search and filter work correctly

### Parent Multi-Child Access
- One parent login can access all linked children
- Parent dashboard clearly separates child/team context

### Messaging
- Coach and parents in a team can exchange messages per policy
- Announcements are visible to correct audience

---

## 19. Suggested Enhancements Beyond User Request
These are strongly recommended because they will make the product significantly better than a basic TeamSnap clone.

1. **Invitations workflow**
   - Invite coach/parent by email
   - Accept invite and complete profile

2. **Role-based field visibility**
   - Same player record but different field visibility by role

3. **Child-safe privacy controls**
   - Club-level setting to decide what parent can see for other roster members

4. **Announcement vs Chat separation**
   - Keep announcements clean and official
   - Use chat for discussion

5. **Team documents**
   - Upload practice plans, waivers, tournament docs, club handbooks

6. **Activity feed**
   - Show latest roster updates, announcements, and messages

7. **Soft delete + archive**
   - Avoid losing historical records

---

## 20. Open Questions for Future Clarification
1. Should players have their own login in future?
2. Should club admins be able to see all chats in their club?
3. Should parent-to-parent direct messaging be enabled or disabled by default?
4. Should one user be able to be both coach and parent under the same login?
5. Will payments and registration be part of phase 1 or later?
6. Should a player be allowed on multiple teams in the same season?
7. Should there be a public club website component later?

---

## 21. Final Recommendation
For MVP, keep the access model simple and safe:
- **Master Admin** = entire system
- **Club Admin** = entire club
- **Coach** = assigned team(s)
- **Parent** = linked child(ren) + limited roster visibility + team chat access

For the **Roster Page**, the best design is:
- Coaches can edit all players on their team
- Parents can update only their own child
- Parents can view other players with privacy-safe limited fields only

This is the recommended baseline architecture and product design for building a soccer club management app that is practical, secure, and scalable.
