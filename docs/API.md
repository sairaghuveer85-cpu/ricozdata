# RicozData Enterprise Governance API

REST API documentation for the RicozData backend (Express.js 5 + Mongoose 9).

- **Base URL**: `http://localhost:5000/api` (local) or your production origin
- **Content-Type**: `application/json`
- **Authentication**: Bearer token (`Authorization: Bearer <jwt>`) on all private endpoints
- **Response envelope**: `{ "success": true, "data": ... }` on success; `{ "success": false, "message": "..." }` on error
- **Rate limiting**: 300 req/15 min global; 30 attempts/15 min on `/auth/login` and `/auth/register`

---

## Phase 7 — Role-Based Access Control (RBAC)

### Standardized Roles (6 Roles)

| Role | Hierarchy | Description |
|------|-----------|-------------|
| `SUPER_ADMIN` | 6 | Unrestricted full access across all platform modules, system configuration, and tenant security controls |
| `ADMIN` | 5 | Enterprise governance administration with full data, policy, and user management capabilities |
| `DATA_STEWARD` | 4 | Domain stewardship responsible for metadata certification, business glossary terms, and data quality rules |
| `DATA_ENGINEER` | 3 | Data platform engineering with schema editing, pipeline lineage management, and quality telemetry access |
| `DATA_ANALYST` | 2 | Data discovery, catalog search, dataset registration, and read access to governance assets |
| `VIEWER` | 1 | Read-only access across datasets, quality scores, lineage graphs, and enterprise glossary |

### Granular Permissions Catalog (28 Permissions)

#### Datasets
- `DATASET_READ` — View datasets
- `DATASET_CREATE` — Register new datasets
- `DATASET_UPDATE` — Modify dataset metadata
- `DATASET_DELETE` — Delete datasets

#### Quality
- `QUALITY_READ` — View quality scores and dimensions
- `QUALITY_UPDATE` — Update quality metrics
- `QUALITY_MANAGE` — Manage quality rules and issues

#### Lineage
- `LINEAGE_READ` — View lineage graphs
- `LINEAGE_MANAGE` — Create/modify lineage graphs

#### Glossary
- `GLOSSARY_READ` — View glossary terms
- `GLOSSARY_CREATE` — Create new terms
- `GLOSSARY_UPDATE` — Update term definitions
- `GLOSSARY_DELETE` — Delete terms

#### Policies
- `POLICY_READ` — View governance policies
- `POLICY_CREATE` — Create new policies
- `POLICY_UPDATE` — Update policy details
- `POLICY_DELETE` — Delete policies

#### Users
- `USER_READ` — View user directory
- `USER_CREATE` — Invite new users
- `USER_UPDATE` — Modify user profiles
- `USER_DELETE` — Revoke user access

#### Platform
- `ACTIVITY_READ` — View activity feed
- `DASHBOARD_READ` — View dashboard metrics
- `SEARCH_READ` — Use global search
- `SETTINGS_MANAGE` — Manage platform settings
- `SYSTEM_MANAGE` — Full system administration (SUPER_ADMIN only)

### Role → Permission Matrix

| Permission | SUPER_ADMIN | ADMIN | DATA_STEWARD | DATA_ENGINEER | DATA_ANALYST | VIEWER |
|------------|:-----------:|:-----:|:------------:|:-------------:|:------------:|:------:|
| DATASET_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DATASET_CREATE | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| DATASET_UPDATE | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| DATASET_DELETE | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| QUALITY_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| QUALITY_UPDATE | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| QUALITY_MANAGE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| LINEAGE_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| LINEAGE_MANAGE | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| GLOSSARY_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GLOSSARY_CREATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| GLOSSARY_UPDATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| GLOSSARY_DELETE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| POLICY_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POLICY_CREATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| POLICY_UPDATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| POLICY_DELETE | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| USER_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| USER_CREATE | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| USER_UPDATE | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| USER_DELETE | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ACTIVITY_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DASHBOARD_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SEARCH_READ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SETTINGS_MANAGE | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| SYSTEM_MANAGE | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Privilege Escalation Prevention

- **SUPER_ADMIN isolation**: Only `SUPER_ADMIN` can create, modify, or promote users to `SUPER_ADMIN`
- **Self-modification block**: Users cannot alter their own role or status via admin endpoints
- **Hierarchy enforcement**: Users can only manage roles strictly lower in the hierarchy
- **Non-admin restriction**: `DATA_STEWARD`, `DATA_ENGINEER`, `DATA_ANALYST`, `VIEWER` cannot modify user accounts or roles

### User Security Lifecycle

| Status | Description | Auth Behavior |
|--------|-------------|---------------|
| `ACTIVE` | Normal operational account | ✅ Allowed |
| `INACTIVE` | Deactivated account | ❌ 403 Forbidden at auth middleware |
| `SUSPENDED` | Security review required | ❌ 403 Forbidden at auth middleware |

