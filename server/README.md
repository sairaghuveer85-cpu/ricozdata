# RicozData Enterprise Server — Architecture & Operations Reference

RicozData is an enterprise-grade multi-tenant data governance, intelligence, quality, catalog, and operations platform.

## Architecture Boundaries

```
CUSTOMER DATA SOURCES (PostgreSQL, MySQL, Snowflake, MongoDB, S3)
        ↓
CONNECTOR LAYER (Pooled, lifecycle-managed, read-only isolated execution)
        ↓
RICOZDATA PLATFORM
    - Express API (v1 REST, Swagger, Prometheus /metrics)
    - Redis (BullMQ Queues + Multi-Tenant Cache with In-Memory Resilient Fallback)
    - MongoDB (Catalog, metadata, quality runs, profiles, lineage, glossary, audit)
    - Background Workers (Catalog sync, profiling, quality scans)
```

> **Data Boundary Guarantee**: Customer records are never copied or duplicated into the RicozData platform. The connector layer executes queries database-side, collecting only metadata, aggregated statistical profiles, quality scores, and bounded diagnostic evidence.

---

## Phase 5 Modules & Specifications

### 1. Data Quality Engine (`QualityEngine.js`)
- **Execution Lifecycle**: Tenant-scoped dataset validation → Connector acquisition → Parallel rule evaluation via connector → Deterministic score computation → Snapshot creation → Issue auto-generation → Cleanup.
- **Deterministic Quality Score (0–100)**:
  $$\text{Quality Score} = \frac{\sum (\text{Rule Pass Rate} \times \text{Weight})}{\sum \text{Weight}}$$
  where weights correspond to severity:
  - `CRITICAL`: 4, `HIGH`: 3, `MEDIUM`: 2, `LOW`: 1
- **Quality Dimensions**: `completeness`, `uniqueness`, `validity`, `consistency`, `integrity`.

### 2. Quality Rules (`QualityRule.js`, `securityValidators.js`)
Supported rule types: `NULL_CHECK`, `UNIQUENESS` (single and composite), `REGEX_PATTERN` (with ReDoS protection), `VALUE_RANGE`, `REFERENCE_INTEGRITY`, and `CUSTOM_SQL` (read-only `SELECT`/`WITH` only; strictly rejects DDL/DML, comments, stacked statements, and system tables).

### 3. Quality Issues & Remediation (`QualityIssue.js`, `QualityAlertDispatcher.js`)
- Lifecycle: `OPEN` → `IN_REVIEW` → `RESOLVED`.
- Root cause recording, ownership assignment, resolution notes without mutating source records.

### 4. Statistical Data Profiling (`ProfilingService.js`, `DataProfile.js`)
- Database-side aggregation: row counts, null %, distinct counts, min, max, mean, median, standard deviation, and top-5 value distribution histograms with PII redaction.

### 5. Data Lineage (`LineageService.js`, `LineageEdge.js`)
- Upstream and downstream breadth-first traversal (BFS) with depth limits (5–10) and visited-edge cycle protection.

### 6. Business Glossary (`GlossaryTerm.js`)
- Centralized terminology linked to datasets and specific columns (`linkedDatasets: [{ datasetId, column }]`).

### 7. Governance & Compliance (`MaskingEngine.js`, `MaskingPolicy.js`)
- Data classification (`PII`, `PHI`, `SENSITIVE`, `PUBLIC`) and masking strategies (`REDACT`, `PARTIAL`, `HASH`, `TOKENIZED`). Real-time compliance coverage audit report.

### 8. Audit Logs & Tracking (`Activity.js`)
- Append-only immutability (pre-hooks block updates; deletions blocked in production without privileged purge). Deep recursive secret scrubber.

---

## Phase 6 Operations & Performance Specifications

### 9. Background Jobs & Scheduling (`QueueManager.js`, `ScheduleManager.js`, `Job.js`)
- **Queues**: `ricoz-catalog_sync`, `ricoz-data_profiling`, `ricoz-quality_scan`.
- **Engine**: Powered by BullMQ when Redis is connected (`REDIS_URL` or `localhost:6379`), with an automatic, resilient in-memory worker fallback when Redis is offline.
- **Job Retention**: 500 completed jobs, 1000 failed jobs. Max 3 attempts with exponential backoff.
- **Idempotency**: Prevents redundant jobs if an active job (`QUEUED` or `RUNNING`) already exists for the resource.
- **Tenant Safety**: Every worker re-queries and authorizes tenant ownership before executing.
- **Scheduling**: Cadences (`hourly`, `every_6_hours`, `daily`, `weekly`) registered per tenant without runaway timers.

### 10. Multi-Tenant Caching (`CacheService.js`)
- **Tenant-Isolated Keys**: `tenant:{organizationId}:{namespace}:{id}` prevents cross-tenant data leaks.
- **Stampede Protection**: Single-flight coalescing (`CacheService.coalesce`) collapses concurrent requests for expired keys to a single database execution.
- **TTLs**: Intentional TTLs (Dataset: 120s, Dashboard: 60s, Glossary: 300s, Compliance: 120s, Quality: 120s).
- **Invalidation**: Domain-specific mutations trigger instant invalidations of affected keys and namespaces.

### 11. Observability, Logging & Monitoring
- **Structured Logging (`logger.js`)**: Single-line JSON logs in production with `timestamp`, `level`, `service`, `correlationId`, `organizationId`, and secret scrubbing (`password`, `token`, `secret`, `credentials` $\to$ `***REDACTED***`).
- **Correlation ID (`correlationId.js`)**: Generates or sanitizes `X-Correlation-ID` header (max 64 chars, safe characters only).
- **Operational Health Probes**:
  - `GET /healthz`: Process liveness (HTTP 200).
  - `GET /readyz`: Dependency readiness (checks MongoDB connection and Redis state; returns 200 or 503).
- **Prometheus Metrics (`/metrics`)**:
  - Exposes standard low-cardinality metrics:
    - `http_requests_total` (`method`, `route`, `status_code`)
    - `http_request_duration_seconds`
    - `http_active_requests`
    - `ricoz_cache_hits_total` / `ricoz_cache_misses_total`
    - `ricoz_queue_jobs_total` / `ricoz_queue_depth`
