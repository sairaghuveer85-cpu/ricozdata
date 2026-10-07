# RicozData Multi-Tenant Architecture & Isolation Guide

## 1. Overview & Organization as Tenant
In RicozData, each tenant is modeled as an **`Organization`** document. Multi-tenancy follows a pooled database, shared-process model with row/document-level logical isolation strictly enforced at the data layer and application boundary.

- **Tenant Root Document**: `Organization` (`_id`, `name`, `slug`, `status`, `settings`)
- **Tenant Scope Boundary**: Every tenant-bound resource (Users, DataSources, Datasets, Activities, Quality Rules, etc.) contains a required and indexed `organizationId: Schema.Types.ObjectId` referencing its owning `Organization`.

---

## 2. Canonical Tenant Context
Every incoming HTTP request is evaluated by the centralized `tenantContextMiddleware()`. When a tenant is successfully identified, the following canonical fields are populated on `req`:

- `req.organizationId`: The string representation of the tenant's ObjectId.
- `req.organization`: The loaded and validated Mongoose `Organization` document.
- `req.tenant`: Ergonomic alias to `req.organization`.
- `req.tenantResolutionSource`: The resolution mechanism utilized (`authenticated`, `trusted_header`, `subdomain`, or `none`).

If no tenant is identified or an untrusted source is provided, `req.organizationId` remains `null`.

---

## 3. Deterministic Resolution Priority & Conflict Prevention
Tenant resolution follows a strict priority order. Conflicting tenant sources (e.g. an authenticated user for Tenant A attempting to access Tenant B's subdomain) are **immediately rejected with HTTP 403 `TENANT_CONTEXT_CONFLICT`**.

1. **Priority 1: Authenticated User Context**
   - Populated by future session/JWT authentication (`req.user.organizationId`).
   - Represents the highest level of authority.
2. **Priority 2: Trusted Internal Tenant Header**
   - Headers: `X-Tenant-Slug` or `X-Tenant-Id`.
   - **Trust Boundary**: Must be accompanied by `X-Internal-Secret` matching the configured `TRUSTED_INTERNAL_SECRET`.
   - *Untrusted Client Protection*: Headers without valid internal credentials are ignored and logged to prevent header spoofing / impersonation attacks.
3. **Priority 3: Subdomain / Host-Based Routing**
   - Extracted from `Host` / `req.hostname` (e.g. `acme.ricozdata.io` or `acme.localhost`).
   - Looks up the organization by `slug`.
   - Reserved subdomains (`www`, `api`, `admin`, `app`) are bypassed.
4. **Priority 4: No Tenant Context**
   - Set to `null`. Protected tenant endpoints reject with HTTP 400 `TENANT_CONTEXT_REQUIRED`.

---

## 4. Subdomain Routing in Local Development
To test subdomain tenant routing locally without external DNS:
- Request hosts formatted as `<slug>.localhost:<PORT>` (e.g. `http://acme.localhost:5000/api/organizations/me`).
- Node.js and modern browsers automatically route `*.localhost` to `127.0.0.1`.
- Express parses the subdomain (`acme`) and loads the corresponding organization document.

---

## 5. Tenant Status Lifecycle
Access control policies are enforced based on the organization's `status`:

| Status | Policy | HTTP Response |
|---|---|---|
| **ACTIVE** | Normal operational access permitted. | HTTP 200 |
| **SUSPENDED** | Access strictly revoked across all endpoints. | HTTP 403 `TENANT_SUSPENDED` |
| **PENDING** | Account pending onboarding/verification. Regular API access restricted. | HTTP 403 `TENANT_PENDING` |
| **ARCHIVED** | Tenant is archived and read-only / inaccessible. | HTTP 403 `TENANT_ARCHIVED` |

---

## 6. Payload Isolation & Database Scoping Rules

1. **Client Body Protection**:
   `enforcePayloadIsolation` middleware inspects `req.body`. If the caller supplies an `organizationId` differing from `req.organizationId`, the request is rejected with HTTP 403 `TENANT_PAYLOAD_MISMATCH`.
2. **Database Query Scoping**:
   Always scope queries through `withTenant(req, filter)` or dedicated scoping helpers (`tenantFind`, `tenantFindById`, `tenantUpdateOne`, `tenantDeleteOne`):
   ```javascript
   // Correct pattern:
   const dataset = await tenantFindById(Dataset, req, datasetId);

   // Insecure anti-pattern:
   // const dataset = await Dataset.findById(datasetId); // Vulnerable to cross-tenant ID enumeration!
   ```
3. **Defense Against ID Enumeration**:
   Querying for a resource belonging to Tenant B while operating under Tenant A returns `null` (HTTP 404), completely concealing the existence of foreign tenant records.