**Password Security**: Passwords hashed using bcrypt (10 rounds) and excluded from all responses via `.select('-password')`.

### Demo User Credentials (All 6 Roles)

| Role | Email | Password | Name | Department |
|------|-------|----------|------|------------|
| SUPER_ADMIN | raghuveer.chandran@ricoz-industries.demo | Password123! | Raghuveer Chandran | Enterprise Analytics |
| ADMIN | priya.shah@ricoz-industries.demo | Password123! | Priya Shah | Data Governance |
| DATA_STEWARD | arjun.kumar@ricoz-industries.demo | Password123! | Arjun Kumar | Data Platform |
| DATA_ENGINEER | meera.iyer@ricoz-industries.demo | Password123! | Meera Iyer | Product |
| DATA_ANALYST | vikram.mehta@ricoz-industries.demo | Password123! | Vikram Mehta | Human Resources |
| VIEWER | kavya.sharma@ricoz-industries.demo | Password123! | Kavya Sharma | Finance |

> ⚠️ **Production Note**: Change all passwords and rotate `JWT_SECRET` before production deployment.

---

## Public Endpoints

### Health Check
`GET /api/health`

Returns service status without requiring authentication.

**Response** `200 OK`
```json
{
  "success": true,
  "status": "operational",
  "service": "RicozData Enterprise Governance API",
  "environment": "development",
  "uptime": "123s",
  "timestamp": "2026-09-25T10:00:00.000Z"
}
```

---

## Authentication

### Register User
`POST /api/auth/register`

Creates a new user account and returns a JWT.

| Validation | Field   | Rule                              |
|-----------|--------|-----------------------------------|
| required  | `name`    | non-empty string                  |
| required  | `email`   | valid email                       |
| required  | `password`| min 6 characters                  |

**Request Body**
```json
{
  "name": "New User",
  "email": "new.user@example.com",
  "password": "Password123!",
  "role": "DATA_ANALYST",
  "department": "Analytics"
}
```

**Responses**
- `201 Created` — `{ "success": true, "data": { "user": {...}, "token": "..." } }`
- `400 Bad Request` — `{ "success": false, "message": "User already exists" }` or validation errors array

### Login
`POST /api/auth/login`

Authenticates a user and returns a signed 30-day JWT.

**Request Body**
```json
{
  "email": "raghuveer.chandran@ricoz-industries.demo",
  "password": "Password123!"
}
```

**Responses**
- `200 OK` — `{ "success": true, "data": { "user": {...}, "token": "..." } }`
- `401 Unauthorized` — `{ "success": false, "message": "Invalid credentials" }`
- `403 Forbidden` — `{ "success": false, "message": "Your account is inactive/suspended" }` (account status check)

### Get Current User
`GET /api/auth/me`

Returns the authenticated user's profile.

**Headers**: `Authorization: Bearer <jwt>`

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "...",
    "department": "...",
    "avatar": "RC",
    "avatarBg": "bg-blue-600",
    "status": "ACTIVE",
    "lastActive": "..."
  }
}
```

### Logout
`POST /api/auth/logout`

Invalidates the session token (stateless — client should discard JWT).

**Response** `200 OK`
```json
{ "success": true, "message": "User logged out" }
```

---

## Datasets

### List Datasets
`GET /api/datasets`

Search, filter, sort, and paginate datasets.

| Query Parameter | Type   | Description                                    |
|----------------|--------|------------------------------------------------|
| `search`       | string | Full-text match on name, description, tags     |
| `domain`       | string | Filter by domain                               |
| `source`       | string | Filter by source system                        |
| `status`       | string | Filter by status (`active` / `archived`)       |
| `sensitivity`  | string | Filter by sensitivity level                    |
| `certification`| string | Filter by certification status                 |
| `sortBy`       | string | Sort field (default: `name`)                   |
| `sortOrder`    | string | `asc` (default) or `desc`                      |
| `page`         | number | Page number (default: 1)                       |
| `limit`        | number | Results per page (default: 20)                 |

**Permission Required**: `DATASET_READ`

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "datasets": [ { ...dataset } ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "pages": 1
    }
  }
}
```

### Get Single Dataset
`GET /api/datasets/:id`

**Permission Required**: `DATASET_READ`

**Response** `200 OK` — `{ "success": true, "data": {...} }` with populated owner/steward/domain, quality details, and policies.

### Create Dataset
`POST /api/datasets`

**Permission Required**: `DATASET_CREATE`

**Request Body**: Dataset fields including `name`, `description`, `ownerId`, `domainId`, `source`, etc.
**Response** `201 Created` — `{ "success": true, "data": {...} }`

### Update Dataset
`PUT /api/datasets/:id`

**Permission Required**: `DATASET_UPDATE`

