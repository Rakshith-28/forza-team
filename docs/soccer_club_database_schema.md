# Soccer Club Management App - Database Schema Specification

## 1. Document Purpose
This document defines the proposed database schema for the Soccer Club Management App. It is intended to be implementation-ready guidance for backend/database development and should be used together with the product requirements and technical architecture documents.

The schema supports:
- multi-tenant club isolation
- RBAC and scoped access
- roster management
- scheduling, RSVP, and attendance
- announcements and chat
- registration, payments, and waivers
- player evaluations, position weights, radar comparison, and development tracking
- notifications, files, invitations, and audit logs

---

## 2. Database Platform Recommendation
- **Database Engine**: PostgreSQL 15+
- **Primary Key Strategy**: UUID
- **Timestamps**: `TIMESTAMPTZ`
- **Soft Delete Strategy**: `deleted_at`, `deleted_by` where applicable
- **Tenant Scoping**: `club_id` on tenant-bound tables
- **Naming Convention**: `snake_case`
- **Constraint Naming**: explicit names recommended

---

## 3. Core Design Rules
1. Every tenant-bound business table must include `club_id`.
2. All user-facing entities should support audit fields.
3. Parent visibility to other children must be enforced in application/query layer using safe projections.
4. Use join tables instead of comma-separated relationships.
5. Preserve history for evaluations, payments, waivers, attendance, and registrations.
6. Avoid hard delete except for low-risk ephemeral records when appropriate.

---

## 4. Common Columns Standard
Add these columns to most major business tables unless there is a specific reason not to:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
created_by UUID NULL,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_by UUID NULL,
deleted_at TIMESTAMPTZ NULL,
deleted_by UUID NULL
```

For lifecycle-controlled tables, also include:

```sql
status VARCHAR(50) NOT NULL
```

---

## 5. Enumerations (Recommended)
Use PostgreSQL enums or controlled string values enforced by application + DB check constraints.

### 5.1 Role Codes
```sql
MASTER_ADMIN
CLUB_ADMIN
COACH
PARENT
```

### 5.2 Team Coach Role Types
```sql
HEAD_COACH
ASSISTANT_COACH
TEAM_MANAGER
```

### 5.3 Team Status
```sql
ACTIVE
INACTIVE
ARCHIVED
```

### 5.4 Player Status
```sql
ACTIVE
INJURED
INACTIVE
ARCHIVED
```

### 5.5 Event Types
```sql
PRACTICE
GAME
TOURNAMENT
MEETING
TEAM_EVENT
CLUB_EVENT
```

### 5.6 Event Status
```sql
SCHEDULED
CANCELLED
COMPLETED
POSTPONED
```

### 5.7 RSVP Status
```sql
GOING
NOT_GOING
MAYBE
LATE
```

### 5.8 Attendance Status
```sql
PRESENT
EXCUSED_ABSENT
UNEXCUSED_ABSENT
LATE
INJURED
PARTIAL
```

### 5.9 Registration Submission Status
```sql
DRAFT
SUBMITTED
APPROVED
WAITLISTED
REJECTED
CANCELLED
```

### 5.10 Invoice Status
```sql
DRAFT
OPEN
PARTIALLY_PAID
PAID
OVERDUE
VOID
REFUNDED
```

### 5.11 Payment Status
```sql
PENDING
SUCCEEDED
FAILED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

### 5.12 Waiver Type
```sql
LIABILITY
MEDICAL
MEDIA
TRAVEL
CODE_OF_CONDUCT
CUSTOM
```

### 5.13 Evaluation Cycle Type
```sql
TRYOUT
PRESEASON
MIDSEASON
POSTSEASON
CUSTOM
```

### 5.14 Development Goal Visibility
```sql
COACH_ONLY
PARENT_VISIBLE
```

### 5.15 Announcement Audience Type
```sql
CLUB_ALL
TEAM_ONLY
COACHES_ONLY
PARENTS_ONLY
CUSTOM_SELECTION
```

### 5.16 Chat Type
```sql
TEAM
DIRECT
ANNOUNCEMENT_THREAD
```

### 5.17 Position Codes
```sql
GK
CB
FB
DM
CM
AM
WINGER
ST
UTILITY
```

---

## 6. Schema Overview by Domain

### Identity / Access
- users
- roles
- user_role_assignments
- invitations
- password_reset_tokens
- user_sessions (optional)

### Tenant / Club Operations
- clubs
- club_settings
- seasons
- teams
- team_coaches

### Player / Parent / Roster
- players
- player_team_memberships
- parents
- player_parent_links

### Communications
- announcements
- chats
- chat_members
- messages
- message_attachments

