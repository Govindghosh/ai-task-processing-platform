# AI Task Processing Platform

A distributed, event-driven task processing platform built with the MERN stack, Python workers, Docker, Kubernetes, and Argo CD GitOps.

## System Architecture

```
Frontend (React + Vite) → Backend API (Node.js) → Redis Queue → Python Worker → MongoDB
```

**Key Features:**
- ✅ JWT Authentication (Access + Refresh token rotation)
- ✅ Async task processing with real-time status tracking
- ✅ 4 text operations: uppercase, lowercase, reverse, word count
- ✅ Retry with exponential backoff + Dead-letter queue
- ✅ Horizontal worker scaling via Kubernetes HPA
- ✅ GitOps deployment with Argo CD
- ✅ CI/CD pipeline with GitHub Actions

---

## Prerequisites

- **Node.js** 20+
- **Python** 3.12+
- **Docker** & **Docker Compose**
- **kubectl** (for Kubernetes deployment)
- **MongoDB** 7+
- **Redis** 7+

---

## Quick Start (Local Development)

### 1. Clone the repository

```bash
git clone https://github.com/Govindghosh/ai-task-processing-platform.git
cd ai-task-processing-platform
```

### 2. Set up environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and set your JWT_SECRET

# Worker
cp worker/.env.example worker/.env

# Frontend
cp frontend/.env.example frontend/.env
```

### 3. Run with Docker Compose (Recommended)

```bash
docker-compose up --build
```

This starts all 5 services:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379
- **Worker**: Running in background

### 4. Run without Docker (Development)

```bash
# Terminal 1: Start MongoDB and Redis (must be running locally)

# Terminal 2: Backend
cd backend
npm install
npm run dev

# Terminal 3: Worker
cd worker
pip install -r requirements.txt
python src/worker.py

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/ai-tasks` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing secret | — (required) |
| `ACCESS_TOKEN_EXPIRES` | Access token TTL | `15m` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh token TTL (days) | `30` |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |

### Worker (`worker/.env`)

| Variable | Description | Default |
|----------|------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/ai-tasks` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

---

## API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login and get token pair |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Logout (revoke refresh token family) |
| `/api/auth/logout-all` | POST | Logout all devices |
| `/api/auth/me` | GET | Get current user profile |

### Tasks

| Endpoint | Method | Description |
|----------|--------|------------|
| `/api/tasks` | GET | List tasks (paginated) |
| `/api/tasks/stats` | GET | Get task statistics |
| `/api/tasks/:id` | GET | Get task details + logs |
| `/api/tasks` | POST | Create & enqueue task |
| `/api/tasks/:id/run` | POST | Re-run failed task |

### Health

| Endpoint | Method | Description |
|----------|--------|------------|
| `/api/health` | GET | API health check |

---

## Docker

### Build individual images

```bash
docker build -t ai-tasks-backend ./backend
docker build -t ai-tasks-frontend ./frontend
docker build -t ai-tasks-worker ./worker
```

### Multi-stage builds
All Dockerfiles use multi-stage builds for smaller images and non-root users for security.

---

## Kubernetes Deployment

### 1. Apply manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml    # Edit secrets first!
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 2. Verify deployment

```bash
kubectl get all -n ai-tasks
```

---

## Argo CD Setup

### 1. Install Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 2. Access the UI

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Visit https://localhost:8080
# Username: admin
# Password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### 3. Create Application

```bash
kubectl apply -f k8s/argocd/application.yaml
```

---

## CI/CD Pipeline

The GitHub Actions pipeline runs on push to `main`:

1. **Lint** — ESLint (backend/frontend), flake8 (worker)
2. **Build** — Docker multi-stage build for all 3 services
3. **Push** — Push images to Docker Hub with commit SHA tag
4. **Update Infra** — Auto-update image tags in infra repo → triggers Argo CD sync

### Required GitHub Secrets

| Secret | Description |
|--------|------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password/token |
| `INFRA_REPO_TOKEN` | GitHub PAT with repo access to infra repository |

---

## Project Structure

```
ai-task-processing-platform/
├── .github/workflows/ci.yml     # CI/CD pipeline
├── backend/                      # Node.js + Express API
│   ├── src/
│   │   ├── config/               # DB + Redis config
│   │   ├── middleware/            # JWT auth middleware
│   │   ├── models/               # Mongoose models
│   │   ├── queues/               # Redis queue producer
│   │   ├── routes/               # API routes
│   │   └── server.js             # Express app
│   ├── Dockerfile
│   └── package.json
├── frontend/                     # React + Vite SPA
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── context/              # Auth context provider
│   │   ├── lib/                  # Axios API client
│   │   ├── pages/                # Route pages
│   │   └── schemas/              # Zod validation
│   ├── Dockerfile
│   └── nginx.conf
├── worker/                       # Python worker
│   ├── src/
│   │   ├── processors.py         # Text operation handlers
│   │   └── worker.py             # Queue consumer
│   ├── Dockerfile
│   └── requirements.txt
├── k8s/                          # Kubernetes manifests
│   ├── argocd/                   # Argo CD application
│   └── *.yaml                    # Deployments, services, etc.
├── docs/
│   └── ARCHITECTURE.md           # Architecture document
└── docker-compose.yml            # Local development
```

---

## License

MIT
