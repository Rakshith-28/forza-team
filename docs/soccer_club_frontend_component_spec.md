# Soccer Club Management App - Frontend Component Specification

## 1. Document Purpose
This document defines the frontend component specification for the Soccer Club Management App. It is intended to guide Claude Code or frontend engineers in building a consistent, scalable, role-aware UI using reusable components.

This document should be used together with:
- product requirements
- technical architecture
- database schema
- API contract
- UI/UX page specification
- RBAC matrix

The goal is to define:
- component taxonomy
- component responsibilities
- props and state expectations
- reuse strategy
- role-aware rendering patterns
- interaction and validation patterns
- chart and dashboard component standards
- mobile responsiveness guidance

---

## 2. Frontend Architecture Assumptions
Recommended frontend stack:
- Next.js + React + TypeScript
- Tailwind CSS or a design-system component library
- React Hook Form + Zod for forms
- TanStack Query for server state
- Zustand / Context / lightweight state store for local UI state where needed
- Recharts / Nivo / ECharts for data visualization

Component design should follow:
- **feature folders + shared design system**
- **presentational + container separation where useful**
- **server-state driven UI**
- **strict role/scope-aware rendering**
- **composable form and table patterns**

---

## 3. Component Design Principles
1. **Reusable over page-specific** where practical.
2. **Role-safe rendering**: components should accept data in already-filtered form, but also support visibility guards.
3. **Mobile-friendly by default**.
4. **Accessible interactions** with keyboard navigation and visible focus states.
5. **Composable primitives** first; feature components should build from common primitives.
6. **Predictable state boundaries**: server data, local UI state, and form state must be clearly separated.
7. **Consistent async UX**: loading, empty, success, and error states standardized.

---

## 4. Frontend Folder Structure (as built)

> The original `/features/*` + `/components/{layout,forms,tables,charts,feedback,guards}`
> layout was not adopted. Shared components live under three folders; domain
> composition lives in the route folders under `src/app/(app)/**` and `src/modules/**`.

```text
/src
  /app          # routes: (auth) public, (app) authenticated shell + pages
  /components
    /ui         # shadcn primitives (button, input, label, card, select, toggle-switch)
    /console    # admin/coach design system, barrel-exported via index.ts
                # (PageHeader, DataTable, FilterBar, SummaryCard, StatusBadge,
                #  PersonCell, ActionsMenu, Dialog, Tabs, TwoPane, ListContainer,
                #  AddModal, DeleteConfirmDialog)
    /app        # composed app components (nav, account menu, announcements,
                # dashboards) + /app/player (player portal shell + widgets)
    /schedule   # calendar / event-card / event-detail-drawer / schedule-view
  /db /lib /modules
```

### Separation (actual)
- `/components/ui` = shadcn design-system primitives
- `/components/console` = admin/coach design system (nav, page structures, tables, dialogs)
- `/components/app` (+ `/app/player`) = composed app + player-portal components
- `/components/schedule` = calendar / event components
- `src/app/(app)/**` + `src/modules/**` = domain-specific composition (no `/features/*` tree)

---

## 5. Design System Primitive Components
These components should be implemented first and reused everywhere.

## 5.1 Button
### Purpose
Primary action, secondary action, ghost action, destructive action.

### Variants (`src/components/ui/button.tsx`, shadcn/CVA)
- default (brand primary)
- secondary
- outline
- ghost
- destructive
- link

### Sizes
- default
- sm
- lg
- icon

### Props (actual)
```ts
React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
```

### Behavior
- icons are passed as children (no `iconLeft`/`iconRight`/`fullWidth` props)
- there is no built-in `loading` state — callers disable and swap label text during pending async actions

---

## 5.2 Input
### Purpose
Base text input for forms.

### Props (actual — `src/components/ui/input.tsx`)
```ts
React.ComponentProps<'input'>
```
Native input wrapper; label/hint/error layout is composed at the call site (e.g.
`console/filter-bar.tsx` pairs a `Label` with `Input`). Invalid state is driven by
`aria-invalid`. There is no `label`/`hint`/`error`/string-`onChange` prop.

---

## 5.3 Textarea
### Use Cases
- announcement body
- coach notes
- development updates
- chat draft (optional separate component)

---

## 5.4 Select
### Use Cases
- team selector
- season selector
- position selector
- status selector
- child switcher

