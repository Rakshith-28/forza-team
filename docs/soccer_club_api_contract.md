# Soccer Club Management App - API Contract Specification

## 1. Document Purpose
This document defines the API contract for the Soccer Club Management App. It is designed to be implementation-ready for backend and frontend development and should be used together with the product requirements, technical architecture, and database schema specifications.

The contract covers:
- authentication and identity
- tenant-aware club and team operations
- roster, player, parent, and coach workflows
- scheduling, RSVP, and attendance
- chat and announcements
- registration, payments, and waivers
- player evaluations, radar comparison, and development tracking
- notifications and AI assistant endpoints

---

## 2. API Standards

### 2.1 Base URL
```http
/api/v1
```

### 2.2 Content Type
```http
Content-Type: application/json
```

For file upload:
```http
Content-Type: multipart/form-data
```

### 2.3 Authentication
Preferred approach:
- Bearer access token for API requests
- Refresh token via secure cookie or explicit refresh endpoint

```http
Authorization: Bearer <access_token>
```

### 2.4 Response Envelope Standard
Recommended default response envelope:

```json
{
  "data": {},
  "meta": {},
  "errors": []
}
```

### 2.5 Error Envelope Standard
```json
{
  "data": null,
  "meta": {},
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "One or more fields are invalid.",
      "field": "email"
    }
  ]
}
```

### 2.6 Pagination Convention
```http
GET /api/v1/teams?page=1&page_size=25&sort=name&order=asc
```

Example paginated response:
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "page_size": 25,
    "total_records": 320,
    "total_pages": 13
  },
  "errors": []
}
```

### 2.7 Filtering Convention
Use query parameters for filtering.

Example:
```http
GET /api/v1/players?club_id=<club_id>&team_id=<team_id>&status=ACTIVE&position=CB
```

### 2.8 Date / Time Convention
- All timestamps returned in ISO 8601 UTC or with timezone offset
- UI can localize using user/club timezone

Example:
```json
"start_at": "2026-09-14T18:30:00Z"
```

### 2.9 Idempotency
Use `Idempotency-Key` header for payment creation, webhook reconciliation-sensitive operations, or any action that must not be duplicated.

---

## 3. Authentication and Identity APIs

## 3.1 Login
### Endpoint
```http
POST /api/v1/auth/login
```

### Request
```json
{
  "email": "parent@example.com",
  "password": "SecretPassword123"
}
```

### Success Response
```json
{
  "data": {
    "access_token": "jwt-token",
    "refresh_token": "refresh-token-or-null",
    "user": {
      "id": "uuid",
      "email": "parent@example.com",
      "first_name": "Alex",
      "last_name": "Smith"
    },
    "active_role": {
      "role_code": "PARENT",
      "club_id": "uuid",
      "team_id": null
    }
  },
  "meta": {},
  "errors": []
}
```

### Errors
- `INVALID_CREDENTIALS`
- `ACCOUNT_DISABLED`
- `EMAIL_NOT_VERIFIED`

---

## 3.2 Refresh Token
### Endpoint
```http
POST /api/v1/auth/refresh
```

### Request
```json
{
  "refresh_token": "refresh-token"
}
```

### Response
```json
{
  "data": {
    "access_token": "new-jwt-token"
  },
  "meta": {},
  "errors": []
}
```

---

## 3.3 Logout
### Endpoint
```http
POST /api/v1/auth/logout
```

### Response
```json
{
  "data": {
    "success": true
  },
  "meta": {},
  "errors": []
}
```

---

## 3.4 Forgot Password
### Endpoint
```http
POST /api/v1/auth/forgot-password
```

### Request
```json
{
  "email": "user@example.com"
}
```

### Response
```json
{
  "data": {
    "message": "If the email exists, a reset link has been sent."
  },
  "meta": {},
  "errors": []
}
```

---

## 3.5 Reset Password
### Endpoint
```http
POST /api/v1/auth/reset-password
```

### Request
```json
{
  "token": "reset-token",
  "new_password": "NewPassword123!"
}
```

### Response
```json
{
  "data": {
    "success": true
  },
  "meta": {},
  "errors": []
}
```

---

## 3.6 Current User Profile
### Endpoint
```http
GET /api/v1/auth/me
```

### Response
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "coach@example.com",
      "first_name": "Taylor",
      "last_name": "Jordan",
      "phone": "+1-555-111-2222"
    },
    "roles": [
      {
        "assignment_id": "uuid",
        "role_code": "COACH",
        "club_id": "uuid",
        "team_id": "uuid",
        "is_primary": true
      }
    ]
  },
  "meta": {},
  "errors": []
}
```

---

## 3.7 Switch Active Role Context
Useful when one user later supports multiple scopes.

### Endpoint
```http
POST /api/v1/auth/switch-role
```

### Request
```json
{
  "assignment_id": "uuid"
}
```

### Response
```json
{
  "data": {
    "access_token": "new-token-with-context"
  },
  "meta": {},
  "errors": []
}
```

---

## 4. Master Admin APIs

## 4.1 List Clubs
### Endpoint
```http
GET /api/v1/master/clubs
```

### Access
- Master Admin only

### Query Params
- `status`
- `search`
- `page`
- `page_size`