### Files
- files

### Schedule / RSVP / Attendance
- events
- event_attachments
- event_rsvps
- attendance_records
- reminder_jobs (optional, can stay in queue metadata instead)

### Registration / Billing / Waivers
- registration_programs
- registration_forms
- registration_submissions
- registration_answers
- family_accounts
- invoices
- invoice_items
- payments
- payment_plans
- payment_plan_installments
- discounts
- waivers
- waiver_versions
- waiver_acceptances
- refunds

### Evaluation / Development
- evaluation_templates
- evaluation_criteria
- position_weight_profiles
- position_weight_profile_items
- evaluation_cycles
- player_evaluations
- player_evaluation_scores
- development_goals
- development_goal_updates

### Platform / Notifications / Audit
- notifications
- notification_preferences
- audit_logs
- system_settings
- platform_announcements
- platform_announcement_clubs
- platform_announcement_reads
- platform_announcement_templates

---

## 7. Table Definitions

## 7.1 `users`
Authentication identity table.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_users_status ON users(status);
```

---

## 7.2 `roles`
Reference table for system roles.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT
);
```

Seed values:
- MASTER_ADMIN
- CLUB_ADMIN
- COACH
- PARENT

---

## 7.3 `user_role_assignments`
Scope-aware role assignment table.

```sql
CREATE TABLE user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  club_id UUID NULL REFERENCES clubs(id),
  team_id UUID NULL REFERENCES teams(id),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id)
);
```

### Rules
- `MASTER_ADMIN` may have `club_id` and `team_id` null.
- `CLUB_ADMIN` must have `club_id` and `team_id` null.
- `COACH` must have `club_id` and usually `team_id` populated.
- `PARENT` must have `club_id`; `team_id` can remain null.

### Indexes
```sql
CREATE INDEX idx_user_role_assignments_user_id ON user_role_assignments(user_id);
CREATE INDEX idx_user_role_assignments_club_id ON user_role_assignments(club_id);
CREATE INDEX idx_user_role_assignments_team_id ON user_role_assignments(team_id);
CREATE INDEX idx_user_role_assignments_role_id ON user_role_assignments(role_id);
```

---

## 7.4 `invitations`
Used for inviting coaches, parents, and club managers.

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NULL REFERENCES clubs(id),
  email CITEXT NOT NULL,
  role_code VARCHAR(50) NOT NULL,
  team_id UUID NULL REFERENCES teams(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id)
);
```

### Indexes
```sql
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_club_id ON invitations(club_id);
CREATE INDEX idx_invitations_status ON invitations(status);
```

---

## 7.5 `password_reset_tokens`

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7.6 `clubs`
Tenant root table.

```sql
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  short_code VARCHAR(50) NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color VARCHAR(20),
  secondary_color VARCHAR(20),
  address_line1 VARCHAR(200),
  address_line2 VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  phone VARCHAR(30),
  website TEXT,
  timezone VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id)
);
```

### Indexes
```sql
CREATE INDEX idx_clubs_status ON clubs(status);
CREATE INDEX idx_clubs_name ON clubs(name);
```

---

## 7.7 `club_settings`
Normalized club settings instead of one large JSON blob.

```sql
CREATE TABLE club_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL UNIQUE REFERENCES clubs(id),
  allow_parent_to_parent_chat BOOLEAN NOT NULL DEFAULT FALSE,
  allow_parent_child_evaluation_view BOOLEAN NOT NULL DEFAULT FALSE,
  show_player_photos_to_parents BOOLEAN NOT NULL DEFAULT TRUE,
  enable_ai_features BOOLEAN NOT NULL DEFAULT TRUE,
  enable_sms_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  default_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  attendance_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  billing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7.8 `seasons`

```sql
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  name VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

### Constraints
```sql
ALTER TABLE seasons ADD CONSTRAINT chk_seasons_date_range CHECK (end_date >= start_date);
```

### Indexes
```sql
CREATE INDEX idx_seasons_club_id ON seasons(club_id);
CREATE INDEX idx_seasons_status ON seasons(status);
```

---

## 7.9 `teams`

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  season_id UUID NULL REFERENCES seasons(id),
  name VARCHAR(150) NOT NULL,
  team_code VARCHAR(50) NOT NULL,
  age_group VARCHAR(50),
  division VARCHAR(100),
  competitive_level VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  primary_coach_user_id UUID NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_teams_club_team_code UNIQUE (club_id, team_code)
);
```

### Indexes
```sql
CREATE INDEX idx_teams_club_id ON teams(club_id);
CREATE INDEX idx_teams_season_id ON teams(season_id);
CREATE INDEX idx_teams_status ON teams(status);
```