### Actual
Native `<select>` styled to match Input (`src/components/ui/select.tsx`) — no
searchable/async/grouped modes. Used in `console/filter-bar.tsx` (`FilterSelect`). The
role/identity (child) switcher is a separate custom dropdown — see
`app/identity-switcher.tsx` and `app/account-menu.tsx`.

---

> **Status note (§5.5–§5.20):** Most primitives below are **not implemented as
> standalone components**. The only `src/components/ui` primitives are `button`,
> `input`, `label`, `card`, `select`, and `toggle-switch`. Substitutes that exist:
> Switch/Toggle → `ui/toggle-switch.tsx` (`ToggleSwitch`); FileUploader → only
> `app/photo-upload.tsx` (`PhotoUpload`, props `{ playerId }`); Avatar → folded into
> `console/person-cell.tsx`; Skeleton → inline `animate-pulse` rows in
> `console/data-table.tsx`; Toast → inline `role="alert"`/`role="status"` text (no
> toast system); EmptyState → `DataTable`'s `emptyMessage` + per-panel inline text.
> Textarea, MultiSelect, Checkbox, RadioGroup, DatePicker, and Tooltip have no
> component (native elements / `title` attributes are used at call sites). The
> entries below are forward-looking design intent.

## 5.5 MultiSelect
### Use Cases
- multi-team filtering
- selecting multiple players for radar comparison
- audience targeting in announcements

---

## 5.6 Checkbox
### Use Cases
- waiver acknowledgment
- feature settings
- bulk selection in lists

---

## 5.7 RadioGroup
### Use Cases
- RSVP status selection
- invoice reminder tone selection
- AI mode selection

---

## 5.8 Switch / Toggle  (`src/components/ui/toggle-switch.tsx` → `ToggleSwitch`)
### Use Cases
- club settings toggles (e.g. share evaluations, show photos, allow coach invites)
- player-to-player chat setting
- publish now toggle

---

## 5.9 DatePicker / DateTimePicker
### Use Cases
- season start/end
- event start/end
- due dates
- evaluation cycle windows

### Requirements
- timezone-aware display
- optional time selection
- validation support

---

## 5.10 FileUploader
### Use Cases
- player photo upload
- registration attachments
- team documents
- chat attachments
- waiver document upload

### Suggested Props
```ts
{
  accept?: string[]
  maxSizeMb?: number
  multiple?: boolean
  purpose: string
  onUploadComplete: (files: UploadedFile[]) => void
  onError?: (error: string) => void
}
```

---

## 5.11 Badge / StatusBadge
### Purpose
Display status consistently.

### Actual (`src/components/console/status-badge.tsx`)
No `variant` prop — `StatusBadge({ status, className })` maps the status string to a
tone (ACTIVE/PAID → green, PENDING/SUSPENDED → amber, OVERDUE → red,
ARCHIVED/INACTIVE → muted) with a neutral fallback; callers pass `className` to
override the tone. There is no separate generic `Badge`.

### Use Cases
- team / player / coach / club status
- attendance status
- evaluation bucket

---

## 5.12 Avatar
### Use Cases
- player photo
- user icon in chat
- coach and parent display

### Behavior
- image if present
- initials fallback

---

## 5.13 Card
### Purpose
Dashboard and content grouping.

### Actual (`src/components/ui/card.tsx`)
Composable shadcn slots: `Card`, `CardHeader`, `CardTitle`, `CardDescription`,
`CardContent`, `CardFooter` (no `variant` prop).

---

## 5.14 Tabs
### Use Cases
- team detail tabs
- player detail tabs
- payments/registration/waiver tabs
- evaluation module tabs

---

## 5.15 Modal & Drawer
### Actual (`src/components/console/dialog.tsx`)
Modal and Drawer are the **same** Radix-based component — `Dialog`/`DialogContent`
with `variant: 'drawer' | 'center'` (`drawer` = right-side sheet, default; `center` =
centered modal). Provides focus trap, ESC-to-close, ARIA. Helpers: `AddModal`
(centered create form), `DeleteConfirmDialog` (typed-name confirm),
`EventDetailDrawer` (drawer). §5.16 below is merged into this entry.

### Use Cases
- confirm delete (typed-name gate)
- assign coach
- small create/edit workflows

---

