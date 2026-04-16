# AI Task Processing Platform — Architecture Document

## 1. System Architecture Overview

The system is designed as a **distributed, event-driven architecture** using Redis as a message broker and MongoDB as the primary datastore. Tasks are processed asynchronously by horizontally scalable Python worker services, ensuring high throughput and fault tolerance.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│                   React SPA (Vite + Tailwind)                   │
│                    Served via Nginx / CDN                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                          │
│                  Node.js + Express (2 replicas)                  │
│           JWT Auth │ Rate Limiting │ Helmet │ CORS              │
│                                                                 │
│              ┌──────────────┬──────────────────┐                │
│              │ Auth Routes  │  Task Routes     │                │
│              │ /api/auth/*  │  /api/tasks/*    │                │
│              └──────┬───────┴───────┬──────────┘                │
└─────────────────────┼───────────────┼───────────────────────────┘
                      │               │
          ┌───────────▼───┐     ┌─────▼─────────┐
          │   MongoDB     │     │  Redis Queue   │
          │  (Primary DB) │     │  (LPUSH/BRPOP) │
          │               │     │                │
          │  • Users      │     │  tasks:queue   │
          │  • Tasks      │     │  tasks:dlq     │
          │  • RefreshTkns│     │                │
          └───────┬───────┘     └──────┬─────────┘
                  │                    │
                  │              ┌─────▼──────────────────────────┐
                  │              │     Worker Layer (Python)       │
                  │              │    3-10 replicas (HPA)          │
                  │◄─────────────│                                 │
                  │  Direct DB   │  • BRPOP from tasks:queue      │
                  │  Updates     │  • Atomic claim (findOneAndUpdate)│
                  │              │  • Process: uppercase/lowercase/│
                  │              │    reverse/wordcount            │
                  │              │  • Retry: exponential backoff   │
                  │              │  • DLQ on 3x failure            │
                  │              └─────────────────────────────────┘
```

### Component Responsibilities

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Frontend | React + Vite + Tailwind v4 | User interface, real-time status polling |
| Backend API | Node.js + Express | Authentication, task CRUD, job enqueuing |
| Worker | Python + redis-py + pymongo | Job consumption, text processing, DB updates |
| MongoDB | MongoDB 7 | Primary data store (users, tasks, tokens) |
| Redis | Redis 7 | Message queue (LPUSH/BRPOP pattern) |

---

## 2. Worker Scaling Strategy

### Horizontal Scaling

Workers are deployed as a Kubernetes Deployment with **HorizontalPodAutoscaler (HPA)**:

```yaml
minReplicas: 2
maxReplicas: 10
targetCPUUtilization: 70%
```

**How it works:**
- Each worker instance runs an independent `BRPOP` loop against `tasks:queue`
- Redis guarantees that each job is delivered to exactly ONE consumer (atomic pop operation)
- No coordination needed between workers — Redis handles distribution
- Workers are stateless — any worker can process any job
- HPA scales workers up when CPU exceeds 70%, scales down after 2-minute cooldown

**Scale-up behavior:**
- Adds 2 pods per 60-second window (prevents thrashing)
- 30-second stabilization before scale-up

**Scale-down behavior:**
- Removes 1 pod per 60-second window (graceful)
- 120-second stabilization (prevents premature scale-down)

### Advanced: Queue-Length Based Scaling (KEDA)

For production environments with bursty workloads, KEDA can scale workers based on Redis queue length:

```yaml
triggers:
  - type: redis
    metadata:
      listName: tasks:queue
      listLength: "50"  # Scale up when queue > 50 jobs
```

---

## 3. Handling High Task Volume (100k tasks/day)

### Throughput Analysis

```
100,000 tasks/day = ~1.15 tasks/second (avg)
Peak (2x): ~2.3 tasks/sec
Burst (5x): ~5.8 tasks/sec
```

### Bottleneck Analysis & Mitigation

| Bottleneck | Mitigation |
|------------|-----------|
| **Queue throughput** | Redis handles 100k+ ops/sec. Single-threaded but I/O-bound. AOF persistence enabled. |
| **Worker processing** | Each worker handles ~10 tasks/sec. 3 workers = 30 tasks/sec (26x headroom). |
| **MongoDB writes** | Connection pooling (10 per worker). Indexed queries. Write concern: `w:1` for speed. |
| **API throughput** | 2 backend replicas. Rate limiting prevents abuse. |

### Strategy

1. **Queue Buffering** — Redis absorbs traffic spikes. Workers consume at their own pace.
2. **Horizontal Workers** — HPA auto-scales from 2→10 workers based on CPU.
3. **Connection Pooling** — MongoDB `maxPoolSize: 10` per worker prevents connection exhaustion.
4. **Indexed Queries** — All frequent query patterns have compound indexes.
5. **Async Processing** — API returns immediately after enqueuing. No blocking.

---

## 4. Database Indexing Strategy

### MongoDB Indexes

```javascript
// User collection
{ email: 1 }                    // Login lookup — O(log n)

// Task collection
{ userId: 1, createdAt: -1 }    // User's tasks sorted by newest
{ status: 1, createdAt: 1 }     // Queue monitoring (pending/running tasks)
{ userId: 1, status: 1 }        // User's tasks filtered by status
{ status: 1 }                   // Single-field for aggregation

// RefreshToken collection
{ tokenHash: 1 }                // Token lookup — unique
{ userId: 1, family: 1 }        // Family-based token revocation
{ expiresAt: 1 }                // TTL index — auto-deletes expired tokens
```

### Index Design Rationale

- **Compound indexes** follow ESR (Equality → Sort → Range) rule
- `{ userId: 1, createdAt: -1 }` serves the most common query: "show me my recent tasks"
- TTL index on `RefreshToken.expiresAt` auto-cleans expired tokens (zero maintenance)
- No over-indexing — each index serves a real query pattern

---

## 5. Redis Failure Handling

### Prevention

| Measure | Implementation |
|---------|---------------|
| **AOF Persistence** | `appendonly yes` — survives restarts. Every write logged. |
| **Memory Limits** | `maxmemory 256mb` with `allkeys-lru` eviction. Prevents OOM. |
| **PVC in K8s** | Persistent volume ensures data survives pod restarts. |

### Detection & Recovery

```
Worker → BRPOP(timeout=1s) → ConnectionError?
  ├── Yes → Log error → Sleep 5s → Retry connection
  └── No → Process job normally
```

**Retry strategy in worker:**
- `redis.ConnectionError` → wait 5s, retry
- `redis.TimeoutError` → wait 2s, retry
- Worker never crashes on Redis failure — enters retry loop

### Graceful Degradation (API Side)

When Redis is down, the API:
1. Creates the task record in MongoDB (status: `pending`)
2. Attempts to enqueue → **catches the error**
3. Updates task status to `failed`
4. Returns `503 Service Unavailable` with the task data
5. User can re-run the task later when Redis recovers

### Dead-Letter Queue (DLQ)

Jobs that fail 3 times are moved to `tasks:dlq`:
- Preserved for investigation
- Can be manually re-queued after root cause fix
- Separate from main queue — doesn't block processing

---

## 6. Staging vs Production Deployment

### Environment Separation

```
Kubernetes Cluster
  ├── Namespace: ai-tasks-staging
  │   ├── ConfigMap (staging vars)
  │   ├── Secret (staging secrets)
  │   ├── Backend (1 replica)
  │   ├── Worker (1 replica)
  │   └── MongoDB + Redis (lower resources)
  │
  └── Namespace: ai-tasks-production
      ├── ConfigMap (production vars)
      ├── Secret (production secrets)
      ├── Backend (2+ replicas)
      ├── Worker (3-10 replicas, HPA)
      └── MongoDB + Redis (production resources)
```

### Key Differences

| Aspect | Staging | Production |
|--------|---------|-----------|
| Replicas (Backend) | 1 | 2+ |
| Replicas (Worker) | 1 | 3-10 (HPA) |
| MongoDB | Shared cluster, separate DB | Dedicated cluster / Atlas |
| Redis | Shared, lower memory | Dedicated, 256MB+ |
| TLS | Self-signed / Let's Encrypt | Production cert |
| Rate Limiting | Relaxed (500/15min) | Strict (100/15min) |
| Logging | Debug level | Info level |
| Image Tags | `staging-{sha}` | `{sha}` (immutable) |

### Deployment Flow

```
Feature Branch → PR → CI (lint + build)
  └── Merge to main → CI builds images → Updates staging manifests
      └── Manual approval → Updates production manifests
          └── Argo CD auto-syncs production
```

### Argo CD Multi-Environment

```yaml
# Staging Application
spec:
  source:
    path: k8s/staging

# Production Application
spec:
  source:
    path: k8s/production
```

### Rollback

Argo CD provides instant rollback:
1. **UI Rollback** — Click "History" → Select previous revision → "Rollback"
2. **Git Revert** — Revert the commit in infra repo → Argo CD auto-syncs
3. **Image Tag** — Update deployment to previous image SHA

---

## 7. Security Architecture

### Authentication Flow (Instagram-style)

```
Client                    API                     MongoDB
  │                        │                        │
  │── POST /auth/login ───▶│                        │
  │                        │── Verify password ────▶│
  │                        │◄── User found ─────────│
  │                        │                        │
  │                        │── Generate Access Token (15min)
  │                        │── Generate Refresh Token (30d)
  │                        │── Hash & store refresh ▶│
  │                        │                        │
  │◄── { accessToken,      │                        │
  │     refreshToken } ────│                        │
  │                        │                        │
  │── GET /tasks ──────────▶│ (Bearer accessToken)  │
  │  (15 min later: 401)   │                        │
  │                        │                        │
  │── POST /auth/refresh ─▶│                        │
  │  { refreshToken }      │── Find token hash ───▶│
  │                        │── Check reuse ─────────│
  │                        │── Mark old as used ───▶│
  │                        │── Issue new pair ─────▶│
  │◄── { newAccess,        │                        │
  │     newRefresh } ──────│                        │
```

### Token Reuse Detection

If a refresh token that was already used is presented:
1. **The entire token family is revoked** (all sessions in that chain)
2. User must re-authenticate
3. This detects stolen refresh tokens — if an attacker uses the old token, the legitimate user's next refresh will trigger family revocation

---

## 8. Observability

### Structured Logging (Worker)

```json
{
  "timestamp": "2026-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Task abc123 completed successfully",
  "logger": "task-worker"
}
```

### Key Metrics

| Metric | Source | Purpose |
|--------|--------|--------|
| `tasks_processed_total` | Worker logs | Throughput monitoring |
| `tasks_failed_total` | Worker logs | Error rate |
| `queue_length` | Redis `LLEN tasks:queue` | Backlog monitoring |
| `dlq_length` | Redis `LLEN tasks:dlq` | Failed job accumulation |
| API response time | Express `morgan` | Latency tracking |

### Health Endpoints

- `GET /api/health` — API liveness check (returns uptime, status)
- Worker: Redis `PING` check via K8s probe
- MongoDB: `db.adminCommand('ping')` via K8s probe