**Response** `200 OK` — `{ "success": true, "data": {...} }`

### Delete Dataset
`DELETE /api/datasets/:id`

**Permission Required**: `DATASET_DELETE`

**Response** `200 OK` — `{ "success": true, "message": "Dataset removed" }`

### Dataset Statistics
`GET /api/datasets/stats/summary`

Returns aggregate counts: total, active, certified, in-review, average quality, domain breakdown.

**Permission Required**: `DATASET_READ`

---

## Quality

### Get All Quality Records
`GET /api/quality`

**Permission Required**: `QUALITY_READ`

**Response** `200 OK` — `{ "success": true, "data": [ ...quality records ] }`

### Get Quality Overview for Dataset
`GET /api/quality/overview/:datasetId`

Returns quality score, grade, dimensions, and scan metadata. Falls back to dataset's stored quality if no record exists.

**Permission Required**: `QUALITY_READ`

### Get Quality by Dataset
`GET /api/quality/:datasetId`

**Permission Required**: `QUALITY_READ`

**Response** `200 OK` — `{ "success": true, "data": {...} }`

### Create Quality Record
`POST /api/quality`

**Permission Required**: `QUALITY_UPDATE`

**Request Body**: `{ "datasetId": "...", "score": 95, "grade": "Excellent", "dimensions": [...] }`

### Update Quality Record
`PUT /api/quality/:id`

**Permission Required**: `QUALITY_UPDATE`

### Delete Quality Record
`DELETE /api/quality/:id`

**Permission Required**: `QUALITY_MANAGE`

### Quality Issues

#### List Issues
`GET /api/quality/issues`

| Query Parameter | Type   | Description          |
|----------------|--------|----------------------|
| `datasetId`    | string | Filter by dataset    |
| `severity`     | string | Filter by severity   |
| `status`       | string | Filter by status     |

**Permission Required**: `QUALITY_READ`

#### Get Single Issue
`GET /api/quality/issues/:id`

**Permission Required**: `QUALITY_READ`

#### Create Issue
`POST /api/quality/issues`

**Permission Required**: `QUALITY_UPDATE`

#### Update Issue
`PUT /api/quality/issues/:id`

**Permission Required**: `QUALITY_UPDATE`

#### Delete Issue
`DELETE /api/quality/issues/:id`

**Permission Required**: `QUALITY_MANAGE`

---

## Lineage

### Get All Lineage Graphs
`GET /api/lineage`

**Permission Required**: `LINEAGE_READ`

### Get Lineage for Dataset
`GET /api/lineage/:datasetId`

Returns `{ nodes: [...], edges: [...] }` format compatible with React Flow.

**Permission Required**: `LINEAGE_READ`

### Create Lineage Graph
`POST /api/lineage`

**Permission Required**: `LINEAGE_MANAGE`

**Request Body**: `{ "datasetId": "...", "nodes": [...], "edges": [...], "sourceDatasets": [...], "destinationDatasets": [...], "transformationInfo": "..." }`

### Update Lineage Graph
`PUT /api/lineage/:id`

**Permission Required**: `LINEAGE_MANAGE`

### Delete Lineage Graph
`DELETE /api/lineage/:id`

**Permission Required**: `LINEAGE_MANAGE`

---

## Glossary

### List Glossary Terms
`GET /api/glossary`

| Query Parameter | Type   | Description          |
|----------------|--------|----------------------|
| `search`       | string | Match term, definition, synonyms |
| `domain`       | string | Filter by domain     |
| `status`       | string | Filter by status     |

**Permission Required**: `GLOSSARY_READ`

### Get Single Term
`GET /api/glossary/:id`

**Permission Required**: `GLOSSARY_READ`

### Create Term
`POST /api/glossary`

**Permission Required**: `GLOSSARY_CREATE`

### Update Term
`PUT /api/glossary/:id`

**Permission Required**: `GLOSSARY_UPDATE`

### Delete Term
`DELETE /api/glossary/:id`

**Permission Required**: `GLOSSARY_DELETE`

### Terms for Dataset
`GET /api/glossary/dataset/:datasetId`

**Permission Required**: `GLOSSARY_READ`

---

## Policies

### List Policies
`GET /api/policies`

**Permission Required**: `POLICY_READ`

### Get Single Policy
`GET /api/policies/:id`

**Permission Required**: `POLICY_READ`

### Create Policy
`POST /api/policies`

**Permission Required**: `POLICY_CREATE`

### Update Policy
`PUT /api/policies/:id`

**Permission Required**: `POLICY_UPDATE`

### Toggle Policy Status
`PUT /api/policies/:id/toggle`

Toggles between `active` and `draft` status.

**Permission Required**: `POLICY_UPDATE`

### Delete Policy
`DELETE /api/policies/:id`

**Permission Required**: `POLICY_DELETE`

---

## Activities