---

## 7.10 `team_coaches`

```sql
CREATE TABLE team_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  UNIQUE (team_id, user_id)
);
```

### Indexes
```sql
CREATE INDEX idx_team_coaches_club_id ON team_coaches(club_id);
CREATE INDEX idx_team_coaches_team_id ON team_coaches(team_id);
CREATE INDEX idx_team_coaches_user_id ON team_coaches(user_id);
```

---

## 7.11 `players`

```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  preferred_name VARCHAR(100),
  date_of_birth DATE,
  photo_url TEXT,
  jersey_number VARCHAR(20),
  primary_position VARCHAR(50),
  secondary_position VARCHAR(50),
  medical_notes TEXT,
  allergy_notes TEXT,
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(30),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id)
);
```

### Indexes
```sql
CREATE INDEX idx_players_club_id ON players(club_id);
CREATE INDEX idx_players_status ON players(status);
CREATE INDEX idx_players_name ON players(last_name, first_name);
CREATE INDEX idx_players_primary_position ON players(primary_position);
```

---

## 7.12 `player_team_memberships`
Allows one player to appear on multiple teams/seasons if needed.

```sql
CREATE TABLE player_team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  player_id UUID NOT NULL REFERENCES players(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  season_id UUID NULL REFERENCES seasons(id),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_player_team_memberships UNIQUE (player_id, team_id, season_id)
);
```

### Indexes
```sql
CREATE INDEX idx_player_team_memberships_club_id ON player_team_memberships(club_id);
CREATE INDEX idx_player_team_memberships_team_id ON player_team_memberships(team_id);
CREATE INDEX idx_player_team_memberships_player_id ON player_team_memberships(player_id);
```

---

## 7.13 `parents`
Business profile for parent/guardian.

```sql
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email CITEXT NOT NULL,
  phone VARCHAR(30),
  secondary_phone VARCHAR(30),
  preferred_contact_method VARCHAR(30),
  address_line1 VARCHAR(200),
  address_line2 VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_parents_club_user UNIQUE (club_id, user_id)
);
```

### Indexes
```sql
CREATE INDEX idx_parents_club_id ON parents(club_id);
CREATE INDEX idx_parents_user_id ON parents(user_id);
CREATE INDEX idx_parents_email ON parents(email);
```

---

## 7.14 `player_parent_links`
Many-to-many parent-child linkage.

```sql
CREATE TABLE player_parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  player_id UUID NOT NULL REFERENCES players(id),
  parent_id UUID NOT NULL REFERENCES parents(id),
  relationship_type VARCHAR(50) NOT NULL,
  is_primary_guardian BOOLEAN NOT NULL DEFAULT FALSE,
  can_pickup BOOLEAN NOT NULL DEFAULT FALSE,
  can_pay BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_player_parent_link UNIQUE (player_id, parent_id)
);
```

### Indexes
```sql
CREATE INDEX idx_player_parent_links_club_id ON player_parent_links(club_id);
CREATE INDEX idx_player_parent_links_player_id ON player_parent_links(player_id);
CREATE INDEX idx_player_parent_links_parent_id ON player_parent_links(parent_id);
```

---

## 7.15 `files`

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  owner_user_id UUID NULL REFERENCES users(id),
  storage_key TEXT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT NOT NULL,
  purpose VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_files_club_id ON files(club_id);
CREATE INDEX idx_files_purpose ON files(purpose);
```

---

## 7.16 `announcements`

```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  team_id UUID NULL REFERENCES teams(id),
  title VARCHAR(250) NOT NULL,
  body TEXT NOT NULL,
  audience_type VARCHAR(50) NOT NULL,
  published_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

### Indexes
```sql
CREATE INDEX idx_announcements_club_id ON announcements(club_id);
CREATE INDEX idx_announcements_team_id ON announcements(team_id);
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_published_at ON announcements(published_at DESC);
```

---

## 7.17 `chats`

```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  team_id UUID NULL REFERENCES teams(id),
  chat_type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id)
);
```

### Indexes
```sql
CREATE INDEX idx_chats_club_id ON chats(club_id);
CREATE INDEX idx_chats_team_id ON chats(team_id);
CREATE INDEX idx_chats_type ON chats(chat_type);
```

---

## 7.18 `chat_members`

```sql
CREATE TABLE chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  user_id UUID NOT NULL REFERENCES users(id),
  member_role VARCHAR(50),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  muted_until TIMESTAMPTZ NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (chat_id, user_id)
);
```

### Indexes
```sql
CREATE INDEX idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX idx_chat_members_user_id ON chat_members(user_id);
```

