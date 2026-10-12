# ShipStack-Your-Personal-Deployment-Platform

ShipStack is a developer-centric, Vercel-like cloud deployment platform that automates building, orchestrating, deploying, and serving web applications directly from Git repositories.


It features a full microservice architecture: **React 19 Frontend**, **Express + Prisma API Server**, **AWS ECS Fargate Build Containers**, **Kafka → ClickHouse Log Streaming**, **S3 Reverse Proxy with gRPC**, and an **Autonomous AI Deployment Diagnosis Pipeline (Rules + RAG + LLM)**.

![shipStack Architecture](https://img.sanishtech.com/u/a272da655f3432f0be25657628270bbc.png)


---

## Architecture Overview

```
                      ┌──────────────────────┐
                      │   Frontend (React)   │
                      │   localhost:5174     │
                      └──────────┬───────────┘
                                 │ HTTP (REST)
                                 ▼
                      ┌──────────────────────┐
                      │      API Server      │ (Express + Prisma / PostgreSQL)
                      │    localhost:9000    │
                      └───┬──────────────┬───┘
                          │              │
       RunTask (Fargate)  │              │ gRPC (:50051)
                          ▼              ▼
         ┌──────────────────┐    ┌───────────────────────────┐
         │ AWS ECS Builder  │    │     S3 Reverse Proxy      │
         │ (build-server)   │    │      localhost:8000       │
         └────────┬─────────┘    └─────────────┬─────────────┘
                  │                            │
   Kafka Logs     │ Upload Assets              │ Proxy Assets
                  ▼                            ▼
         ┌──────────────────┐            ┌───────────┐
         │   Kafka Topic    │            │  AWS S3   │
         │ (container-logs) │            │  Buckets  │
         └────────┬─────────┘            └───────────┘
                  │
   Consume & Bulk │
                  ▼
         ┌──────────────────┐
         │    ClickHouse    │
         │  (log_events)    │
         └────────┬─────────┘
                  │ Query Context
                  ▼
         ┌──────────────────┐
         │    AI Service    │ (Kafka: diagnosis-requests)
         │  (Rules+RAG+LLM) │ ── gRPC MarkDone ──► API Server
         └──────────────────┘
```

---

## Target Product Flow

1. **Dashboard (`/`)**:
   - Lists all projects registered in PostgreSQL with project name, Git repository link, generated production URL, latest deployment status badge (`Ready`, `Building`, `Failed`), and relative timestamp.
   - Includes real-time search filtering, loading skeletons, and an empty state with a "New Project" callout.

2. **New Project (`/new`)**:
   - Form with Git repository URL validation (GitHub), project name auto-population, and collapsible build specifications (root dir, install command, build command, output dir).
   - **Environment Variables Section**: Key/value rows, add/remove rows, bulk `.env` paste drawer, masked values with explicit reveal eye toggle, and key validation (no spaces, unique keys).
   - Single atomic submission creates the project (`POST /project`) and immediately triggers its first build (`POST /deploy`), redirecting straight to the deployment view.

3. **Project Management Page (`/projects/:projectId`)**:
   - Header with project title, Git repository, live production URL preview, and a **Redeploy** button.
   - **Deployments Tab**: Chronological list of all deployments (UUID, branch badge, status tag, duration, timestamps, preview URL, and direct link to terminal logs). Auto-polls active builds.
   - **Environment Variables Tab**: Manage project secrets. Displays warning banner: *"Changes apply to the next deployment. Redeploy to apply."* with a quick "Redeploy Now" action.
   - **Settings Tab**: View project metadata and build configurations.

4. **Deployment Page (`/projects/:projectId/deployments/:deploymentId`)**:
   - **Status Timeline**: `Queued` → `Building` → `Ready` / `Failed`.
   - **Live Streaming Logs**: Queries ClickHouse with pause/resume controls, auto-scroll toggle, timestamp display, deduplication, full log copy with clipboard feedback, real-time log keyword filtering, and syntax error highlighting.
   - **AI Deployment Diagnosis**: Triggered on failed builds (`FAILURE`). Displays root cause analysis, error taxonomy category, confidence meter, actionable remediation steps (`config`, `code`, `env`), and log evidence excerpts with line numbers.
   - **Redeploy**: Initiates a new independent deployment under the project without mutating previous runs.

---

## Service Inventory & Ports

| Service | Technology | Port | Purpose |
|---|---|---|---|
| **frontend** | React 19, Vite, React Query | `5174` | Unified SaaS dashboard, project management, and live log console |
| **api-server** | Node.js, Express, Prisma, KafkaJS | `9000` (HTTP) / `50051` (gRPC) | Core REST API, ECS orchestration, and internal gRPC resolution |
| **s3-reverse-proxy** | Node.js, Express, `@aws-sdk/client-s3` | `8000` | Dynamic subdomain router resolving `<subdomain>.localhost:8000` to S3 assets |
| **ai-service** | Node.js, TypeScript, KafkaJS, LLM | Background Daemon | Consumes build failures, applies heuristic rules + RAG, and produces root cause fixes |
| **build-server** | Docker, AWS ECS Fargate | Cloud Container | Clones Git repositories, runs builds, streams Kafka logs, and uploads artifacts to S3 |

---

## Getting Started

### Prerequisites

- **Node.js** v18+ or v20+
- **PostgreSQL** database (e.g. Aiven or local Postgres)
- **Apache Kafka** broker
- **ClickHouse** database
- **AWS Account** with ECS Fargate cluster and an S3 bucket configured

---

### Step 1: Environment Variables Setup

#### 1. API Server (`api-server/.env`)
```env
PORT=9000
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/defaultdb?sslmode=require"

# AWS ECS & S3
ECS_CLUSTER="shipstack-cluster"
ECS_TASK_DEFINITION="shipstack-builder"
ECS_REGION="eu-north-1"
ECS_ACCESSKEY_ID="<your-access-key>"
ECS_SECRET_ACCESSKEY="<your-secret-key>"
ECS_SUBNETS="['subnet-xxx', 'subnet-yyy']"
ECS_SECURITY_GROUP="['sg-zzz']"

# Kafka & ClickHouse
KAFKA_BROKER="<kafka-host>:<port>"
KAFKA_USERNAME="<kafka-username>"
KAFKA_PASSWORD="<kafka-password>"
KAFKA_CLIENT_ID="api-server"
CLICKHOUSE_HOST="https://<clickhouse-host>:<port>"
CLICKHOUSE_PASSWORD="<clickhouse-password>"
```

#### 2. Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL="http://localhost:9000"
```

#### 3. S3 Reverse Proxy (`s3-reverse-proxy/.env`)
```env
PORT=8000
AWS_ACCESSKEY_ID="<your-access-key>"
AWS_SECRET_ACCESSKEY="<your-secret-key>"
AWS_REGION="eu-north-1"
S3_BUCKET_NAME="<your-bucket-name>"
API_SERVER_GRPC_HOST="localhost:50051"
```

#### 4. AI Service (`ai-service/.env`)
```env
KAFKA_BROKER="<kafka-host>:<port>"
KAFKA_USERNAME="<kafka-username>"
KAFKA_PASSWORD="<kafka-password>"
CLICKHOUSE_HOST="https://<clickhouse-host>:<port>"
CLICKHOUSE_PASSWORD="<clickhouse-password>"
API_SERVER_GRPC_HOST="localhost:50051"
GEMINI_API_KEY="<your-gemini-key>"
```

---

### Step 2: Database Setup

From `api-server`:
```bash
cd api-server
npm install
npx prisma db push
```

---

### Step 3: Running the Application Services

Open separate terminal windows for each service:

<<<<<<< HEAD
#### 1. Start the API Server
```bash
cd api-server
node index.js
# Runs HTTP on http://localhost:9000 and gRPC on port 50051
```

#### 2. Start the S3 Reverse Proxy
```bash
cd s3-reverse-proxy
node index.js
# Runs reverse proxy on http://localhost:8000
```

#### 3. Start the AI Diagnosis Service
```bash
cd ai-service
npm install
npm run dev
# Consumes build failure signals and generates diagnoses
```

#### 4. Start the Frontend
```bash
cd frontend
npm install
npm run dev
# Opens Vite dashboard at http://localhost:5174
```

---

## API Endpoints Reference

### Projects & Deployments
- `GET /projects` — Returns all projects with their most recent deployment.
- `GET /project/:id` — Returns single project metadata and history.
- `POST /project` — Creates a project repository with optional `buildSettings` and `envVars`.
- `GET /project/:id/deployments` — Lists all deployments for a given project.
- `POST /deploy` — Dispatches a new ECS build task and returns `{ deploymentID }`.
- `GET /deployment/:id` — Returns status, timestamps, and ECS details for a deployment.
- `GET /logs/:id` — Queries ClickHouse for build log lines for a deployment.
- `GET /project/:id/env` — Fetches environment variables stored on a project.
- `PUT /project/:id/env` — Saves environment variables for a project.

### AI Diagnosis
- `GET /deployments/:id/diagnosis` — Returns `{ status: "PENDING" | "DONE" | "FAILED" | "NOT_APPLICABLE", diagnosis: { ... } }`.

---

## Manual Verification & Testing Guide

1. Open `http://localhost:5174/` in your browser.
2. In the Network tab, observe `GET http://localhost:9000/projects` loading the registered projects.
3. Click **"New Project"** (or visit `/new`), enter a GitHub repo URL, configure environment variables, and submit.
4. Verify the automatic redirect to `/projects/:projectId/deployments/:deploymentId`.
5. Observe the status timeline and live streaming log console. Test Pause/Resume, Auto-scroll, and log keyword filtering.
6. Return to `/projects/:projectId`:
   - Inspect the **Deployments** tab.
   - Open the **Environment Variables** tab, add or edit variables, and click **Save**.
   - Click **Redeploy** to trigger another build task without mutating previous runs.
=======
## Contact
Your Name - [Your Twitter/LinkedIn](https://www.linkedin.com/in/divyanshu-ranjan-6b3b37277/) - divyanshu.work914214@gmail.com
Project Link: [https://github.com/yourusername/shipStack](https://github.com/yourusername/shipStack)
Portfolio Link: [https://divyanshu.online)

>>>>>>> origin
