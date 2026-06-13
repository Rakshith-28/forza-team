# Soccer Club Management App - Technical Architecture Specification

## 1. Document Purpose
This document defines the recommended technical architecture for the Soccer Club Management App. It is intended to be implementation-ready guidance for Claude Code and engineering teams.

This architecture supports the previously defined product scope:
- Multi-tenant soccer club SaaS platform
- Role-based access control for Master Admin, Club Admin, Coach, and Parent
- Team roster, chat, announcements, schedule, RSVP, attendance
- Registration, payments, waivers
- Player evaluations, position-based weights, radar comparison, development tracking
- AI assistant / Copilot features
- Responsive web app with mobile-ready API architecture

This specification is written to optimize for:
- maintainability
- strong tenant isolation
- privacy-safe data access
- production-grade security
- modular feature growth
- auditability
- mobile-first extensibility

---

## 2. Architecture Goals
1. Support multiple clubs as isolated tenants in one platform.
2. Enforce strict RBAC and resource-scope authorization.
3. Keep the system modular so Phase 1 and Phase 2 can be delivered incrementally.
4. Support real-time messaging and push notifications.
5. Provide a clean data model for player development, evaluations, registrations, and payments.
6. Enable AI-assisted workflows without violating privacy or tenant boundaries.
7. Allow future support for native mobile apps without redesigning the backend.

---

## 3. Recommended Technology Stack

## 3.1 Frontend
### Web App
- **Next.js (React)**
- TypeScript
- App Router or modular route-based architecture
- Server components where useful, but most authenticated app areas can remain client-driven for interactivity
- Tailwind CSS or enterprise component library
- TanStack Query or equivalent for data fetching/caching
- React Hook Form + Zod for form validation
- Recharts / Nivo / ECharts for dashboards and radar/scatter charts

### Mobile App
Recommended Phase 2 options:
- React Native (Expo or bare workflow), or
- Flutter if a separate mobile engineering strategy is preferred

### Frontend Responsibilities
- role-aware navigation and route protection
- child/team context switching
- forms, roster tables, schedule views, dashboards, charts, chat UI
- optimistic UI for chat and RSVP when appropriate
- localized notifications and user settings

---

## 3.2 Backend
Recommended backend:
- **Node.js + NestJS** (preferred for modularity), or Express if team prefers lighter structure
- TypeScript throughout backend
- REST API first
- WebSocket gateway for team chat and live notifications
- Background job processor for notifications, reminders, AI tasks, payment follow-ups, and scheduled digests

### Backend Module Boundaries
Recommended domain modules:
- auth
- users
- roles / authorization
- clubs
- teams
- players
- parents
- roster
- schedules / events
- rsvp / attendance
- chat / announcements
- files
- registration
- waivers
- billing / payments
- evaluations
- development tracking
- notifications
- ai assistant
- audit logging
- reporting

---

## 3.3 Database
Recommended primary database:
- **PostgreSQL**

Reasons:
- relational integrity is important for clubs, teams, users, children, registration, payments, and evaluations
- strong query support for dashboards and reporting
- good support for row-level security patterns if needed later
- mature ecosystem and migration tooling

### Secondary Storage / Services
- Redis for caching, rate limiting, queue support, and ephemeral session/token data if needed
- Object storage for images, documents, waivers, exports, and attachments
- Search layer optional later (Postgres FTS first, Elasticsearch/OpenSearch later if needed)

---

## 3.4 Infrastructure
Recommended hosting approach:
- Azure App Service / Azure Container Apps / AKS, or equivalent cloud-native platform
- Azure Database for PostgreSQL or managed PostgreSQL service
- Azure Blob Storage or equivalent object storage
- Azure Service Bus / queue service or BullMQ with Redis for jobs
- Azure Communication / email provider / push provider abstraction

The architecture should remain cloud-agnostic where possible, but since the broader ecosystem and likely operations may be Microsoft-oriented, Azure-friendly design is recommended.

---

## 4. High-Level System Architecture

## 4.1 Logical Components
1. **Web Frontend**
2. **Mobile App Clients**
3. **API Gateway / BFF layer (optional but recommended)**
4. **Core Application API**
5. **Realtime Messaging Gateway**
6. **Background Jobs / Worker Services**
7. **PostgreSQL Database**
8. **Redis / Cache / Queue**
9. **Object Storage**
10. **Notification Providers**
11. **Payment Provider Integration**
12. **AI Provider Abstraction Layer**
13. **Audit / Logging / Monitoring Stack**