---

## 7.19 `messages`

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  sender_user_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
  reply_to_message_id UUID NULL REFERENCES messages(id),
  edited_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_messages_chat_id_created_at ON messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_sender_user_id ON messages(sender_user_id);
```

---

## 7.20 `message_attachments`

```sql
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id),
  file_id UUID NOT NULL REFERENCES files(id),
  UNIQUE (message_id, file_id)
);
```

---

## 7.21 `events`

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  team_id UUID NULL REFERENCES teams(id),
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(100) NOT NULL,
  location_name VARCHAR(200),
  address_line1 VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  opponent_name VARCHAR(200),
  home_away VARCHAR(20),
  arrival_time TIMESTAMPTZ NULL,
  uniform_notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

### Constraints
```sql
ALTER TABLE events ADD CONSTRAINT chk_events_time_range CHECK (end_at >= start_at);
```

### Indexes
```sql
CREATE INDEX idx_events_club_id ON events(club_id);
CREATE INDEX idx_events_team_id ON events(team_id);
CREATE INDEX idx_events_start_at ON events(start_at);
CREATE INDEX idx_events_status ON events(status);
```

---

## 7.22 `event_attachments`

```sql
CREATE TABLE event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  file_id UUID NOT NULL REFERENCES files(id),
  UNIQUE (event_id, file_id)
);
```

---

## 7.23 `event_rsvps`
One response per player per event.

```sql
CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  event_id UUID NOT NULL REFERENCES events(id),
  player_id UUID NOT NULL REFERENCES players(id),
  responded_by_user_id UUID NOT NULL REFERENCES users(id),
  response_status VARCHAR(50) NOT NULL,
  comment TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_rsvp UNIQUE (event_id, player_id)
);
```

### Indexes
```sql
CREATE INDEX idx_event_rsvps_club_id ON event_rsvps(club_id);
CREATE INDEX idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_player_id ON event_rsvps(player_id);
```

---

## 7.24 `attendance_records`
One attendance row per player per event.

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  event_id UUID NOT NULL REFERENCES events(id),
  player_id UUID NOT NULL REFERENCES players(id),
  recorded_by_user_id UUID NOT NULL REFERENCES users(id),
  attendance_status VARCHAR(50) NOT NULL,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_attendance_record UNIQUE (event_id, player_id)
);
```

### Indexes
```sql
CREATE INDEX idx_attendance_records_club_id ON attendance_records(club_id);
CREATE INDEX idx_attendance_records_event_id ON attendance_records(event_id);
CREATE INDEX idx_attendance_records_player_id ON attendance_records(player_id);
```

---

## 7.25 `registration_programs`

```sql
CREATE TABLE registration_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  season_id UUID NULL REFERENCES seasons(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

### Constraints
```sql
ALTER TABLE registration_programs ADD CONSTRAINT chk_registration_program_window CHECK (closes_at >= opens_at);
```

### Indexes
```sql
CREATE INDEX idx_registration_programs_club_id ON registration_programs(club_id);
CREATE INDEX idx_registration_programs_season_id ON registration_programs(season_id);
CREATE INDEX idx_registration_programs_status ON registration_programs(status);
```

---

## 7.26 `registration_forms`
Dynamic schema-driven forms.

```sql
CREATE TABLE registration_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  registration_program_id UUID NOT NULL REFERENCES registration_programs(id),
  name VARCHAR(200) NOT NULL,
  version INTEGER NOT NULL,
  schema_json JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_registration_forms_program_version UNIQUE (registration_program_id, version)
);
```

### Indexes
```sql
CREATE INDEX idx_registration_forms_club_id ON registration_forms(club_id);
CREATE INDEX idx_registration_forms_program_id ON registration_forms(registration_program_id);
```

---

## 7.27 `registration_submissions`

```sql
CREATE TABLE registration_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  registration_program_id UUID NOT NULL REFERENCES registration_programs(id),
  form_id UUID NOT NULL REFERENCES registration_forms(id),
  player_id UUID NOT NULL REFERENCES players(id),
  submitted_by_user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  submitted_at TIMESTAMPTZ NULL,
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_registration_submissions_club_id ON registration_submissions(club_id);
CREATE INDEX idx_registration_submissions_program_id ON registration_submissions(registration_program_id);
CREATE INDEX idx_registration_submissions_player_id ON registration_submissions(player_id);
CREATE INDEX idx_registration_submissions_status ON registration_submissions(status);
```

---

## 7.28 `registration_answers`
Store dynamic responses.

```sql
CREATE TABLE registration_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES registration_submissions(id) ON DELETE CASCADE,
  field_key VARCHAR(150) NOT NULL,
  field_value_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_registration_answers_submission_id ON registration_answers(submission_id);