## 5.16 Drawer / SidePanel
### Use Cases
- quick player profile view
- invoice detail
- event detail
- submission review
- goal detail

### Requirements
- responsive width
- close via overlay/ESC
- header + body + footer pattern

---

## 5.17 Tooltip
### Use Cases
- explain restricted fields
- clarify evaluation weights
- show status descriptions

---

## 5.18 Skeleton Loader
### Use Cases
- tables
- cards
- detail views
- chat message threads

---

## 5.19 EmptyState
### Suggested Props
```ts
{
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}
```

---

## 5.20 Toast / Snackbar
### Use Cases
- save success
- RSVP submitted
- payment initiated
- message sent
- validation error summary

---

## 6. Layout Components

## 6.1 App shells (two, by role)
### Actual
There is no single `AppShell` component. Two shells are composed in
`src/app/(app)/layout.tsx`: the **Console** shell (`ConsoleSidebar` +
`ConsoleMobileNav`) for Master Admin / Club Admin / Coach, and the **Player app**
shell (`app/player/player-app-shell.tsx`, `PlayerAppShell`) for Players. Each renders
navigation, the top bar, the content area, the announcements bell, and the active
role/club context.

---

## 6.2 ConsoleSidebar
### Actual (`src/components/app/console-sidebar.tsx`)
Desktop primary navigation for the Console. Props `{ items: NavItem[]; profile:
SidebarProfile; profileHref? }`, where `NavItem = { label; href? }` (a missing `href`
renders a locked "coming soon" item). Nav items are pre-filtered by role upstream.

---

## 6.3 Mobile navigation (two)
### Actual
Admin/coach use `ConsoleMobileNav` (`app/console-mobile-nav.tsx`) — a hamburger
drawer. The **player** app uses `BottomTabBar` (`app/player/bottom-tab-bar.tsx`) +
desktop `SideRails` (`app/player/side-rails.tsx`), both driven by
`app/player/nav-items.ts` (`PLAYER_NAV_ITEMS`: Home / Squad / Play / Chat / Notes /
Notifications / Me). There is no coach bottom-nav set.

---

## 6.4 TopBar
### Actual
There is no `TopBar` component. The header is assembled inline in `(app)/layout.tsx` /
`PlayerAppShell` from `AccountMenu`, `AnnouncementsBell`, and (on the dashboard)
`DashboardIdentityRow`/`IdentitySwitcher`. There are no breadcrumbs or quick-create.

---

## 6.5 PageHeader
### Actual (`src/components/console/page-header.tsx`)
```ts
{
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}
```
Uses `description` (not `subtitle`); there is no `breadcrumbs` prop.

---

## 6.6 SectionHeader
> **Status: not implemented** as a component.

---

## 7. Guard and Access Components

> **Status: no client guard components exist.** Role/scope gating is done server-side
> (middleware → route/action guard → service-layer scope assertions) and by
> pre-filtering nav items; the UI renders already-authorized data. The
> `RoleGuard`/`ScopeGuard`/`FeatureFlagGuard` components below are forward-looking
> intent — the "backend remains authoritative" principle holds.

## 7.1 RoleGuard
### Purpose
Conditionally render content based on role.

### Suggested Props
```ts
{
  allowedRoles: RoleCode[]
  children: ReactNode
  fallback?: ReactNode
}
```

### Important
Frontend guard is for UX convenience only. Backend remains authoritative.

---

## 7.2 ScopeGuard
### Purpose
Conditionally render action controls depending on team/child scope.

### Use Cases
- show Edit My Child button only for own child
- show team management actions only for assigned coach

---

## 7.3 FeatureFlagGuard
### Purpose
Hide modules such as AI or billing based on club/system settings.

---

## 8. Data Table Components

## 8.1 DataTable
### Purpose
Reusable table wrapper for admin and operational lists.

### Features (actual)
- loading state (inline `animate-pulse` rows)
- empty state (`emptyMessage`)
- row click
- error message
- (no sorting, no checkbox selection, no card-collapse — narrow screens scroll
  horizontally; pagination is the separate `Pagination` component in `filter-bar.tsx`;
  row actions are just a `Column` whose cell renders `ActionsMenu`)

### Props (actual — `src/components/console/data-table.tsx`)
```ts
{
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  className?: string
  maxHeightClass?: string
}
```

---