---

## 4.2 Recommended Runtime Topology
### Minimum Deployable Architecture
For MVP, deploy as:
- one frontend application
- one backend application with modular services
- one worker process
- one PostgreSQL database
- one Redis instance
- one object storage account

### Scalable Target Architecture
As usage grows, split into:
- frontend web app
- API service
- realtime chat/notification gateway
- async worker service
- reporting/analytics jobs
- AI orchestration service (logical module or separate service)

---

## 5. Multi-Tenant Architecture

## 5.1 Tenant Model
The application is a **multi-tenant SaaS** platform.
Each soccer club is a tenant.

### Tenant Isolation Strategy
Use **shared database, shared schema, tenant-scoped tables** for MVP and early scale.
Most business tables will include:
- `club_id`
- audit metadata
- status fields

This is the most practical balance of cost, simplicity, and isolation for MVP.

### Why Not Separate Database Per Club Initially?
Separate DB per tenant increases operational complexity, migration overhead, and reporting complexity. Start with shared schema + strict scoping, then evolve later for enterprise/large-club isolation if necessary.

---

## 5.2 Tenant Scope Rules
Every service method must validate tenant scope.
No request should return tenant data without explicit `club_id` authorization checks.

### Required Scoping Pattern
All tenant-bound resources must be validated by:
1. authenticated user
2. assigned role(s)
3. accessible club scope
4. accessible team scope if resource is team-bound
5. child linkage if parent action is child-bound

---

## 6. Identity, Authentication, and Authorization

## 6.1 Identity Model
Separate **authentication identity** from **business role assignments**.

### Core Principle
A user may evolve over time and potentially hold multiple business relationships.
Example:
- same person could be both a parent and a coach in future
- same person could move clubs

### Recommended Tables
- `users`
- `roles`
- `user_role_assignments`
- `club_memberships` (optional logical layer depending on model)

---

## 6.2 Authentication
### Recommended MVP
- email + password
- password reset flow
- email verification
- secure session or JWT + refresh token strategy

### Security Enhancements
- MFA for Master Admin and Club Admin
- optional MFA for coaches
- device/session management in future

### Token Claims
Access token should include only minimal claims:
- user_id
- active_role_assignment_id or role context
- club scope summary if needed
- session id

Avoid bloating tokens with dynamic permission matrices.

---

## 6.3 Authorization Strategy
Use **policy-based authorization** with explicit scope checks.

### Layers
1. route-level auth guard
2. role permission guard
3. resource scope validation in service layer
4. field visibility filtering in response serializers

### Important
Do not rely only on frontend role hiding. Backend must always enforce access.

---

## 7. Domain-Driven Module Design

## 7.1 Suggested Modules

### Identity Module
- auth
- users
- invitations
- password reset
- MFA

### Tenant Module
- clubs
- seasons
- club settings
- feature flags (club-level)

### Team Operations Module
- teams
- roster
- player profiles
- parent links
- coach assignments

### Communications Module
- team chat
- direct messages (optional)
- announcements
- attachments
- moderation controls

### Events Module
- scheduling
- RSVPs
- attendance
- reminders
- calendar views

### Registration & Billing Module
- registration programs
- dynamic forms
- submission workflows
- invoices
- payments
- payment plans
- refunds
- discounts
- waivers

### Player Development Module
- evaluation templates
- evaluation cycles
- evaluation scores
- position weight profiles
- radar comparison data
- development goals
- progress tracking

### AI Module
- summarization
- drafting
- recommendation generation
- guardrails
- review workflows
- usage logging

### Platform Services Module
- notifications
- audit logs
- exports
- reporting
- storage

---

## 8. Database Design