CREATE INDEX idx_registration_answers_field_key ON registration_answers(field_key);
```

---

## 7.29 `family_accounts`
Optional aggregation layer for billing families.

```sql
CREATE TABLE family_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  account_name VARCHAR(200) NOT NULL,
  primary_parent_id UUID NULL REFERENCES parents(id),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

### Recommended linkage rule
Associate parent(s) and players to a family account in application logic or via optional extra link tables if needed later.

---

## 7.30 `discounts`

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  code VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  discount_type VARCHAR(50) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id)
);
```

---

## 7.31 `invoices`

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  family_account_id UUID NULL REFERENCES family_accounts(id),
  parent_id UUID NULL REFERENCES parents(id),
  player_id UUID NULL REFERENCES players(id),
  invoice_number VARCHAR(50) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_invoices_club_invoice_number UNIQUE (club_id, invoice_number)
);
```

### Constraints
```sql
ALTER TABLE invoices ADD CONSTRAINT chk_invoice_amounts_non_negative
CHECK (
  subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND
  total_amount >= 0 AND amount_paid >= 0 AND amount_due >= 0
);
```

### Indexes
```sql
CREATE INDEX idx_invoices_club_id ON invoices(club_id);
CREATE INDEX idx_invoices_parent_id ON invoices(parent_id);
CREATE INDEX idx_invoices_family_account_id ON invoices(family_account_id);
CREATE INDEX idx_invoices_player_id ON invoices(player_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
```

---

## 7.32 `invoice_items`

```sql
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_amount NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  category VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
```

---

## 7.33 `payments`

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  provider VARCHAR(100) NOT NULL,
  provider_payment_id VARCHAR(255),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ NULL,
  recorded_by_user_id UUID NULL REFERENCES users(id),
  provider_payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_payments_club_id ON payments(club_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_payment_id ON payments(provider_payment_id);
```

---

## 7.34 `payment_plans`

```sql
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  plan_name VARCHAR(150) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id)
);
```

---

## 7.35 `payment_plan_installments`

```sql
CREATE TABLE payment_plan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_payment_plan_installments_plan_id ON payment_plan_installments(payment_plan_id);
CREATE INDEX idx_payment_plan_installments_due_date ON payment_plan_installments(due_date);
```

---

## 7.36 `refunds`

```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT,
  provider_refund_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  refunded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id)
);
```

---

## 7.37 `waivers`

```sql
CREATE TABLE waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  name VARCHAR(200) NOT NULL,
  waiver_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

### Indexes
```sql
CREATE INDEX idx_waivers_club_id ON waivers(club_id);
CREATE INDEX idx_waivers_type ON waivers(waiver_type);
```

---

## 7.38 `waiver_versions`

```sql
CREATE TABLE waiver_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id UUID NOT NULL REFERENCES waivers(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_markdown TEXT,
  content_html TEXT,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_waiver_versions UNIQUE (waiver_id, version_number)
);
```

### Indexes
```sql
CREATE INDEX idx_waiver_versions_waiver_id ON waiver_versions(waiver_id);
```

---

## 7.39 `waiver_acceptances`

```sql
CREATE TABLE waiver_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  waiver_version_id UUID NOT NULL REFERENCES waiver_versions(id),
  player_id UUID NOT NULL REFERENCES players(id),
  accepted_by_user_id UUID NOT NULL REFERENCES users(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  accepted_copy_storage_key TEXT,
  CONSTRAINT uq_waiver_acceptance UNIQUE (waiver_version_id, player_id)
);
```

### Indexes
```sql
CREATE INDEX idx_waiver_acceptances_club_id ON waiver_acceptances(club_id);
CREATE INDEX idx_waiver_acceptances_player_id ON waiver_acceptances(player_id);
```

---

## 7.40 `evaluation_templates`