## 8.2 FilterBar
### Purpose
Standard filter/search/action bar above lists.

### Suggested Regions
- left: search input
- middle: filter dropdowns/chips
- right: primary CTA(s)

---

## 8.3 TableColumn Config Pattern
Actual generic column shape (`Column<T>`):
```ts
{
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
}
```
(Note `header`/`cell`, not `title`/`render`; no `sortable`/`width`/`hideOnMobile`.)

---

## 8.4 StatusCell
> **Status: not a component** — use `StatusBadge` (§5.11) inside a column cell.

---

## 8.5 PersonCell
### Actual (`src/components/console/person-cell.tsx`)
Renders avatar + name + `subtext`. Props `{ name; subtext?; imageUrl?; fallback?;
className? }` (note `subtext`, not "subtitle"; monogram/image fallback is built in).

### Use Cases
- player rows
- coach rows
- club / user rows
- message sender rows

---

## 8.6 ActionsMenu
### Purpose
Row-level kebab menu.

### Use Cases
- edit
- archive
- view details
- send reminder
- assign coach

---

## 9. Form Components

## 9.1 FormField Wrapper
### Purpose
Unified label, input, hint, and error layout.

### Use Cases
All forms.

---

## 9.2 FormSection
### Purpose
Group related fields.

### Use Cases
- player profile basic info
- emergency contact section
- payment setup section
- announcement audience section

---

## 9.3 DynamicFormRenderer
### Purpose
Render registration forms from `schema_json`.

### Responsibilities
- render input types dynamically
- support validation rules from schema
- preserve draft state
- return normalized answers payload

### Supported Field Types
- text
- textarea
- email
- phone
- select
- multiselect
- checkbox
- radio
- date
- file
- number

---

## 9.4 Wizard / StepperForm
### Use Cases
- registration submission
- complex onboarding
- multi-step waiver + payment flow (if combined)

### Features
- current step indicator
- next/previous
- save draft
- per-step validation
- summary step

---

## 9.5 InlineEditableField
### Use Cases
- jersey number
- player status
- goal status
- small settings toggles

---

## 10. Dashboard Components

## 10.1 SummaryCard
### Purpose
Metric tile used across dashboards.

### Props (actual — `src/components/console/summary-card.tsx`)
```ts
{
  label: string
  value: ReactNode
  hint?: string
  href?: string
  labelPosition?: 'top' | 'bottom'
  labelTone?: 'green' | 'muted'
  className?: string
}
```
Uses `label`/`hint` (not `title`/`subtitle`); navigates via `href` (renders a `Link`),
not `onClick`; there is no `icon`/`trend`.

---

## 10.2 DashboardGrid
### Purpose
Responsive arrangement of summary cards.

---

## 10.3 ActivityFeed
### Use Cases
- recent club activity
- recent payments
- recent registrations
- recent roster changes

---

## 10.4 UpcomingEventsList
### Use Cases
- club dashboard
- coach dashboard
- parent dashboard

---

## 10.5 AlertsPanel
### Use Cases
- overdue invoices
- incomplete registrations
- pending waivers
- missing RSVPs
- evaluation cycle incomplete

---

## 11. Roster Components

## 11.1 RosterTable
### Purpose
Specialized table for team roster.

### Variants
- `coach`
- `admin`
- `player_safe`

### Behavior
Different columns and row actions based on variant.

### Coach/Admin Columns
- photo
- player name
- preferred name
- jersey number
- position
- status
- player-account count
- actions

### Player-Safe Columns
- photo (optional)
- display name
- preferred name
- jersey number
- primary position
- actions only for own child

---

## 11.2 PlayerProfileCard
### Use Cases
- drawer header
- parent child card
- player quick view

---

## 11.3 PlayerAccountLinkList
> **Status: not implemented** as a standalone component. (The product eliminated the
> "parent" role — everything is "player"; guardianship survives only as a link flag.)

### Purpose
Display linked player accounts (guardians) for a player.

### Features
- relationship type
- remove link action if allowed

---

## 11.4 PlayerQuickEditDrawer
### Use Cases
Coach/admin quick edits from roster page.

### Sections
- basic info
- jersey / position
- status
- emergency contact (restricted)
- notes shortcut

---

## 12. Schedule and Attendance Components

## 12.1 CalendarView
### Purpose
Reusable event calendar.