### List Activities
`GET /api/activities?limit=20`

Returns recent activities sorted by `timestamp` descending, with populated `actorId` and `datasetId`.

**Permission Required**: `ACTIVITY_READ`

### Create Activity
`POST /api/activities`

**Permission Required**: `ACTIVITY_READ`

**Request Body**: `{ "title": "...", "type": "...", "datasetId": "...", "actorId": "..." }` (actorId defaults to `req.user._id` when authenticated)

---

## Dashboard

### Dashboard Metrics
`GET /api/dashboard/metrics`

Returns KPI array (total datasets, data quality, policy violations, active users) plus summary object.

**Permission Required**: `DASHBOARD_READ`

### Recent Activity
`GET /api/dashboard/activity`

Returns last 5 activities formatted for dashboard display.

**Permission Required**: `DASHBOARD_READ`

### Popular Datasets
`GET /api/dashboard/popular-datasets`

Returns top 4 datasets by `views`.

**Permission Required**: `DASHBOARD_READ`

---

## Search

### Global Search
`GET /api/search?q=<query>`

Searches datasets, users, glossary terms, policies, and quality issues. Returns a categorized result set with display metadata.

**Query Parameters**
- `q` (required, non-empty) — search term

**Permission Required**: `SEARCH_READ`

---

## Users

### List Users
`GET /api/users`

Returns all users (password field excluded) sorted by name.

**Permission Required**: `USER_READ`

### Get Single User
`GET /api/users/:id`

**Permission Required**: `USER_READ`

### Update User
`PUT /api/users/:id`

**Permission Required**: `USER_UPDATE`

**Body**: `{ name, email, role, department, status }`

**Privilege Escalation Guards**:
- Only `SUPER_ADMIN` may assign `SUPER_ADMIN` role
- Users cannot modify their own account via this endpoint
- Role changes require strict hierarchy enforcement (`canManageRole`)

### Delete User
`DELETE /api/users/:id`

**Permission Required**: `USER_DELETE`

**Privilege Escalation Guards**:
- Only `SUPER_ADMIN` may delete `SUPER_ADMIN` users
- Users cannot delete their own account
- Role hierarchy enforcement for deletion

---

## Error Handling

All errors return:
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

| HTTP Status | Trigger                                    |
|-------------|--------------------------------------------|
| 400         | Bad request / Mongoose CastError           |
| 401         | Missing/invalid/expired JWT                |
| 403         | Authenticated but insufficient role/permission |
| 404         | Resource not found                         |
| 409         | Duplicate key violation (unique constraint)|
| 422         | Mongoose ValidationError                   |
| 500         | Unhandled server error                     |

Stack traces are suppressed in production (`NODE_ENV === 'production'`).

---

## Authorization Headers

All private endpoints require:
```
Authorization: Bearer <jwt_token>
```

Token format:
- JWT signed with `HS256` algorithm
- 30-day expiry
- Payload: `{ "id": "<userObjectId>" }`

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Global API | 300 requests | 15 minutes |
| `/auth/login` | 30 attempts | 15 minutes |
| `/auth/register` | 30 attempts | 15 minutes |

Exceeding limits returns `429 Too Many Requests`.

---

## CORS Configuration

- `origin`: Must match `CLIENT_URL` environment variable
- `credentials`: `true` (cookies supported)
- `methods`: `GET, POST, PUT, DELETE, OPTIONS`

---

## Security Headers (Helmet)

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'`

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `PORT` | No | 5000 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `CLIENT_URL` | Yes | - | Frontend origin for CORS |
| `JWT_SECRET` | Yes | - | JWT signing secret (256-bit) |
| `RATE_LIMIT_WINDOW_MS` | No | 900000 | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | No | 100 | Max requests per window |

---

## Testing the RBAC

### Verify Permission Enforcement

```bash
# 1. Login as VIEWER
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kavya.sharma@ricoz-industries.demo","password":"Password123!"}'

# 2. Use returned token to test access
TOKEN="<returned_token>"

# Should succeed (VIEWER has DATASET_READ)
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/datasets

# Should fail 403 (VIEWER lacks DATASET_CREATE)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"Test"}' \
  http://localhost:5000/api/datasets

# 3. Test privilege escalation (ADMIN cannot create SUPER_ADMIN)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Evil","email":"evil@test.com","password":"Password123!","role":"SUPER_ADMIN"}' \
  http://localhost:5000/api/users
# Returns 403: "You do not have permission to assign the SUPER_ADMIN role."
```

### Test Account Status Blocking

```bash
# 1. As SUPER_ADMIN, suspend a user
curl -X PUT -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"SUSPENDED"}' \
  http://localhost:5000/api/users/<user-id>

# 2. Attempt login as suspended user
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"suspended@test.com","password":"Password123!"}'
# Returns 403: "Your account has been suspended for security review."
```