```sql
CREATE TABLE evaluation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

---

## 7.41 `evaluation_criteria`

```sql
CREATE TABLE evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,
  sort_order INTEGER NOT NULL,
  min_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_evaluation_criteria_template_code UNIQUE (template_id, code)
);
```

### Seed suggestion
Default criteria:
- WORK_RATE
- PASSING
- DRIBBLING
- PHYSICALITY
- AGGRESSION
- PACE
- TACTICAL_AWARENESS

---

## 7.42 `position_weight_profiles`
Profile header table.

```sql
CREATE TABLE position_weight_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  template_id UUID NOT NULL REFERENCES evaluation_templates(id),
  position_code VARCHAR(50) NOT NULL,
  total_weight NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_position_weight_profiles UNIQUE (club_id, template_id, position_code, effective_from)
);
```

### Indexes
```sql
CREATE INDEX idx_position_weight_profiles_club_id ON position_weight_profiles(club_id);
CREATE INDEX idx_position_weight_profiles_template_id ON position_weight_profiles(template_id);
CREATE INDEX idx_position_weight_profiles_position_code ON position_weight_profiles(position_code);
```

---

## 7.43 `position_weight_profile_items`
Normalized weight items by criterion.

```sql
CREATE TABLE position_weight_profile_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES position_weight_profiles(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES evaluation_criteria(id),
  weight NUMERIC(8,2) NOT NULL,
  CONSTRAINT uq_position_weight_profile_item UNIQUE (profile_id, criterion_id)
);
```

### Constraint rule
Application/service should validate that the total of profile items = 100 (or configured normalized total).

---

## 7.44 `evaluation_cycles`

```sql
CREATE TABLE evaluation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  team_id UUID NULL REFERENCES teams(id),
  season_id UUID NULL REFERENCES seasons(id),
  name VARCHAR(150) NOT NULL,
  cycle_type VARCHAR(50) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

### Constraints
```sql
ALTER TABLE evaluation_cycles ADD CONSTRAINT chk_evaluation_cycles_time_range CHECK (ends_at >= starts_at);
```

### Indexes
```sql
CREATE INDEX idx_evaluation_cycles_club_id ON evaluation_cycles(club_id);
CREATE INDEX idx_evaluation_cycles_team_id ON evaluation_cycles(team_id);
CREATE INDEX idx_evaluation_cycles_season_id ON evaluation_cycles(season_id);
```

---

## 7.45 `player_evaluations`
One evaluation per player per cycle per template unless multi-rater behavior is added.

```sql
CREATE TABLE player_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  player_id UUID NOT NULL REFERENCES players(id),
  evaluation_cycle_id UUID NOT NULL REFERENCES evaluation_cycles(id),
  template_id UUID NOT NULL REFERENCES evaluation_templates(id),
  position_code VARCHAR(50) NOT NULL,
  overall_score NUMERIC(8,2) NOT NULL,
  rank_in_scope INTEGER NULL,
  bucket_label VARCHAR(50) NULL,
  summary_comment TEXT,
  coach_only_notes TEXT,
  parent_visible_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id),
  CONSTRAINT uq_player_evaluations UNIQUE (player_id, evaluation_cycle_id, template_id)
);
```

### Indexes
```sql
CREATE INDEX idx_player_evaluations_club_id ON player_evaluations(club_id);
CREATE INDEX idx_player_evaluations_team_id ON player_evaluations(team_id);
CREATE INDEX idx_player_evaluations_player_id ON player_evaluations(player_id);
CREATE INDEX idx_player_evaluations_cycle_id ON player_evaluations(evaluation_cycle_id);
CREATE INDEX idx_player_evaluations_overall_score ON player_evaluations(overall_score DESC);
```

---

## 7.46 `player_evaluation_scores`

```sql
CREATE TABLE player_evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_evaluation_id UUID NOT NULL REFERENCES player_evaluations(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES evaluation_criteria(id),
  raw_score NUMERIC(8,2) NOT NULL,
  weighted_score NUMERIC(8,2) NOT NULL,
  CONSTRAINT uq_player_evaluation_score UNIQUE (player_evaluation_id, criterion_id)
);
```

### Indexes
```sql
CREATE INDEX idx_player_evaluation_scores_evaluation_id ON player_evaluation_scores(player_evaluation_id);
CREATE INDEX idx_player_evaluation_scores_criterion_id ON player_evaluation_scores(criterion_id);
```

---

## 7.47 `development_goals`

```sql
CREATE TABLE development_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  player_id UUID NOT NULL REFERENCES players(id),
  team_id UUID NULL REFERENCES teams(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  visibility VARCHAR(50) NOT NULL DEFAULT 'COACH_ONLY',
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id)
);
```

### Indexes
```sql
CREATE INDEX idx_development_goals_club_id ON development_goals(club_id);
CREATE INDEX idx_development_goals_player_id ON development_goals(player_id);
CREATE INDEX idx_development_goals_status ON development_goals(status);
```

---

## 7.48 `development_goal_updates`

```sql
CREATE TABLE development_goal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES development_goals(id) ON DELETE CASCADE,
  progress_status VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id)
);
```

### Indexes
```sql
CREATE INDEX idx_development_goal_updates_goal_id ON development_goal_updates(goal_id);
```

---