### Modes
- month
- week
- agenda/list

### Features
- team color tagging
- event type badges
- click event -> open detail drawer

---

## 12.2 EventCard
### Use Cases
- schedule list
- dashboard upcoming events
- parent schedule view

---

## 12.3 EventDetailDrawer
### Sections
- summary
- logistics
- attachments
- RSVP summary
- attendance shortcut
- related messages

---

## 12.4 RsvpControl
### Actual (`src/app/(app)/schedule/rsvp-control.tsx`)
Fast status selection for a player's RSVP (named `RsvpControl`, not `RSVPSelector`).

### Options
- Going
- Not Going
- Maybe
- Late

---

## 12.5 AttendanceTable
> **Status: not a standalone component.** Attendance is recorded inline on the event
> surfaces; the attendance trend uses the generic `app/sparkline.tsx`.

### Purpose
Fast attendance recording by event.

### Columns
- player
- RSVP status
- attendance status buttons/select
- notes

### Features
- bulk mark all present
- keyboard-friendly quick entry
- mobile compact mode

---

## 12.6 AttendanceSummaryChart
### Use Cases
- coach dashboard
- club admin attendance page

---

## 13. Registration Components
> **Status: not implemented (Phase 2+).** None of the components in §13 exist. This section is forward-looking design intent.

## 13.1 RegistrationProgramCard
### Use Cases
- parent available programs
- admin program list (card mode)

---

## 13.2 RegistrationSubmissionTable
### Columns
- player
- parent
- program
- status
- submitted_at
- reviewed_by
- actions

---

## 13.3 RegistrationSubmissionDrawer
### Sections
- submission summary
- dynamic answers view
- attached files
- review actions
- payment/waiver dependency summary

---

## 13.4 RegistrationProgressStepper
### Use Cases
- parent registration flow

---

## 14. Billing Components
> **Status: not implemented (Phase 2+).** None of the components in §14 exist. This section is forward-looking design intent.

## 14.1 InvoiceTable
### Variants
- admin
- parent

### Admin Columns
- invoice number
- family/parent
- player
- total
- paid
- due
- due date
- status
- actions

### Parent Columns
- invoice number
- child
- total
- due
- due date
- status
- pay action

---

## 14.2 InvoiceDetailDrawer
### Sections
- summary totals
- line items
- payment history
- payment plan
- family links
- action buttons

---

## 14.3 PaymentHistoryList
### Use Cases
- invoice detail
- parent payments tab

---

## 14.4 PaymentPlanCard
### Use Cases
- parent payment plan view
- admin payment plan setup detail

---

## 14.5 PaymentCheckoutPanel
### Purpose
Launch payment flow.

### Features
- amount selector if partial payments allowed
- payment method selection
- proceed action

---

## 15. Waiver Components
> **Status: not implemented (Phase 2+).** None of the components in §15 exist. This section is forward-looking design intent.

## 15.1 WaiverCard
### Use Cases
- parent pending waivers
- admin waiver catalog

---

## 15.2 WaiverViewer
### Purpose
Render waiver content in modal/page.

### Features
- markdown/html rendering
- scroll tracking optional
- accept checkbox
- accept action button

---

## 15.3 WaiverComplianceTable
### Columns
- player
- parent
- waiver
- version
- accepted_at
- status

---

## 16. Chat Components
> **Status: not implemented as these named components.** Team chat exists as routes
> under `src/app/(app)/chat/**` (team-thread list + thread view + composer with ~5s
> polling), not as the `ChatLayout`/`ConversationList`/`MessageThread`/`MessageBubble`/
> `MessageComposer` component set below. This section is forward-looking.

## 16.1 ChatLayout
### Structure
- conversations list
- active thread
- composer

---

## 16.2 ConversationList
### Use Cases
- multiple team chats
- future DM support

---

## 16.3 MessageThread
### Features
- infinite scroll / cursor loading
- message grouping by date
- sender display
- attachments
- reply context optional

---

## 16.4 MessageBubble
### Props
```ts
{
  message: Message
  isOwnMessage: boolean
  showAvatar?: boolean
  showSenderName?: boolean
}
```

---

## 16.5 MessageComposer
### Features
- multiline input
- attachment upload
- send button
- optional AI draft assist entry point

---

## 17. Evaluation and Development Components