### Response
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Charlotte United",
      "short_code": "CHARU",
      "status": "ACTIVE",
      "timezone": "America/New_York"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 25,
    "total_records": 1,
    "total_pages": 1
  },
  "errors": []
}
```

---

## 4.2 Create Club
### Endpoint
```http
POST /api/v1/master/clubs
```

### Request
```json
{
  "name": "Charlotte United",
  "short_code": "CHARU",
  "timezone": "America/New_York",
  "phone": "+1-555-000-1111",
  "website": "https://charlotteunited.example.com"
}
```

### Response
```json
{
  "data": {
    "id": "uuid",
    "name": "Charlotte United",
    "short_code": "CHARU",
    "status": "ACTIVE"
  },
  "meta": {},
  "errors": []
}
```

---

## 4.3 Get Club Detail
### Endpoint
```http
GET /api/v1/master/clubs/{clubId}
```

---

## 4.4 Update Club
### Endpoint
```http
PUT /api/v1/master/clubs/{clubId}
```

---

## 4.5 Suspend / Archive Club
### Endpoint
```http
PATCH /api/v1/master/clubs/{clubId}/status
```

### Request
```json
{
  "status": "SUSPENDED"
}
```

---

## 4.6 Create Initial Club Admin
### Endpoint
```http
POST /api/v1/master/clubs/{clubId}/admins
```

### Request
```json
{
  "email": "clubadmin@example.com",
  "first_name": "Pat",
  "last_name": "Lee"
}
```

### Response
```json
{
  "data": {
    "invitation_id": "uuid",
    "status": "PENDING"
  },
  "meta": {},
  "errors": []
}
```

---

## 5. Club Admin APIs

## 5.1 Club Dashboard Summary
### Endpoint
```http
GET /api/v1/clubs/{clubId}/dashboard
```

### Access
- Club Admin
- Master Admin

### Response
```json
{
  "data": {
    "totals": {
      "teams": 12,
      "players": 220,
      "coaches": 18,
      "parents": 340,
      "open_invoices": 42,
      "upcoming_events": 16
    }
  },
  "meta": {},
  "errors": []
}
```

---

## 5.2 Get / Update Club Settings
### Endpoints
```http
GET /api/v1/clubs/{clubId}/settings
PUT /api/v1/clubs/{clubId}/settings
```

### Update Request
```json
{
  "allow_parent_to_parent_chat": false,
  "allow_parent_child_evaluation_view": true,
  "show_player_photos_to_parents": true,
  "enable_ai_features": true,
  "default_currency": "USD"
}
```

---

## 5.3 Seasons
### Endpoints
```http
GET /api/v1/clubs/{clubId}/seasons
POST /api/v1/clubs/{clubId}/seasons
GET /api/v1/seasons/{seasonId}
PUT /api/v1/seasons/{seasonId}
```

### Create Request
```json
{
  "name": "Fall 2026",
  "start_date": "2026-08-01",
  "end_date": "2026-12-15"
}
```

---

## 5.4 Teams
### Endpoints
```http
GET /api/v1/clubs/{clubId}/teams
POST /api/v1/clubs/{clubId}/teams
GET /api/v1/teams/{teamId}
PUT /api/v1/teams/{teamId}
PATCH /api/v1/teams/{teamId}/status
```

### Create Team Request
```json
{
  "season_id": "uuid",
  "name": "U14 Blue",
  "team_code": "U14B",
  "age_group": "U14",
  "division": "Premier",
  "competitive_level": "Competitive"
}
```

### Team Detail Response
```json
{
  "data": {
    "id": "uuid",
    "club_id": "uuid",
    "season_id": "uuid",
    "name": "U14 Blue",
    "team_code": "U14B",
    "age_group": "U14",
    "division": "Premier",
    "competitive_level": "Competitive",
    "status": "ACTIVE"
  },
  "meta": {},
  "errors": []
}
```

---

## 5.5 Team Coach Assignment
### Endpoints
```http
GET /api/v1/teams/{teamId}/coaches
POST /api/v1/teams/{teamId}/coaches
DELETE /api/v1/teams/{teamId}/coaches/{userId}
```

### Assign Coach Request
```json
{
  "user_id": "uuid",
  "role_type": "HEAD_COACH"
}
```

---

## 5.6 Club Users Search
### Endpoint
```http
GET /api/v1/clubs/{clubId}/users
```

### Query Params
- `role_code`
- `search`
- `page`
- `page_size`

---

## 6. Roster / Player / Parent APIs

## 6.1 Team Roster List
### Endpoint
```http
GET /api/v1/teams/{teamId}/players
```

### Access Behavior
- Coach: full assigned-team roster view
- Club Admin: full club view
- Parent: safe roster view for other players + full own-child view

### Query Params
- `search`
- `status`
- `position`
- `include=parents,evaluations`

### Coach / Admin Response (example)
```json
{
  "data": [
    {
      "id": "uuid",
      "first_name": "Jordan",
      "last_name": "Miles",
      "preferred_name": "Jo",
      "jersey_number": "8",
      "primary_position": "CM",
      "status": "ACTIVE",
      "medical_notes": "Peanut allergy",
      "parent_links": [
        {
          "parent_id": "uuid",
          "display_name": "Alex Miles",
          "phone": "+1-555-888-1111"
        }
      ]
    }
  ],
  "meta": {},
  "errors": []
}
```

### Parent Safe Response (example)
```json
{
  "data": [
    {
      "id": "uuid",
      "display_name": "Jordan Miles",
      "preferred_name": "Jo",
      "jersey_number": "8",
      "primary_position": "CM",
      "photo_url": "https://..."
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 6.2 Add Player to Team
### Endpoint
```http
POST /api/v1/teams/{teamId}/players
```

### Request
```json
{
  "first_name": "Jordan",
  "last_name": "Miles",
  "preferred_name": "Jo",
  "date_of_birth": "2012-06-10",
  "jersey_number": "8",
  "primary_position": "CM",
  "secondary_position": "DM"
}
```

### Response
```json
{
  "data": {
    "player_id": "uuid",
    "team_membership_id": "uuid"
  },
  "meta": {},
  "errors": []
}
```

---

## 6.3 Get Player Detail
### Endpoint
```http
GET /api/v1/players/{playerId}
```

### Access Rules
- Coach: only assigned team player
- Parent: own linked child full permitted fields only
- Parent viewing another child should be blocked from this endpoint or receive restricted projection based on app design

### Response
```json
{
  "data": {
    "id": "uuid",
    "first_name": "Jordan",
    "last_name": "Miles",
    "preferred_name": "Jo",
    "date_of_birth": "2012-06-10",
    "jersey_number": "8",
    "primary_position": "CM",
    "secondary_position": "DM",
    "status": "ACTIVE"
  },
  "meta": {},
  "errors": []
}
```

---

## 6.4 Update Player
### Endpoint
```http
PUT /api/v1/players/{playerId}
```

### Coach/Admin Request Example
```json
{
  "preferred_name": "Jo",
  "jersey_number": "10",
  "primary_position": "AM",
  "status": "ACTIVE"
}
```

### Parent Request Example (own child only)
```json
{
  "preferred_name": "Jo",
  "medical_notes": "Carries inhaler"
}
```

### Validation Rule
Backend must whitelist parent-editable fields.

---

## 6.5 Link Parent to Player
### Endpoint
```http
POST /api/v1/players/{playerId}/parents
```

### Request
```json
{
  "parent_id": "uuid",
  "relationship_type": "MOTHER",
  "is_primary_guardian": true,
  "can_pickup": true,
  "can_pay": true
}
```

---

## 6.6 Remove Parent Link
### Endpoint
```http
DELETE /api/v1/players/{playerId}/parents/{parentId}
```

---

## 6.7 Parent Linked Children
### Endpoint
```http
GET /api/v1/parents/me/children
```

### Response
```json
{
  "data": [
    {
      "player_id": "uuid",
      "display_name": "Jordan Miles",
      "team_memberships": [
        {
          "team_id": "uuid",
          "team_name": "U14 Blue"
        }
      ]
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 7. File Upload APIs

## 7.1 Upload File
### Endpoint
```http
POST /api/v1/files
```

### Request
`multipart/form-data`
- `file`
- `purpose`
- `club_id`

### Response
```json
{
  "data": {
    "file_id": "uuid",
    "storage_url": "signed-url-or-proxy-url"
  },
  "meta": {},
  "errors": []
}
```

---

## 7.2 Get File Metadata
### Endpoint
```http
GET /api/v1/files/{fileId}
```

---

## 8. Announcements and Chat APIs

## 8.1 List Announcements
### Endpoint
```http
GET /api/v1/announcements
```

### Query Params
- `club_id`
- `team_id`
- `status`
- `page`
- `page_size`

### Response
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Practice Cancelled",
      "body": "Tonight's practice is cancelled due to weather.",
      "audience_type": "TEAM_ONLY",
      "published_at": "2026-09-10T14:00:00Z"
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 8.2 Create Announcement
### Endpoint
```http
POST /api/v1/announcements
```

### Access
- Club Admin
- Coach (team announcement only)

### Request
```json
{
  "club_id": "uuid",
  "team_id": "uuid",
  "title": "Practice Cancelled",
  "body": "Tonight's practice is cancelled due to weather.",
  "audience_type": "TEAM_ONLY",
  "publish_now": true
}
```

---

## 8.3 List Team Messages
### Endpoint
```http
GET /api/v1/teams/{teamId}/messages
```

### Query Params
- `cursor`
- `limit`

### Response
```json
{
  "data": [
    {
      "id": "uuid",
      "sender": {
        "user_id": "uuid",
        "display_name": "Coach Taylor"
      },
      "body": "Please arrive 15 minutes early.",
      "created_at": "2026-09-10T13:45:00Z"
    }
  ],
  "meta": {
    "next_cursor": "opaque-cursor"
  },
  "errors": []
}
```

---

## 8.4 Send Team Message
### Endpoint
```http
POST /api/v1/teams/{teamId}/messages
```

### Request
```json
{
  "body": "Please arrive 15 minutes early.",
  "reply_to_message_id": null
}
```

### Response
```json
{
  "data": {
    "message_id": "uuid",
    "created_at": "2026-09-10T13:45:00Z"
  },
  "meta": {},
  "errors": []
}
```

---

## 9. Schedule / RSVP / Attendance APIs

## 9.1 List Team Events
### Endpoint
```http
GET /api/v1/teams/{teamId}/events
```

### Query Params
- `from`
- `to`
- `event_type`
- `status`

### Response
```json
{
  "data": [
    {
      "id": "uuid",
      "event_type": "PRACTICE",
      "title": "Tuesday Practice",
      "start_at": "2026-09-12T22:00:00Z",
      "end_at": "2026-09-12T23:30:00Z",
      "location_name": "Training Field 2",
      "status": "SCHEDULED"
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 9.2 Create Event
### Endpoint
```http
POST /api/v1/teams/{teamId}/events
```

### Access
- Coach (assigned team)
- Club Admin

### Request
```json
{
  "event_type": "PRACTICE",
  "title": "Tuesday Practice",
  "description": "Conditioning + passing drills",
  "start_at": "2026-09-12T22:00:00Z",
  "end_at": "2026-09-12T23:30:00Z",
  "timezone": "America/New_York",
  "location_name": "Training Field 2",
  "arrival_time": "2026-09-12T21:45:00Z"
}
```

---

## 9.3 Get Event Detail
### Endpoint
```http
GET /api/v1/events/{eventId}
```

### Response
```json
{
  "data": {
    "id": "uuid",
    "team_id": "uuid",
    "event_type": "GAME",
    "title": "League Match vs Falcons",
    "opponent_name": "Falcons",
    "home_away": "AWAY",
    "start_at": "2026-09-20T18:00:00Z",
    "end_at": "2026-09-20T20:00:00Z",
    "location_name": "Falcons Park",
    "status": "SCHEDULED"
  },
  "meta": {},
  "errors": []
}
```

---

## 9.4 Update Event
### Endpoint
```http
PUT /api/v1/events/{eventId}
```

---

## 9.5 Parent RSVP by Child
### Endpoint
```http
POST /api/v1/events/{eventId}/rsvps
```

### Access
- Parent for linked child only
- Coach/Admin if override capability allowed

### Request
```json
{
  "player_id": "uuid",
  "response_status": "GOING",
  "comment": "Will arrive on time"
}
```

### Response
```json
{
  "data": {
    "event_id": "uuid",
    "player_id": "uuid",
    "response_status": "GOING",
    "responded_at": "2026-09-10T14:30:00Z"
  },
  "meta": {},
  "errors": []
}
```

---

## 9.6 Get Event RSVPs
### Endpoint
```http
GET /api/v1/events/{eventId}/rsvps
```

### Access
- Coach/Admin
- Parent only for own child if exposing endpoint directly

### Response
```json
{
  "data": [
    {
      "player_id": "uuid",
      "display_name": "Jordan Miles",
      "response_status": "GOING",
      "responded_at": "2026-09-10T14:30:00Z"
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 9.7 Attendance List
### Endpoint
```http
GET /api/v1/events/{eventId}/attendance
```

### Access
- Coach/Admin
- Parent only for own child if filtered

---

## 9.8 Record Attendance
### Endpoint
```http
POST /api/v1/events/{eventId}/attendance
```

### Access
- Coach/Admin

### Request
```json
{
  "records": [
    {
      "player_id": "uuid",
      "attendance_status": "PRESENT",
      "notes": "Arrived early"
    },
    {
      "player_id": "uuid-2",
      "attendance_status": "LATE",
      "notes": "10 minutes late"
    }
  ]
}
```

### Response
```json
{
  "data": {
    "updated_count": 2
  },
  "meta": {},
  "errors": []
}
```

---

## 9.9 Parent Child Schedule Feed
### Endpoint
```http
GET /api/v1/parents/me/schedule
```

### Query Params
- `from`
- `to`
- `player_id` optional

### Response
```json
{
  "data": [
    {
      "player_id": "uuid",
      "player_name": "Jordan Miles",
      "team_name": "U14 Blue",
      "event_id": "uuid",
      "title": "Tuesday Practice",
      "start_at": "2026-09-12T22:00:00Z"
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 10. Registration APIs

## 10.1 List Registration Programs
### Endpoint
```http
GET /api/v1/clubs/{clubId}/registration-programs
```

### Access
- Public or authenticated depending on implementation

### Response
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Fall 2026 Registration",
      "opens_at": "2026-06-01T00:00:00Z",
      "closes_at": "2026-07-31T23:59:59Z",
      "status": "ACTIVE"
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 10.2 Create Registration Program
### Endpoint
```http
POST /api/v1/clubs/{clubId}/registration-programs
```

### Access
- Club Admin

### Request
```json
{
  "season_id": "uuid",
  "name": "Fall 2026 Registration",
  "description": "Main season registration",
  "opens_at": "2026-06-01T00:00:00Z",
  "closes_at": "2026-07-31T23:59:59Z"
}
```

---

## 10.3 Create Registration Form
### Endpoint
```http
POST /api/v1/registration-programs/{programId}/forms
```

### Request
```json
{
  "name": "Parent Registration Form",
  "version": 1,
  "schema_json": {
    "fields": [
      {
        "key": "uniform_size",
        "type": "select",
        "required": true,
        "options": ["YS", "YM", "YL", "AS", "AM", "AL"]
      }
    ]
  }
}
```

---

## 10.4 Submit Registration
### Endpoint
```http
POST /api/v1/registration-submissions
```

### Access
- Parent
- Club Admin (manual/internal support)

### Request
```json
{
  "club_id": "uuid",
  "registration_program_id": "uuid",
  "form_id": "uuid",
  "player_id": "uuid",
  "answers": [
    {
      "field_key": "uniform_size",
      "field_value": "AM"
    },
    {
      "field_key": "allergies",
      "field_value": "None"
    }
  ],
  "submit": true
}
```

### Response
```json
{
  "data": {
    "submission_id": "uuid",
    "status": "SUBMITTED"
  },
  "meta": {},
  "errors": []
}
```

---

## 10.5 Parent Registration List
### Endpoint
```http
GET /api/v1/parents/me/registrations
```

---

## 10.6 Registration Review Update
### Endpoint
```http
PATCH /api/v1/registration-submissions/{submissionId}/status
```

### Access
- Club Admin

### Request
```json
{
  "status": "APPROVED"
}
```

---

## 11. Billing / Payments APIs

## 11.1 List Family Invoices
### Endpoint
```http
GET /api/v1/parents/me/invoices
```

### Response
```json
{
  "data": [
    {
      "invoice_id": "uuid",
      "invoice_number": "INV-1001",
      "player_name": "Jordan Miles",
      "total_amount": 450.00,
      "amount_paid": 150.00,
      "amount_due": 300.00,
      "due_date": "2026-09-15",
      "status": "PARTIALLY_PAID"
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 11.2 Get Invoice Detail
### Endpoint
```http
GET /api/v1/invoices/{invoiceId}
```

### Access
- Parent for own family invoice
- Club Admin
- Master Admin

---

## 11.3 Create Invoice
### Endpoint
```http
POST /api/v1/invoices
```

### Access
- Club Admin

### Request
```json
{
  "club_id": "uuid",
  "family_account_id": "uuid",
  "player_id": "uuid",
  "currency": "USD",
  "due_date": "2026-09-15",
  "items": [
    {
      "description": "Fall 2026 Registration Fee",
      "quantity": 1,
      "unit_amount": 450.00,
      "category": "REGISTRATION"
    }
  ]
}
```

### Response
```json
{
  "data": {
    "invoice_id": "uuid",
    "invoice_number": "INV-1001",
    "total_amount": 450.00,
    "amount_due": 450.00,
    "status": "OPEN"
  },
  "meta": {},
  "errors": []
}
```

---

## 11.4 Create Payment Intent / Checkout
### Endpoint
```http
POST /api/v1/invoices/{invoiceId}/payments
```

### Access
- Parent for own invoice
- Club Admin for support/manual

### Headers
```http
Idempotency-Key: <unique-key>
```

### Request
```json
{
  "amount": 150.00,
  "payment_method": "CARD"
}
```

### Response
```json
{
  "data": {
    "payment_id": "uuid",
    "provider": "stripe",
    "checkout_url": "https://provider.example/checkout/abc123",
    "status": "PENDING"
  },
  "meta": {},
  "errors": []
}
```

---

## 11.5 Record Offline Payment
### Endpoint
```http
POST /api/v1/invoices/{invoiceId}/offline-payments
```

### Access
- Club Admin

### Request
```json
{
  "amount": 150.00,
  "payment_method": "CHECK",
  "reference_number": "CHK-22931",
  "paid_at": "2026-09-01T14:00:00Z"
}
```

---

## 11.6 List Payments for Invoice
### Endpoint
```http
GET /api/v1/invoices/{invoiceId}/payments
```

---

## 11.7 Payment Provider Webhook
### Endpoint
```http
POST /api/v1/webhooks/payments/{provider}
```

### Notes
- Signature verification required
- Idempotent processing required
- Not called by client directly

---

## 12. Waiver APIs

## 12.1 List Club Waivers
### Endpoint
```http
GET /api/v1/clubs/{clubId}/waivers
```

---

## 12.2 Create Waiver
### Endpoint
```http
POST /api/v1/clubs/{clubId}/waivers
```

### Request
```json
{
  "name": "Fall 2026 Liability Waiver",
  "waiver_type": "LIABILITY"
}
```

---

## 12.3 Add Waiver Version
### Endpoint
```http
POST /api/v1/waivers/{waiverId}/versions
```

### Request
```json
{
  "version_number": 1,
  "content_markdown": "# Liability Waiver\nPlease read carefully.",
  "effective_at": "2026-06-01T00:00:00Z"
}
```

---

## 12.4 Parent List Required Waivers
### Endpoint
```http
GET /api/v1/parents/me/waivers
```

### Response
```json
{
  "data": [
    {
      "player_id": "uuid",
      "player_name": "Jordan Miles",
      "waiver_id": "uuid",
      "waiver_name": "Fall 2026 Liability Waiver",
      "version_number": 1,
      "status": "PENDING"
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 12.5 Accept Waiver
### Endpoint
```http
POST /api/v1/waivers/{waiverId}/accept
```

### Access
- Parent for linked child only

### Request
```json
{
  "player_id": "uuid",
  "waiver_version_id": "uuid",
  "accepted": true
}
```

### Response
```json
{
  "data": {
    "acceptance_id": "uuid",
    "accepted_at": "2026-06-05T14:30:00Z"
  },
  "meta": {},
  "errors": []
}
```

---

## 13. Evaluation / Development APIs

## 13.1 Evaluation Templates
### Endpoints
```http
GET /api/v1/clubs/{clubId}/evaluation-templates
POST /api/v1/clubs/{clubId}/evaluation-templates
GET /api/v1/evaluation-templates/{templateId}
PUT /api/v1/evaluation-templates/{templateId}
```

### Create Template Request
```json
{
  "name": "Standard Development Template",
  "description": "Quarterly evaluation template"
}
```

---

## 13.2 Evaluation Criteria
### Endpoints
```http
GET /api/v1/evaluation-templates/{templateId}/criteria
POST /api/v1/evaluation-templates/{templateId}/criteria
PUT /api/v1/evaluation-criteria/{criterionId}
DELETE /api/v1/evaluation-criteria/{criterionId}
```

### Create Criterion Request
```json
{
  "code": "WORK_RATE",
  "label": "Work Rate",
  "sort_order": 1,
  "min_score": 0,
  "max_score": 10
}
```

---

## 13.3 Position Weight Profiles
### Endpoints
```http
GET /api/v1/evaluation-templates/{templateId}/position-weight-profiles
POST /api/v1/evaluation-templates/{templateId}/position-weight-profiles
GET /api/v1/position-weight-profiles/{profileId}
PUT /api/v1/position-weight-profiles/{profileId}
```

### Create / Update Request
```json
{
  "position_code": "CB",
  "effective_from": "2026-08-01",
  "weights": [
    { "criterion_code": "WORK_RATE", "weight": 15 },
    { "criterion_code": "PASSING", "weight": 10 },
    { "criterion_code": "DRIBBLING", "weight": 5 },
    { "criterion_code": "PHYSICALITY", "weight": 25 },
    { "criterion_code": "AGGRESSION", "weight": 15 },
    { "criterion_code": "PACE", "weight": 10 },
    { "criterion_code": "TACTICAL_AWARENESS", "weight": 20 }
  ]
}
```

### Validation
Total weight must equal 100.

---

## 13.4 Evaluation Cycles
### Endpoints
```http
GET /api/v1/teams/{teamId}/evaluation-cycles
POST /api/v1/teams/{teamId}/evaluation-cycles
GET /api/v1/evaluation-cycles/{cycleId}
PUT /api/v1/evaluation-cycles/{cycleId}
```

### Create Request
```json
{
  "season_id": "uuid",
  "name": "Midseason Review",
  "cycle_type": "MIDSEASON",
  "starts_at": "2026-10-01T00:00:00Z",
  "ends_at": "2026-10-15T23:59:59Z"
}
```

---

## 13.5 Create Player Evaluation
### Endpoint
```http
POST /api/v1/players/{playerId}/evaluations
```

### Access
- Coach for assigned team
- Club Admin

### Request
```json
{
  "team_id": "uuid",
  "evaluation_cycle_id": "uuid",
  "template_id": "uuid",
  "position_code": "CM",
  "scores": [
    { "criterion_code": "WORK_RATE", "raw_score": 8 },
    { "criterion_code": "PASSING", "raw_score": 9 },
    { "criterion_code": "DRIBBLING", "raw_score": 7 },
    { "criterion_code": "PHYSICALITY", "raw_score": 6 },
    { "criterion_code": "AGGRESSION", "raw_score": 5 },
    { "criterion_code": "PACE", "raw_score": 7 },
    { "criterion_code": "TACTICAL_AWARENESS", "raw_score": 9 }
  ],
  "summary_comment": "Strong game intelligence and passing range.",
  "coach_only_notes": "Needs more physical edge in duels.",
  "parent_visible_notes": "Great decision-making and work rate."
}
```

### Response
```json
{
  "data": {
    "evaluation_id": "uuid",
    "overall_score": 7.55,
    "rank_in_scope": 3,
    "bucket_label": "TOP_8"
  },
  "meta": {},
  "errors": []
}
```

---

## 13.6 Get Player Evaluations
### Endpoint
```http
GET /api/v1/players/{playerId}/evaluations
```

### Query Params
- `evaluation_cycle_id`
- `latest_only=true`
- `include=scores`

### Response
```json
{
  "data": [
    {
      "evaluation_id": "uuid",
      "evaluation_cycle": {
        "id": "uuid",
        "name": "Midseason Review"
      },
      "overall_score": 7.55,
      "rank_in_scope": 3,
      "bucket_label": "TOP_8",
      "scores": [
        { "criterion_code": "WORK_RATE", "raw_score": 8, "weighted_score": 1.2 }
      ]
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 13.7 Update Player Evaluation
### Endpoint
```http
PUT /api/v1/player-evaluations/{evaluationId}
```

---

## 13.8 Team Evaluation Leaderboard
### Endpoint
```http
GET /api/v1/teams/{teamId}/evaluation-leaderboard
```

### Query Params
- `evaluation_cycle_id`
- `metric` (`OVERALL_SCORE`, `WORK_RATE`, `PASSING`, etc.)
- `position`

### Response
```json
{
  "data": [
    {
      "player_id": "uuid",
      "display_name": "Jordan Miles",
      "position_code": "CM",
      "metric_value": 7.55,
      "rank": 3,
      "bucket_label": "TOP_8"
    }
  ],
  "meta": {},
  "errors": []
}
```

---

## 13.9 Radar Comparison
### Endpoint
```http
GET /api/v1/teams/{teamId}/radar-comparison
```

### Query Params
- `player_ids=uuid1,uuid2,uuid3`
- `evaluation_cycle_id`

### Response
```json
{
  "data": {
    "criteria": [
      "WORK_RATE",
      "PASSING",
      "DRIBBLING",
      "PHYSICALITY",
      "AGGRESSION",
      "PACE",
      "TACTICAL_AWARENESS"
    ],
    "players": [
      {
        "player_id": "uuid1",
        "display_name": "Jordan Miles",
        "values": [8, 9, 7, 6, 5, 7, 9]
      },
      {
        "player_id": "uuid2",
        "display_name": "Chris Lane",
        "values": [7, 8, 8, 7, 6, 8, 7]
      }
    ]
  },
  "meta": {},
  "errors": []
}
```

---

## 13.10 Development Goals
### Endpoints
```http
GET /api/v1/players/{playerId}/development-goals
POST /api/v1/players/{playerId}/development-goals
GET /api/v1/development-goals/{goalId}
PUT /api/v1/development-goals/{goalId}
```

### Create Goal Request
```json
{
  "team_id": "uuid",
  "title": "Improve weak foot passing",
  "description": "Focus on receiving and passing under pressure with weak foot.",
  "category": "TECHNICAL",
  "visibility": "PARENT_VISIBLE",
  "target_date": "2026-11-15"
}
```

---

## 13.11 Development Goal Updates
### Endpoints
```http
GET /api/v1/development-goals/{goalId}/updates
POST /api/v1/development-goals/{goalId}/updates
```

### Create Update Request
```json
{
  "progress_status": "IN_PROGRESS",
  "notes": "Showing better body shape and quicker release in drills."
}
```

---

## 14. Parent Dashboard APIs

## 14.1 Parent Dashboard Summary
### Endpoint
```http
GET /api/v1/parents/me/dashboard
```

### Response
```json
{
  "data": {
    "children": [
      {
        "player_id": "uuid",
        "display_name": "Jordan Miles",
        "teams": [
          {
            "team_id": "uuid",
            "team_name": "U14 Blue"
          }
        ]
      }
    ],
    "upcoming_events": [],
    "unread_messages_count": 4,
    "open_invoices_count": 1,
    "pending_waivers_count": 2
  },
  "meta": {},
  "errors": []
}
```

---

## 14.2 Parent Child Detail
### Endpoint
```http
GET /api/v1/parents/me/children/{playerId}
```

---

## 15. Notification APIs

## 15.1 List Notifications
### Endpoint
```http
GET /api/v1/notifications
```

### Query Params
- `status`
- `page`
- `page_size`

---

## 15.2 Mark Notification Read
### Endpoint
```http
PATCH /api/v1/notifications/{notificationId}/read
```

### Response
```json
{
  "data": {
    "success": true,
    "read_at": "2026-09-10T15:30:00Z"
  },
  "meta": {},
  "errors": []
}
```

---

## 15.3 Notification Preferences
### Endpoints
```http
GET /api/v1/notification-preferences
PUT /api/v1/notification-preferences
```

### Update Request
```json
{
  "email_enabled": true,
  "push_enabled": true,
  "sms_enabled": false,
  "billing_notifications_enabled": true,
  "schedule_notifications_enabled": true
}
```

---

## 16. AI Assistant APIs

## 16.1 Draft Announcement
### Endpoint
```http
POST /api/v1/ai/announcements/draft
```

### Access
- Club Admin
- Coach (team-scoped)

### Request
```json
{
  "club_id": "uuid",
  "team_id": "uuid",
  "prompt": "Draft a weather cancellation announcement for tonight's practice.",
  "tone": "clear_and_friendly"
}
```

### Response
```json
{
  "data": {
    "draft_title": "Practice Cancelled Tonight",
    "draft_body": "Tonight's practice has been cancelled due to weather conditions. Please watch for updates regarding the reschedule."
  },
  "meta": {},
  "errors": []
}
```

---

## 16.2 Draft Team Recap
### Endpoint
```http
POST /api/v1/ai/team-recap/draft
```

### Request
```json
{
  "team_id": "uuid",
  "event_id": "uuid",
  "focus": "training_summary"
}
```

---

## 16.3 Draft Training Plan
### Endpoint
```http
POST /api/v1/ai/training-plan/draft
```

### Request
```json
{
  "team_id": "uuid",
  "age_group": "U14",
  "focus_area": "passing under pressure",
  "duration_minutes": 90
}
```

---

## 16.4 Draft Player Summary
### Endpoint
```http
POST /api/v1/ai/player-summary/draft
```

### Request
```json
{
  "player_id": "uuid",
  "evaluation_cycle_id": "uuid",
  "include_development_goals": true,
  "audience": "PARENT"
}
```

### Response
```json
{
  "data": {
    "summary": "Jordan has shown strong work rate and tactical awareness this cycle, with clear progress in passing range."
  },
  "meta": {},
  "errors": []
}
```

---

## 16.5 Draft Payment Reminder Campaign
### Endpoint
```http
POST /api/v1/ai/payment-reminders/draft
```

### Access
- Club Admin

### Request
```json
{
  "club_id": "uuid",
  "filter": {
    "invoice_status": "OVERDUE"
  },
  "tone": "professional"
}
```

---

## 17. Admin Reporting APIs

## 17.1 Attendance Summary
### Endpoint
```http
GET /api/v1/reports/attendance-summary
```

### Query Params
- `club_id`
- `team_id`
- `from`
- `to`

### Response
```json
{
  "data": {
    "team_attendance_rate": 0.91,
    "player_rows": [
      {
        "player_id": "uuid",
        "display_name": "Jordan Miles",
        "present_count": 12,
        "late_count": 1,
        "absent_count": 0
      }
    ]
  },
  "meta": {},
  "errors": []
}
```

---

## 17.2 Registration Summary
### Endpoint
```http
GET /api/v1/reports/registration-summary
```

---

## 17.3 Billing Summary
### Endpoint
```http
GET /api/v1/reports/billing-summary
```

---

## 17.4 Evaluation Summary
### Endpoint
```http
GET /api/v1/reports/evaluation-summary
```

### Query Params
- `club_id`
- `team_id`
- `evaluation_cycle_id`
- `position_code`

---

## 18. Webhooks and Internal System Events

## 18.1 Payment Webhooks
Handled by:
```http
POST /api/v1/webhooks/payments/{provider}
```

### Requirements
- verify provider signature
- idempotent processing
- update `payments` and `invoices`
- write audit log

## 18.2 Future Outbound Webhooks
Possible later support:
```http
POST /api/v1/clubs/{clubId}/webhook-endpoints
```

---

## 19. HTTP Status Code Conventions
Use these consistently:
- `200 OK` -> successful GET/PUT/PATCH
- `201 Created` -> successful POST creation
- `204 No Content` -> successful delete or action with no payload
- `400 Bad Request` -> malformed request
- `401 Unauthorized` -> no valid authentication
- `403 Forbidden` -> authenticated but not allowed
- `404 Not Found` -> resource not found or not in allowed scope
- `409 Conflict` -> duplicate state / unique conflict / business conflict
- `422 Unprocessable Entity` -> validation failed
- `429 Too Many Requests` -> rate limit
- `500 Internal Server Error` -> unexpected server issue

---

## 20. Standard Error Codes
Recommended reusable error codes:
- `VALIDATION_ERROR`
- `INVALID_CREDENTIALS`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `TENANT_SCOPE_VIOLATION`
- `TEAM_SCOPE_VIOLATION`
- `PARENT_CHILD_SCOPE_VIOLATION`
- `DUPLICATE_RESOURCE`
- `CONFLICT`
- `PAYMENT_PROVIDER_ERROR`
- `WAIVER_ALREADY_ACCEPTED`
- `EVALUATION_PROFILE_INVALID`
- `RATE_LIMITED`

Example:
```json
{
  "data": null,
  "meta": {},
  "errors": [
    {
      "code": "PARENT_CHILD_SCOPE_VIOLATION",
      "message": "The authenticated parent cannot modify this player record."
    }
  ]
}
```

---

## 21. Access Matrix Summary by Endpoint Group

### Master Admin
- `/master/*`
- all reporting
- all clubs

### Club Admin
- `/clubs/{clubId}/*`
- full access to teams, players, schedules, registrations, billing, waivers, evaluations within club

### Coach
- assigned team endpoints
- roster, events, attendance, messages, evaluations for assigned teams

### Parent
- linked-child endpoints only
- safe roster views
- schedule, rsvp, invoices, waivers for linked children/family only

---

## 22. Frontend Integration Notes
1. Frontend should not assume fields are always present across roles.
2. Parent-safe views and coach/admin full views may differ in shape.
3. Use server-side filters rather than fetching excessive data client-side.
4. Use cursor pagination for messages and offset pagination for admin lists.
5. Use feature flags to expose AI, billing, or evaluation modules per club.

---

## 23. Suggested Implementation Order for APIs
1. Auth
2. Clubs / teams / seasons
3. Players / parents / roster
4. Announcements / messages
5. Events / RSVP / attendance
6. Registration
7. Billing / payments / waivers
8. Evaluations / radar / development goals
9. Notifications
10. AI endpoints
11. Reports

---

## 24. Final Recommendation
Use this API contract as the authoritative starting point for controller/service development.

Recommended implementation strategy:
- keep endpoint structure RESTful and consistent
- centralize authorization checks by scope
- keep response envelopes uniform
- separate parent-safe projections from coach/admin views
- validate all payment and waiver workflows server-side
- make evaluation and radar endpoints explicit to support rich UI and reporting

This API contract is detailed enough to let Claude Code scaffold routes, DTOs, validation schemas, controllers, and service methods immediately.