## 7.49 `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  club_id UUID NULL REFERENCES clubs(id),
  type VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  payload_json JSONB,
  delivery_channel VARCHAR(30) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  scheduled_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_scheduled_at ON notifications(scheduled_at);
```

---

## 7.50 `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  chat_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  announcement_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  billing_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7.51 `audit_logs`

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NULL REFERENCES clubs(id),
  actor_user_id UUID NULL REFERENCES users(id),
  action VARCHAR(150) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID NULL,
  metadata_json JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_audit_logs_club_id ON audit_logs(club_id);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

---

## 7.52 `system_settings`

Singleton table of **global, platform-wide** settings managed by Master Admin.
Distinct from per-club `club_settings`: this holds platform master switches and
the defaults applied to brand-new clubs (each club can override afterwards in
`club_settings`). Exactly one row exists, with the fixed id `'system'`.

```sql
CREATE TABLE system_settings (
  id TEXT PRIMARY KEY DEFAULT 'system',
  ai_features_enabled BOOLEAN NOT NULL DEFAULT true,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  default_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  default_registration_enabled BOOLEAN NOT NULL DEFAULT true,
  default_billing_enabled BOOLEAN NOT NULL DEFAULT true,
  default_sms_notifications BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL
);
```

### Rules
- Master Admin only (system scope); reads/writes go through the master module
  service, and every write records a `system_settings.update` audit entry.
- The row is created lazily on first read if absent.

---

## 7.53 `platform_announcements`

System-scoped broadcasts published by Master Admin to tenants (system notices,
release notes, policy updates, maintenance windows). Distinct from the
club-scoped `announcements` table and per-user `notifications`. Visibility is
computed at query time; no per-user fan-out on publish.

```sql
CREATE TABLE platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO',          -- INFO | WARNING | CRITICAL
  audience_scope VARCHAR(30) NOT NULL DEFAULT 'ALL_CLUBS', -- ALL_CLUBS | SPECIFIC_CLUBS
  audience_roles TEXT[] NOT NULL,                         -- CLUB_ADMIN | COACH | PARENT
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',            -- DRAFT | SCHEDULED | PUBLISHED | ARCHIVED
  pinned BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NULL,
  scheduled_at TIMESTAMPTZ NULL,                          -- flips to PUBLISHED at/after this time
  expires_at TIMESTAMPTZ NULL,                            -- auto-hidden after this time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL
);
CREATE INDEX idx_platform_announcements_status ON platform_announcements(status);
CREATE INDEX idx_platform_announcements_published_at ON platform_announcements(published_at DESC);
CREATE INDEX idx_platform_announcements_scheduled_at ON platform_announcements(scheduled_at);
```

### "Live" rule (computed at read time)
`(status = 'PUBLISHED' OR (status = 'SCHEDULED' AND scheduled_at <= now()))
AND (expires_at IS NULL OR expires_at > now())`. A cron/queue worker should
formalize the SCHEDULED→PUBLISHED flip; until then it is computed.

## 7.54 `platform_announcement_clubs`

Targets when `audience_scope = SPECIFIC_CLUBS` (unused for ALL_CLUBS).

```sql
CREATE TABLE platform_announcement_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id),
  UNIQUE (platform_announcement_id, club_id)
);
CREATE INDEX idx_platform_announcement_clubs_club_id ON platform_announcement_clubs(club_id);
```

## 7.55 `platform_announcement_reads`

Read/dismiss tracking — one row per (announcement, user), written ONLY on
interaction (open or dismiss). No fan-out on publish.

```sql
CREATE TABLE platform_announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NULL,
  dismissed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_announcement_id, user_id)
);
CREATE INDEX idx_platform_announcement_reads_user_id ON platform_announcement_reads(user_id);
```

## 7.56 `platform_announcement_templates`

Reusable composer templates for platform announcements.