## 17.1 EvaluationForm
### Purpose
Primary scoring form.

### Sections
- player info header
- position selector
- score grid
- summary comment
- coach-only notes
- player-visible notes
- save/submit actions

---

## 17.2 EvaluationScoreGrid
### Purpose
Render criteria rows and weighted calculation display.

### Columns
- criterion label
- raw score input
- weight display
- weighted score display

### Features
- auto-calculate weighted total
- validation against min/max score
- dynamic criteria support

---

## 17.3 PositionWeightsEditor
### Purpose
Admin editor for position-based weights.

### Layout
- one row per position
- one column per criterion
- total column

### Features
- inline number inputs
- total validation must equal 100
- save changes action
- warning badge if invalid

---

## 17.4 EvaluationLeaderboardTable
### Columns
- player
- position
- overall score or selected metric
- rank
- bucket

### Features
- metric selector
- position filter
- cycle filter

---

## 17.5 BucketDistributionCard
### Purpose
Show Top 8 / Middle 8 / Bottom 8 counts.

---

## 17.6 PhysicalityAggressionScatterChart
### Purpose
Show player distribution on physicality vs aggression axes.

### Features
- tooltip on point hover
- click point -> open player detail
- cycle/team filters

---

## 17.7 RadarComparisonChart
### Purpose
Compare 2–3 players.

### Props
```ts
{
  criteria: string[]
  players: {
    playerId: string
    displayName: string
    values: number[]
    color?: string
  }[]
}
```

### Features
- overlay lines/polygons
- legend
- empty state when <2 selected
- numeric table below chart on mobile

---

## 17.8 PlayerSelectorGroup
### Use Cases
- radar comparison page
- comparison widgets

### Features
- up to 3 player selects
- same team scope only
- prevent duplicate selections

---

## 17.9 DevelopmentGoalCard
### Use Cases
- player detail development tab
- coach development tracking page
- parent child development summary

---

## 17.10 GoalTimeline
### Purpose
Render progress updates chronologically.

---

## 18. AI Components
> **Status: not implemented (Phase 2+).** None of the components in §18 exist. This section is forward-looking design intent.

## 18.1 AIAssistantPanel
### Purpose
Generic AI prompt + output panel.

### Sections
- prompt input
- context controls
- generate button
- result display
- copy / edit / publish actions

### Suggested Props
```ts
{
  title: string
  placeholder?: string
  onGenerate: (payload: any) => Promise<AIResult>
  allowPublish?: boolean
}
```

---

## 18.2 AIDraftEditor
### Purpose
Show editable AI-generated content before publish/send.

### Use Cases
- announcements
- team recaps
- player summaries
- payment reminders

---

## 18.3 AIResultCard
### Use Cases
- quick summary output
- draft preview
- explanation panel

---

## 19. Notification Components

## 19.1 AnnouncementsBell
### Actual (`src/components/app/announcements-bell.tsx`)
The bell is `AnnouncementsBell` (props `{ initialCount: number; variant: 'icon' |
'tab' }`), not `NotificationBell`. Unread count badge; opens the announcements feed.
`NotificationList`/`NotificationPreferencesForm` are not implemented as components —
feeds are the announcement panels (`app/announcements-panel.tsx`,
`app/platform-announcements-panel.tsx`).

---

## 19.2 NotificationList
### Use Cases
- topbar dropdown
- full notifications page

---

## 19.3 NotificationPreferencesForm
### Use Cases
- profile/settings area

---