## 8.1 General Database Standards
All core tables should include these fields unless there is a strong reason not to:
- `id` UUID primary key
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`
- `deleted_at` nullable for soft delete where appropriate
- `deleted_by` nullable
- `status` where lifecycle tracking matters
- `club_id` when tenant-bound

Use:
- UUIDs for external/business identifiers
- timestamps with timezone
- explicit foreign keys
- indexes on foreign key columns and commonly filtered status/date fields

---

## 8.2 Core Table Groups

### Users and Roles
#### `users`
- `id`
- `email` (unique)
- `password_hash`
- `first_name`
- `last_name`
- `phone`
- `is_email_verified`
- `last_login_at`
- `status`
- `created_at`
- `updated_at`

#### `roles`
- `id`
- `code` (`MASTER_ADMIN`, `CLUB_ADMIN`, `COACH`, `PARENT`)
- `name`
- `description`

#### `user_role_assignments`
- `id`
- `user_id`
- `role_id`
- `club_id` nullable for Master Admin
- `team_id` nullable for team-scoped coach role
- `is_primary`
- `status`
- `created_at`
- `updated_at`

---

### Clubs and Teams
#### `clubs`
- `id`
- `name`
- `short_code`
- `logo_url`
- `primary_color`
- `secondary_color`
- `address_line1`
- `address_line2`
- `city`
- `state`
- `postal_code`
- `country`
- `phone`
- `website`
- `status`
- `timezone`
- `settings_json` or normalized settings tables
- `created_at`
- `updated_at`

#### `seasons`
- `id`
- `club_id`
- `name`
- `start_date`
- `end_date`
- `status`

#### `teams`
- `id`
- `club_id`
- `season_id`
- `name`
- `team_code`
- `age_group`
- `division`
- `competitive_level`
- `status`
- `primary_coach_user_id` nullable for convenience only
- `created_at`
- `updated_at`

#### `team_coaches`
- `id`
- `team_id`
- `user_id`
- `role_type` (`HEAD_COACH`, `ASSISTANT_COACH`, `MANAGER`)
- `status`
- `created_at`

---

### Players and Parents
#### `players`
- `id`
- `club_id`
- `first_name`
- `last_name`
- `preferred_name`
- `date_of_birth`
- `photo_url`
- `jersey_number`
- `primary_position`
- `secondary_position`
- `medical_notes` restricted
- `allergy_notes` restricted
- `emergency_contact_name` restricted
- `emergency_contact_phone` restricted
- `status`
- `created_at`
- `updated_at`

#### `player_team_memberships`
- `id`
- `player_id`
- `team_id`
- `season_id`
- `status`
- `joined_at`
- `left_at`

#### `parents`
- `id`
- `club_id`
- `user_id`
- `first_name`
- `last_name`
- `email`
- `phone`
- `secondary_phone`
- `preferred_contact_method`
- `address_line1`
- `address_line2`
- `city`
- `state`
- `postal_code`
- `status`

#### `player_parent_links`
- `id`
- `player_id`
- `parent_id`
- `relationship_type`
- `is_primary_guardian`
- `can_pickup`
- `can_pay`
- `status`

---

### Communications
#### `announcements`
- `id`
- `club_id`
- `team_id` nullable
- `title`
- `body`
- `audience_type`
- `published_at`
- `created_by`
- `status`

#### `chats`
- `id`
- `club_id`
- `team_id` nullable
- `chat_type` (`TEAM`, `DIRECT`, `ANNOUNCEMENT_THREAD`)
- `status`
- `created_at`

#### `chat_members`
- `id`
- `chat_id`
- `user_id`
- `member_role`
- `joined_at`
- `muted_until`

#### `messages`
- `id`
- `chat_id`
- `sender_user_id`
- `body`
- `message_type`
- `reply_to_message_id` nullable
- `edited_at`
- `deleted_at`
- `created_at`

#### `message_attachments`
- `id`
- `message_id`
- `file_id`

---

### Files
#### `files`
- `id`
- `club_id`
- `owner_user_id`
- `storage_key`
- `original_name`
- `mime_type`
- `size_bytes`
- `purpose`
- `created_at`

---

### Events / RSVP / Attendance
#### `events`
- `id`
- `club_id`
- `team_id` nullable
- `event_type`
- `title`
- `description`
- `start_at`
- `end_at`
- `timezone`
- `location_name`
- `address_line1`
- `city`
- `state`
- `postal_code`
- `opponent_name` nullable
- `home_away`
- `arrival_time`
- `uniform_notes`
- `status`
- `created_by`
- `updated_by`

#### `event_rsvps`
- `id`
- `event_id`
- `player_id`
- `responded_by_user_id`
- `response_status` (`GOING`, `NOT_GOING`, `MAYBE`, `LATE`)
- `comment`
- `responded_at`

#### `attendance_records`
- `id`
- `event_id`
- `player_id`
- `recorded_by_user_id`
- `attendance_status` (`PRESENT`, `EXCUSED_ABSENT`, `UNEXCUSED_ABSENT`, `LATE`, `INJURED`, `PARTIAL`)
- `notes`
- `recorded_at`

---

### Registration / Waivers / Billing
#### `registration_programs`
- `id`
- `club_id`
- `season_id`
- `name`
- `description`
- `opens_at`
- `closes_at`
- `status`

#### `registration_forms`
- `id`
- `club_id`
- `registration_program_id`
- `name`
- `version`
- `schema_json`
- `status`

#### `registration_submissions`
- `id`
- `club_id`
- `registration_program_id`
- `form_id`
- `player_id`
- `submitted_by_user_id`
- `status`
- `submitted_at`
- `reviewed_at`
- `reviewed_by`

#### `registration_answers`
- `id`
- `submission_id`
- `field_key`
- `field_value_json`

#### `waivers`
- `id`
- `club_id`
- `name`
- `waiver_type`
- `status`

#### `waiver_versions`
- `id`
- `waiver_id`
- `version_number`
- `content_markdown` or `content_html`
- `effective_at`
- `expires_at` nullable

#### `waiver_acceptances`
- `id`
- `waiver_version_id`
- `player_id`
- `accepted_by_user_id`
- `accepted_at`
- `ip_address`
- `user_agent`
- `accepted_copy_storage_key`

#### `invoices`
- `id`
- `club_id`
- `family_account_id` or parent grouping strategy
- `parent_id` nullable if direct ownership model
- `player_id` nullable if child-specific fee
- `invoice_number`
- `currency`
- `subtotal_amount`
- `discount_amount`
- `tax_amount`
- `total_amount`
- `amount_paid`
- `amount_due`
- `due_date`
- `status`
- `created_at`

#### `invoice_items`
- `id`
- `invoice_id`
- `description`
- `quantity`
- `unit_amount`
- `line_total`
- `category`

#### `payments`
- `id`
- `invoice_id`
- `provider`
- `provider_payment_id`
- `amount`
- `currency`
- `status`
- `paid_at`
- `recorded_by_user_id`

#### `payment_plans`
- `id`
- `invoice_id`
- `plan_name`
- `schedule_json`
- `status`

---

### Evaluation / Development
#### `evaluation_templates`
- `id`
- `club_id`
- `name`
- `description`
- `status`

#### `evaluation_criteria`
- `id`
- `template_id`
- `code`
- `label`
- `sort_order`
- `min_score`
- `max_score`
- `is_active`

#### `position_weight_profiles`
- `id`
- `club_id`
- `template_id`
- `position_code`
- `criteria_weights_json` or normalized child rows
- `total_weight`
- `is_default`
- `effective_from`
- `effective_to` nullable

#### `evaluation_cycles`
- `id`
- `club_id`
- `team_id` nullable
- `season_id`
- `name`
- `cycle_type` (`TRYOUT`, `PRESEASON`, `MIDSEASON`, `POSTSEASON`, `CUSTOM`)
- `starts_at`
- `ends_at`
- `status`

#### `player_evaluations`
- `id`
- `club_id`
- `team_id`
- `player_id`
- `evaluation_cycle_id`
- `template_id`
- `position_code`
- `overall_score`
- `rank_in_scope`
- `bucket_label`
- `summary_comment`
- `coach_only_notes`
- `parent_visible_notes`
- `created_by`
- `created_at`

#### `player_evaluation_scores`
- `id`
- `player_evaluation_id`
- `criterion_id`
- `raw_score`
- `weighted_score`

#### `development_goals`
- `id`
- `club_id`
- `player_id`
- `team_id`
- `title`
- `description`
- `category`
- `status`
- `visibility` (`COACH_ONLY`, `PARENT_VISIBLE`)
- `target_date`
- `created_by`
- `created_at`

#### `development_goal_updates`
- `id`
- `goal_id`
- `progress_status`
- `notes`
- `updated_by`
- `updated_at`

---

### Platform / Audit / Notifications
#### `audit_logs`
- `id`
- `club_id` nullable
- `actor_user_id`
- `action`
- `resource_type`
- `resource_id`
- `metadata_json`
- `ip_address`
- `created_at`

#### `notifications`
- `id`
- `user_id`
- `club_id` nullable
- `type`
- `title`
- `body`
- `payload_json`
- `delivery_channel`
- `status`
- `scheduled_at`
- `sent_at`
- `read_at`

#### `notification_preferences`
- `id`
- `user_id`
- `email_enabled`
- `push_enabled`
- `sms_enabled`
- `chat_notifications_enabled`
- `announcement_notifications_enabled`
- `billing_notifications_enabled`
- `schedule_notifications_enabled`

---

## 9. Indexing and Performance Strategy

### Recommended Indexes
At minimum add indexes on:
- `club_id`
- `team_id`
- `player_id`
- `user_id`
- `season_id`
- `status`
- `created_at`
- event start dates
- invoice due dates
- message creation time
- evaluation cycle fields

### Composite Index Examples
- `(club_id, status)`
- `(team_id, status)`
- `(event_id, player_id)` unique for RSVP and attendance
- `(player_id, evaluation_cycle_id)`
- `(chat_id, created_at)`
- `(invoice_id, status)`

### Query Optimization Guidelines
- paginate list endpoints
- avoid N+1 queries by batching relations
- denormalize selectively for dashboard summaries if necessary
- use materialized summary tables later for heavy reports

---

## 10. API Architecture

## 10.1 API Style
Use REST APIs for implementation speed and clarity.
GraphQL can be considered later if frontend data shape requirements become complex, but it is not necessary for MVP.

## 10.2 Versioning
Use versioned endpoints from the start:
- `/api/v1/...`

## 10.3 Response Standards
Standard envelope recommended for consistency:
- `data`
- `meta`
- `errors`

### Meta Examples
- pagination
- applied filters
- current user scope hints if needed

## 10.4 Idempotency
Use idempotency keys for:
- payment initiation
- webhook processing
- invitation acceptance
- waiver acceptance finalization if multi-step

---

## 11. Realtime Architecture

## 11.1 Realtime Use Cases
- team chat updates
- new announcements
- schedule changes
- RSVP updates for coach view
- live attendance updates when coaches are marking
- in-app notification updates

## 11.2 Recommended Design
Use WebSockets or Socket.IO gateway.
Realtime gateway should authenticate users using access token/session validation.

### Channels / Rooms
- club room
- team room
- user room
- chat room

### Event Types
- `message.created`
- `message.updated`
- `announcement.published`
- `event.updated`
- `rsvp.updated`
- `attendance.updated`
- `notification.created`

---

## 12. Background Jobs and Async Processing

## 12.1 Use Cases
- email sending
- push notifications
- chat mention processing
- schedule reminders
- invoice due reminders
- registration incomplete reminders
- AI draft generation
- PDF export generation
- receipt generation
- waiver acceptance copy archiving
- recurring event expansion

## 12.2 Recommended Queue Design
Use Redis-backed queue initially.
Queue names by domain:
- `notifications`
- `billing`
- `registrations`
- `events`
- `ai`
- `exports`

## 12.3 Retry Strategy
- exponential backoff
- dead-letter queue or failed jobs table/logging
- alerting for repeated failures

---

## 13. File and Media Architecture

## 13.1 Storage Types
Store in object storage:
- player photos
- club logos
- documents
- waiver accepted copies
- exports (PDF/CSV)
- message attachments

## 13.2 File Access Pattern
Do not expose raw storage paths directly.
Use one of:
- signed URLs with expiry
- file proxy endpoint with permission validation

## 13.3 File Validation
Validate:
- MIME type
- extension
- size limit
- malware scan hook
- upload ownership and scope

---

## 14. Payments Architecture

## 14.1 Provider Abstraction
Use a payment provider abstraction layer so provider can be swapped later.
Recommended initial capabilities:
- create checkout/payment intent
- confirm payment
- webhook reconciliation
- refund
- receipt metadata

## 14.2 Payment Safety Rules
- never trust client-side payment success without webhook/server verification
- persist provider event ids for idempotency
- separate invoice state from payment attempt state
- audit all manual offline payment entries

## 14.3 Webhook Handling
Provider webhooks should:
- be authenticated/validated
- be idempotent
- update payments and invoice balances
- log failures for reprocessing

---

## 15. AI Architecture

## 15.1 AI Provider Abstraction
Create an AI service abstraction so the app is not tightly coupled to a single LLM provider.

### Recommended Interface
- summarization
- content drafting
- data-to-text generation
- structured insight generation
- translation (optional)

## 15.2 AI Processing Pattern
1. user invokes AI feature
2. backend gathers permitted source data according to role and scope
3. backend constructs prompt with tenant-safe filtered data
4. AI provider returns result
5. result stored as draft if needed
6. user reviews and publishes/uses output
7. action is audited when relevant

## 15.3 AI Safety / Privacy Rules
- filter hidden child data before prompt construction
- do not include unrelated tenant data
- do not allow AI to auto-message by default
- mark AI-generated text clearly in UI where useful
- allow admins to disable AI by module

---

## 16. Notification Architecture

## 16.1 Channels
- in-app
- email
- push
- SMS optional later

## 16.2 Notification Pipeline
Event occurs -> domain event emitted -> notification rules evaluated -> jobs created -> provider delivery -> delivery status persisted.

### Domain Event Examples
- event created/updated
- RSVP reminder window
- new message/announcement
- invoice due
- registration incomplete
- waiver expiring
- evaluation shared with parent

## 16.3 Notification Preferences
Preferences should be evaluated per user and per category.

---

## 17. Reporting and Analytics Architecture

## 17.1 Reporting Types
- club dashboards
- team dashboards
- attendance summaries
- finance summaries
- registration status summaries
- evaluation dashboards
- development progress dashboards

## 17.2 Strategy
For MVP:
- query Postgres directly with optimized indexes
- cache selected dashboard aggregates

For later scale:
- create summary/materialized tables
- scheduled reporting jobs
- optional analytics warehouse pipeline

---

## 18. Frontend Architecture

## 18.1 Frontend Structure
Recommended app areas:
- public auth area
- master admin area
- club admin area
- coach area
- parent area

### Shared Cross-Cutting UI Layers
- auth context
- role/scope context
- tenant context
- child switcher context
- notifications provider
- realtime socket provider
- query cache provider

## 18.2 Component Areas
- tables/grids
- forms
- file uploader
- schedule/calendar widgets
- chat threads
- dashboard cards
- charts (radar, scatter, leaderboards)
- drawers/modals
- activity feed

## 18.3 Route Protection
Use both:
- server-side/session middleware for protected routes
- client-side role navigation guards

---

## 19. Mobile Architecture Guidance

## 19.1 API Requirements for Mobile
APIs must support:
- low-latency list retrieval
- pagination and filtering
- incremental sync patterns where useful
- push token registration
- stable data contracts

## 19.2 Mobile-Specific Endpoints (Optional BFF)
Consider mobile-optimized endpoints for:
- parent dashboard summary
- coach today’s team view
- quick attendance roster
- upcoming events digest

## 19.3 Offline Strategy
MVP can be online-first.
Later enhance with:
- cached schedule and roster
- queued attendance drafts if connectivity drops temporarily

---

## 20. RBAC Matrix (Technical)

## 20.1 Master Admin
- system-wide CRUD across all tenants
- view all audit logs
- impersonate club admins
- manage feature flags and AI settings globally

## 20.2 Club Admin
- CRUD within own club for users, teams, rosters, schedules, registrations, billing, evaluations
- configure position weights and evaluation templates
- send club announcements

## 20.3 Coach
- CRUD only for assigned teams on roster, schedules, attendance, evaluations, development notes
- send team communications
- no billing admin by default

## 20.4 Parent
- read linked child/team data
- update linked child approved fields only
- RSVP and pay for linked children only
- no access to other children’s private/evaluation data

## 20.5 Field-Level Security
Response serializers and DTO mapping should enforce field visibility.
Do not return hidden fields and rely on frontend to hide them.

---

## 21. Privacy and Data Protection

## 21.1 Sensitive Data Classes
Treat these as restricted:
- medical notes
- emergency contacts
- payment details
- waiver data
- coach-only development notes
- child personal contact details

## 21.2 Parent Safe Views
Parent access to roster must use safe projections for non-linked children.

## 21.3 Data Retention
Recommended retention policies by category:
- audit logs: long retention
- payment records: long retention per legal requirements
- waivers: retain accepted copies and versions
- chat/media: configurable retention later

---

## 22. Security Architecture

## 22.1 Security Controls
- password hashing (Argon2 or bcrypt with strong policy)
- CSRF protection if cookie/session-based
- secure HTTP headers
- input validation everywhere
- output encoding and XSS protection
- role-based authorization middleware
- rate limiting on auth and chat endpoints
- signed URLs for file access
- webhook signature validation
- secret management via environment/infrastructure secret store

## 22.2 Security Logging
Log:
- failed logins
- suspicious repeated access failures
- administrative impersonation
- privilege changes
- payment webhook errors
- bulk exports

---

## 23. Observability and Operations

## 23.1 Logging
Use structured JSON logs.
Include:
- request id / correlation id
- user id when authenticated
- club id where applicable
- endpoint/service name
- severity
- error stack where relevant

## 23.2 Metrics
Track:
- request latency
- error rate
- chat throughput
- reminder job throughput
- payment success/failure rate
- registration completion funnel
- AI usage and latency

## 23.3 Tracing
Distributed tracing recommended if services split later.
At minimum propagate correlation ids across API, workers, and notifications.

## 23.4 Alerts
Alert on:
- sustained error spikes
- queue backlog growth
- payment webhook failures
- chat gateway disconnect surges
- storage failures
- AI provider failures above threshold

---

## 24. Deployment Environments

## 24.1 Environments
- local
- dev
- test / QA
- staging
- production

## 24.2 CI/CD Requirements
- lint + type checks
- unit tests
- integration tests
- database migration validation
- build artifact generation
- environment-specific deployment
- feature flag rollout support

## 24.3 Database Migration Strategy
Use migration tooling (e.g., Prisma migrations, TypeORM migrations, Drizzle migrations, or Knex depending on stack choice).
All schema changes must be versioned and reproducible.

---

## 25. Testing Strategy

## 25.1 Unit Tests
- service logic
- authorization policies
- score calculation
- RSVP transitions
- attendance rules
- invoice calculations
- AI guardrail filters

## 25.2 Integration Tests
- auth flows
- role access boundaries
- parent child-only update rules
- payment webhook processing
- waiver acceptance flows
- radar comparison data endpoint
- evaluation ranking calculations

## 25.3 End-to-End Tests
- login and dashboard routing by role
- club admin team setup
- coach roster and attendance workflow
- parent registration + payment + waiver flow
- player evaluation creation and radar comparison

---

## 26. Suggested Implementation Order

### Step 1 - Platform Foundation
- auth
- users/roles
- clubs/teams
- base RBAC
- audit log framework

### Step 2 - Core Team Operations
- players/parents/roster
- announcements/chat
- file storage integration

### Step 3 - Events
- schedule
- RSVP
- attendance
- reminders

### Step 4 - Registration & Billing
- forms
- waivers
- invoices/payments
- parent family finance views

### Step 5 - Development Module
- evaluation templates
- position weights
- score calculation
- ranking + buckets
- radar comparison
- development goals

### Step 6 - AI and Mobile Enhancements
- AI abstraction + review workflows
- push notifications
- mobile-optimized summary endpoints

---

## 27. Key Technical Decisions Recommended
1. Use **PostgreSQL** as the source of truth.
2. Use **NestJS + TypeScript** for modular backend.
3. Use **Next.js + TypeScript** for web frontend.
4. Use **shared schema multi-tenant design** with strict `club_id` scoping.
5. Use **Redis-backed jobs** for async workflows.
6. Use **WebSockets** for chat and live updates.
7. Use **object storage** with signed URL or proxy access model.
8. Use **payment provider abstraction** from day one.
9. Use **AI provider abstraction** from day one.
10. Enforce **field-level privacy filtering** in backend serializers.

---

## 28. Final Architecture Recommendation
Build the platform as a modular monolith first, not as many microservices.

### Why Modular Monolith First?
- faster implementation
- easier debugging
- simpler deployment
- shared transactions and relational workflows are easier
- domain boundaries can still be kept clean

### How to Keep It Future-Ready
- strict module boundaries
- event-driven async processing for side effects
- clean provider abstractions for storage, notifications, payments, and AI
- explicit domain services and DTOs
- avoid leaking ORM models directly to controllers/UI

This gives the team a production-capable architecture that can scale functionally and operationally without overcomplicating Phase 1 and Phase 2 delivery.