```sql
CREATE TABLE platform_announcement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
  default_audience_scope VARCHAR(30) NOT NULL DEFAULT 'ALL_CLUBS',
  default_audience_roles TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Rules
- Master Admin only for all writes (system scope); every create/publish/archive/
  delete + template change records an audit entry (`platform_announcement.*`).
- Recipients see an announcement only when it is "live" AND
  (`ALL_CLUBS` OR their club ∈ `platform_announcement_clubs`) AND their role ∈
  `audience_roles`.

---

## 7.57 `announcement_reads`

Read tracking for **club** `announcements` (distinct from
`platform_announcement_reads`). One row per (announcement, user), written only on
interaction. Powers the navbar bell's club-announcement unread count without a
per-user fan-out on publish.

```sql
CREATE TABLE announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
CREATE INDEX idx_announcement_reads_user_id ON announcement_reads(user_id);
```

---

## 8. Relationship Summary

### One-to-Many
- clubs -> teams
- clubs -> players
- clubs -> parents
- clubs -> announcements
- clubs -> events
- clubs -> invoices
- clubs -> evaluation_templates
- clubs -> evaluation_cycles

### Many-to-Many via Join Tables
- players <-> teams via `player_team_memberships`
- players <-> parents via `player_parent_links`
- chats <-> users via `chat_members`

### Historical/Versioned
- waivers -> waiver_versions -> waiver_acceptances
- evaluation_templates -> evaluation_criteria
- evaluation_cycles -> player_evaluations -> player_evaluation_scores
- development_goals -> development_goal_updates

---

## 9. Recommended Safe Query Views
These are not mandatory DB views on day one but are strongly recommended as application query projections or database views.

### 9.1 `parent_roster_safe_view`
Contains only safe fields for parents viewing other children:
- player_id
- team_id
- team_name
- player_name
- preferred_name
- jersey_number
- primary_position
- photo_url (if club setting enabled)

### 9.2 `coach_roster_full_view`
Contains full player details for assigned teams.

### 9.3 `evaluation_summary_view`
Contains:
- player
- team
- evaluation cycle
- overall score
- bucket label
- position

### 9.4 `family_billing_summary_view`
Contains family account invoice balances and overdue totals.

---

## 10. Calculation Rules to Implement in Service Layer

### 10.1 Evaluation Weighted Score
For each player evaluation:
1. fetch active template criteria
2. fetch position weight profile items for player position
3. calculate weighted criterion score
4. calculate overall weighted score
5. rank within chosen scope (team/season or configured scope)
6. assign bucket label (Top 8 / Middle 8 / Bottom 8 or configurable bucketing)

### 10.2 Invoice Balance
```text
amount_due = total_amount - amount_paid
```

### 10.3 Waiver Validity
A player is compliant only if:
- required waiver version exists
- active acceptance exists for that version
- no expiration invalidates the acceptance

---

## 11. Constraints and Business Rules to Enforce
1. A parent can only update linked child records.
2. `event_rsvps` must be unique per `event_id + player_id`.
3. `attendance_records` must be unique per `event_id + player_id`.
4. `waiver_acceptances` must be unique per `waiver_version_id + player_id`.
5. `position_weight_profile_items` total should equal 100 per profile.
6. `player_evaluations` should be unique per `player_id + evaluation_cycle_id + template_id` unless multi-rater is introduced.
7. Invoice totals and payment totals must not go negative.
8. Team-scoped coach actions must verify membership via `team_coaches` or scoped role assignment.
9. Parent access should never expose other children’s restricted columns.

---

## 12. Seed Data Recommendations

### Roles
- MASTER_ADMIN
- CLUB_ADMIN
- COACH
- PARENT

### Default Evaluation Criteria
- WORK_RATE
- PASSING
- DRIBBLING
- PHYSICALITY
- AGGRESSION
- PACE
- TACTICAL_AWARENESS

### Default Position Profiles
- GK
- CB
- FB
- DM
- CM
- AM
- WINGER
- ST
- UTILITY

---

## 13. Migration Order Recommendation
1. users
2. roles
3. clubs
4. seasons
5. teams
6. user_role_assignments
7. team_coaches
8. players
9. parents
10. player_team_memberships
11. player_parent_links
12. files
13. announcements / chats / chat_members / messages / message_attachments
14. events / event_attachments / event_rsvps / attendance_records
15. registration_programs / forms / submissions / answers
16. family_accounts / discounts / invoices / invoice_items / payments / plans / installments / refunds
17. waivers / versions / acceptances
18. evaluation_templates / criteria / position profiles / items / cycles / player evaluations / scores
19. development_goals / updates
20. notifications / notification_preferences
21. audit_logs
22. invitations / password_reset_tokens

---

## 14. Future Extension Hooks
- player self-login support
- multi-rater evaluations
- team lineup history
- match statistics module
- ride-sharing module tied to RSVPs
- sponsorship / fundraising module
- public club website content management
- advanced analytics warehouse

---

## 15. Final Recommendation
Implement this schema as a modular PostgreSQL design with explicit foreign keys, tenant scoping by `club_id`, and service-layer enforcement for RBAC and privacy.

Use normalized tables for critical historical and transactional modules (evaluations, payments, waivers, attendance) and JSONB only where flexibility is needed (dynamic forms, notification payloads, provider payloads).

This schema is strong enough to start backend implementation immediately and is aligned to the previously defined product requirements and technical architecture.