## 19a. Built components not catalogued above
These shipped components have no entry above (file → export):
- `console/two-pane.tsx` → `TwoPane` (list+form CRUD layout)
- `console/list-container.tsx` → `ListContainer`; `app/scroll-panel.tsx` → `ScrollPanel`
- `console/add-modal.tsx` → `AddModal`; `console/delete-confirm-dialog.tsx` → `DeleteConfirmDialog` (typed-name hard-delete gate)
- `app/identity-switcher.tsx` → `IdentitySwitcher`; `app/dashboard-identity-row.tsx` → `DashboardIdentityRow`; `app/account-menu.tsx` → `AccountMenu` (role switching)
- `app/select-role-gate.tsx` → `SelectRoleGate`
- `app/invite-link-dialog.tsx` → `InviteLinkDialog`; `app/copy-invite-link-button.tsx` → `CopyInviteLinkButton`
- `app/footer.tsx` → `Footer`; `app/sparkline.tsx` → `Sparkline`; `app/coach-quick-tiles.tsx` → `CoachQuickTiles`
- `app/upcoming-events.tsx` / `app/upcoming-events-carousel.tsx`; `app/dashboard-placeholder.tsx`
- `app/announcements-panel.tsx`, `app/platform-announcements-panel.tsx`, `app/platform-banner.tsx`
- `app/photo-upload.tsx` → `PhotoUpload`
- `app/player/appearance-switcher.tsx` → `AppearanceSwitcher`; `app/player/theme-provider.tsx` → `PlayerThemeProvider` (player-only Vibrant/Classic theming)
- `app/player/widgets.tsx` → `AttendanceRing`, `XpBar`, `CollectibleCard`, `StoriesStrip`, `StatTile`; `app/player/next-up-carousel.tsx` → `NextUpCarousel`
- `ui/toggle-switch.tsx` → `ToggleSwitch`; `ui/label.tsx` → `Label`

---

## 20. State Management Guidelines

## 20.1 Server State
Use TanStack Query (or equivalent) for:
- lists
- detail retrieval
- dashboard data
- messages
- events
- invoices
- evaluations

### Best Practices
- query keys by domain and scope
- invalidate minimally after mutation
- use optimistic updates only where safe

---

## 20.2 Local UI State
Use local state / lightweight store for:
- modal open state
- drawer selection
- filter state
- selected players for radar comparison
- child switcher state

---

## 20.3 Form State
Use React Hook Form for:
- player edit forms
- event forms
- registration submissions
- evaluation forms
- settings forms

---

## 21. Component Props and Typing Strategy

### Recommended Pattern
- define domain DTO types centrally in `/types`
- define UI-specific view models where safe projection differs
- avoid passing raw API response objects deeply through tree without shaping

### Example Type Categories
```ts
UserSummary
ClubSummary
TeamSummary
PlayerFullView
PlayerSafeView
PlayerAccountSummary
EventSummary
EventDetail
InvoiceSummary
InvoiceDetail
EvaluationSummary
RadarComparisonPayload
DevelopmentGoal
NotificationItem
```

---

## 22. Loading / Error / Empty Patterns

## 22.1 Loading
- use skeletons for tables/cards/detail panels
- use button loading states for mutations

## 22.2 Empty
- use standard `EmptyState` component
- include CTA where appropriate

## 22.3 Error
- inline form errors
- section-level retry panels for data fetch failures
- toast/snackbar for mutation failures

---

## 23. Responsive Behavior Standards

### Desktop
- full sidebar
- multi-column dashboards
- side drawers
- larger tables

### Tablet
- collapsible sidebar
- reduced chart density
- drawer widths adjusted

### Mobile
- bottom navigation
- stacked cards instead of wide tables where needed
- full-screen drawer/modal for complex detail
- sticky bottom action areas for submit/save/pay

---

## 24. Accessibility Standards for Components
All components should support:
- keyboard navigation
- focus indicators
- ARIA labels where needed
- proper label/input associations
- semantic headings and landmarks
- accessible color contrast

Special attention:
- modal focus trap
- dropdown keyboard support
- chart alternative summaries via numeric tables or text summaries

---

## 25. Suggested Build Order for Components
1. UI primitives (button, input, modal, drawer, badge, card, empty state)
2. layout components (app shell, topbar, sidebar, mobile nav, page header)
3. shared data patterns (data table, filter bar, form wrappers)
4. auth components
5. roster components
6. schedule and attendance components
7. billing / waiver / registration components
8. chat components
9. evaluation + radar + development components
10. dashboard and reports components
11. AI assistant components

---

## 26. Final Recommendation
Build the frontend as a reusable component system with strong separation between:
- shared primitives
- domain-level feature components
- page-level composition

The most critical component priorities are:
- AppShell and navigation
- DataTable and FilterBar
- RosterTable with role-safe variants
- CalendarView and AttendanceTable
- DynamicFormRenderer and InvoiceDetailDrawer
- EvaluationScoreGrid and RadarComparisonChart
- AIAssistantPanel and Notification components

This component specification is detailed enough for Claude Code to scaffold the frontend component library, domain components, and page compositions in a consistent way.
