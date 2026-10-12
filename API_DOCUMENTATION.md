# ShipStack — Complete Service APIs & Payloads Specification

This document details all APIs, protocols, endpoints, schemas, and payload specifications across all services in the ShipStack deployment and AI diagnosis platform:

- [1. Architecture Overview](#1-architecture-overview)
- [2. `api-server`](#2-api-server)
  - [2.1 HTTP REST Endpoints](#21-http-rest-endpoints)
  - [2.2 gRPC Services (Port 50051)](#22-grpc-services-port-50051)
  - [2.3 AWS SQS Event Consumer](#23-aws-sqs-event-consumer)
  - [2.4 Kafka Producer: `diagnosis-requests`](#24-kafka-producer-diagnosis-requests)
  - [2.5 Kafka Consumer: `container-logs`](#25-kafka-consumer-container-logs)
- [3. `s3-reverse-proxy`](#3-s3-reverse-proxy)
  - [3.1 Dynamic Wildcard Subdomain Proxy](#31-dynamic-wildcard-subdomain-proxy)
  - [3.2 gRPC Client: Project Lookup](#32-grpc-client-project-lookup)
- [4. `ai-service`](#4-ai-service)
  - [4.1 Kafka Consumer: `diagnosis-requests`](#41-kafka-consumer-diagnosis-requests)
  - [4.2 Kafka Dead Letter Queue (DLQ): `diagnosis-requests.dlq`](#42-kafka-dead-letter-queue-dlq-diagnosis-requestsdlq)
  - [4.3 gRPC Client: `DiagnosisService`](#43-grpc-client-diagnosisservice)
- [5. `build-server` (ECS Fargate Task)](#5-build-server-ecs-fargate-task)
  - [5.1 Environment Configuration (Task Ingress)](#51-environment-configuration-task-ingress)
  - [5.2 Kafka Log Stream: `container-logs`](#52-kafka-log-stream-container-logs)
  - [5.3 S3 Build Context Artifact: `build-context.json`](#53-s3-build-context-artifact-build-contextjson)
  - [5.4 S3 Build Output Assets](#54-s3-build-output-assets)

---

## 1. Architecture Overview

```
                      +------------------------------------------+
                      |         Developer / Web Client           |
                      +-------------------+----------------------+
                                          |
                                          v
                      +------------------------------------------+
                      |               api-server                 |
                      |  HTTP: 9000  |  gRPC: 50051 (Server)     |
                      +----+-----------------------+-------------+
                           |                       ^
                 Kafka     |                       | gRPC (DiagnosisService)
        diagnosis-requests |                       |
                           v                       |
                 +-------------------+             |
                 |    ai-service     +-------------+
                 |  (Kafka Consumer) |
                 +---------+---------+
                           |
                           v Kafka DLQ
                 diagnosis-requests.dlq

[Build Pipeline Flow]
api-server ---> AWS ECS (build-server) ---> Kafka (container-logs) ---> api-server ---> ClickHouse
                                       ---> S3 (__outputs & __contexts)
                                       ---> AWS EventBridge / SQS ---> api-server (sqs-poller)

[Hosting / Serving Flow]
Browser (subdomain.localhost:8000) ---> s3-reverse-proxy ---> gRPC (GetProjectBySubdomain) ---> api-server
                                                         ---> AWS S3 (__outputs/<project_id>/)
```

---

## 2. `api-server`

The primary backend API, database controller (PostgreSQL via Prisma), task orchestrator (ECS), and gRPC service provider.

### 2.1 HTTP REST Endpoints

Base URL: `http://localhost:9000`

---

#### `POST /project`
Registers a new project repository and generates a unique subdomain slug.

- **Request Headers**:
  `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "gitURL": "https://github.com/user/my-react-app",
    "name": "my-react-app"
  }
  ```
- **Validation Rules**:
  - `gitURL`: Required, valid URL string (`z.string().url()`)
  - `name`: Required, non-empty string (`z.string()`)
- **Success Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "data": {
      "project": {
        "id": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a",
        "name": "my-react-app",
        "gitUrl": "https://github.com/user/my-react-app",
        "subDomain": "fuzzy-tiger-42",
        "createdAt": "2026-10-10T07:15:23.456Z",
        "updatedAt": "2026-10-10T07:15:23.456Z"
      }
    }
  }
  ```
- **Error Response (`400 Bad Request`)**:
  ```json
  {
    "message": "Invalid input [ZodError: ...]"
  }
  ```

---

#### `POST /deploy`
Initiates a build and deployment task on AWS ECS Fargate for a registered project.

- **Request Headers**:
  `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "projectId": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a"
  }
  ```
- **Validation Rules**:
  - `projectId`: Required string.
  - Returns `400` if another deployment for this project is already in `QUEUED` or `IN_PROGRESS` status.
- **Success Response (`200 OK`)**:
  ```json
  {
    "status": "queued",
    "data": {
      "deploymentID": "fe83af11-a1e3-429e-813b-6a31326cd539"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`:
    ```json
    { "error": "projectId is required in request body" }
    ```
    or
    ```json
    { "message": "Already deploying" }
    ```
  - `404 Not Found`:
    ```json
    { "message": "Project not found" }
    ```
  - `500 Internal Server Error` (e.g. ECS RunTask API failure):
    ```json
    {
      "error": "Failed to spin build container",
      "details": "ECS did not start a task: Capacity error"
    }
    ```

---

#### `GET /deployment/:id`
Retrieves the current metadata, lifecycle status, and ECS execution details for a deployment.

- **URL Parameters**:
  - `id`: Deployment UUID string
- **Success Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "data": {
      "deployment": {
        "id": "fe83af11-a1e3-429e-813b-6a31326cd539",
        "projectId": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a",
        "status": "FAILURE",
        "ecsTaskArn": "arn:aws:ecs:eu-north-1:123456789012:task/shipstack-cluster/abc12345",
        "startedAt": "2026-10-10T07:16:00.000Z",
        "deadlineAt": "2026-10-10T07:31:00.000Z",
        "timedOut": false,
        "stopCode": "EssentialContainerExited",
        "stoppedReason": "Essential container in task exited",
        "createdAt": "2026-10-10T07:15:45.000Z",
        "updatedAt": "2026-10-10T07:16:30.000Z"
      }
    }
  }
  ```
- **Error Responses**:
  - `404 Not Found`:
    ```json
    { "error": "Deployment not found" }
    ```
  - `500 Internal Server Error`:
    ```json
    { "error": "Failed to fetch deployment", "details": "..." }
    ```

---

#### `GET /logs/:id`
Fetches all chronological log lines emitted by the container from Aiven ClickHouse.

- **URL Parameters**:
  - `id`: Deployment UUID string
- **Success Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "data": {
      "logs": [
        {
          "event_id": "893c5c84-18c9-4b35-86f7-41804c8f0c2a",
          "log": "[clone:start]",
          "timestamp": "2026-10-10 07:16:02.123"
        },
        {
          "event_id": "902d6d95-29d0-5c46-97e8-52915d901d3b",
          "log": "[clone] fatal: repository 'https://github.com/nonexistent/repo' not found",
          "timestamp": "2026-10-10 07:16:05.456"
        },
        {
          "event_id": "013e7ea6-30e1-6d57-08f9-63026e012e4c",
          "log": "[clone:end] exit_code=1",
          "timestamp": "2026-10-10 07:16:05.789"
        }
      ]
    }
  }
  ```
- **Error Response (`500 Internal Server Error`)**:
  ```json
  {
    "error": "Failed to fetch logs",
    "details": "..."
  }
  ```

---

#### `GET /deployments/:id/diagnosis` (or `/deployment/:id/diagnosis`)
Returns the deterministic or LLM-generated diagnosis and fix steps for a failed deployment.

- **URL Parameters**:
  - `id`: Deployment UUID string
- **Response Headers**:
  `Cache-Control: no-store`
- **Response States (`200 OK`)**:

  1. **Deployment Succeeded or In Progress (`NOT_APPLICABLE`)**:
     ```json
     {
       "status": "NOT_APPLICABLE"
     }
     ```

  2. **Deployment Failed, Diagnosis Processing (`PENDING`)**:
     ```json
     {
       "status": "PENDING"
     }
     ```

  3. **Diagnosis Completed (`DONE`)**:
     ```json
     {
       "status": "DONE",
       "diagnosis": {
         "category": "CLONE_FAILED",
         "confidence": 0.95,
         "root_cause": "Git repository could not be cloned. Repository may be private or URL is incorrect.",
         "fix_steps": [
           {
             "step": "Verify the repository URL exists and is publicly accessible.",
             "type": "config"
           },
           {
             "step": "Provide valid Git authentication credentials if the repository is private.",
             "type": "env"
           }
         ],
         "evidence": [
           {
             "line": 2,
             "text": "fatal: repository 'https://github.com/nonexistent/repo' not found"
           }
         ],
         "source": "STUB"
       }
     }
     ```

  4. **Diagnosis Generation Failed (`FAILED`)**:
     ```json
     {
       "status": "FAILED",
       "error": "Diagnosis generation failed. Please inspect build logs manually."
     }
     ```

- **Error Responses**:
  - `404 Not Found`:
    ```json
    { "error": "Deployment not found" }
    ```
  - `500 Internal Server Error`:
    ```json
    { "error": "Failed to fetch diagnosis", "details": "..." }
    ```

---

### 2.2 gRPC Services (Port 50051)

`api-server` hosts an internal gRPC server allowing microservices (`s3-reverse-proxy` and `ai-service`) to interact directly without duplicating the Prisma ORM or database credentials.

#### `project.ProjectService` (from `proto/project.proto`)

##### `rpc GetProjectBySubdomain (GetProjectRequest) returns (GetProjectResponse)`
Used by `s3-reverse-proxy` to resolve subdomain requests.

- **`GetProjectRequest`**:
  ```protobuf
  message GetProjectRequest {
    string subdomain = 1; // e.g. "fuzzy-tiger-42"
  }
  ```
- **`GetProjectResponse`**:
  ```protobuf
  message GetProjectResponse {
    string id = 1;         // Project UUID
    string name = 2;       // Project name
    string sub_domain = 3; // Subdomain slug
    string git_url = 4;    // Git repository URL
  }
  ```
- **gRPC Error Codes**:
  - `NOT_FOUND (5)`: Subdomain does not match any project.
  - `INTERNAL (13)`: Database error.

---

#### `diagnosis.DiagnosisService` (from `proto/diagnosis.proto`)

##### `rpc UpsertPending (UpsertPendingRequest) returns (UpsertPendingResponse)`
Atomically creates or checks the PENDING status for idempotency before running the AI diagnosis pipeline.

- **`UpsertPendingRequest`**:
  ```protobuf
  message UpsertPendingRequest {
    string deployment_id = 1;
  }
  ```
- **`UpsertPendingResponse`**:
  ```protobuf
  message UpsertPendingResponse {
    string id = 1;              // Diagnosis record ID
    string status = 2;          // "PENDING" | "DONE" | "FAILED"
    bool is_already_done = 3;   // true if status === 'DONE'
  }
  ```

##### `rpc MarkDone (MarkDoneRequest) returns (MarkDoneResponse)`
Persists the final diagnosis output into the database.

- **`MarkDoneRequest`**:
  ```protobuf
  message MarkDoneRequest {
    string deployment_id = 1;
    string category = 2;       // Taxonomy category (e.g. "CLONE_FAILED")
    float confidence = 3;      // 0.0 to 1.0
    string root_cause = 4;     // Root cause description
    string fix_json = 5;       // Serialized JSON with { fix_steps: [], evidence: [] }
    string source = 6;         // "STUB" | "RULES" | "LLM" | "CACHE"
  }
  ```
- **`MarkDoneResponse`**:
  ```protobuf
  message MarkDoneResponse {
    bool success = 1;          // true on successful update
  }
  ```

##### `rpc MarkFailed (MarkFailedRequest) returns (MarkFailedResponse)`
Marks the diagnosis record as `FAILED` if the pipeline exhausts all retries.

- **`MarkFailedRequest`**:
  ```protobuf
  message MarkFailedRequest {
    string deployment_id = 1;
    string error_reason = 2;
  }
  ```
- **`MarkFailedResponse`**:
  ```protobuf
  message MarkFailedResponse {
    bool success = 1;
  }
  ```

##### `rpc GetDiagnosis (GetDiagnosisRequest) returns (GetDiagnosisResponse)`
Queries the current diagnosis status for a deployment.

- **`GetDiagnosisRequest`**:
  ```protobuf
  message GetDiagnosisRequest {
    string deployment_id = 1;
  }
  ```
- **`GetDiagnosisResponse`**:
  ```protobuf
  message GetDiagnosisResponse {
    string id = 1;
    string status = 2;
  }
  ```

---

### 2.3 AWS SQS Event Consumer

`api-server/src/sqs-poller.js` continuously polls the SQS queue fed by AWS EventBridge for ECS Task State Changes.

- **Queue Name**: `shipstack-ecs-events`
- **Dead Letter Queue**: `shipstack-ecs-events-dlq`
- **Message Payload Format (AWS ECS Task State Change)**:
  ```json
  {
    "version": "0",
    "id": "12345678-1234-1234-1234-123456789012",
    "detail-type": "ECS Task State Change",
    "source": "aws.ecs",
    "time": "2026-10-10T07:16:30Z",
    "region": "eu-north-1",
    "resources": [
      "arn:aws:ecs:eu-north-1:123456789012:task/shipstack-cluster/abc12345"
    ],
    "detail": {
      "clusterArn": "arn:aws:ecs:eu-north-1:123456789012:cluster/shipstack-cluster",
      "taskArn": "arn:aws:ecs:eu-north-1:123456789012:task/shipstack-cluster/abc12345",
      "lastStatus": "STOPPED",
      "desiredStatus": "STOPPED",
      "stopCode": "EssentialContainerExited",
      "stoppedReason": "Essential container in task exited",
      "containers": [
        {
          "name": "builder-image",
          "exitCode": 1,
          "lastStatus": "STOPPED",
          "reason": "Container exit"
        }
      ]
    }
  }
  ```

---

### 2.4 Kafka Producer: `diagnosis-requests`

Published by `api-server` whenever a deployment fails (either via Layer A in-band failure detection or Layer B out-of-band via SQS/Watchdog).

- **Kafka Topic**: `diagnosis-requests`
- **Message Key**: `deployment_id`
- **Message Value Schema**:
  ```json
  {
    "deployment_id": "fe83af11-a1e3-429e-813b-6a31326cd539",
    "project_id": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a",
    "user_id": null,
    "git_url": "https://github.com/user/my-react-app",
    "failed_step": "clone",
    "exit_code": 1,
    "failure_reason": "CLONE_FAILED",
    "context_s3_key": "__contexts/fd9f081b-5aa8-4f11-9a42-aefa53ed591a/fe83af11-a1e3-429e-813b-6a31326cd539/build-context.json",
    "failed_at": "2026-10-10T07:16:30.000Z",
    "stop_code": "EssentialContainerExited",
    "stopped_reason": "Essential container in task exited"
  }
  ```
- **Allowed `failed_step` values**: `"clone" | "install" | "build" | "upload"`
- **Allowed `failure_reason` values**: `"TASK_OOM" | "TIMEOUT" | "NONZERO_EXIT" | "UPLOAD_EMPTY" | "CLONE_FAILED"`

---

### 2.5 Kafka Consumer: `container-logs`

- **Kafka Topic**: `container-logs`
- **Consumer Group**: `api-server-logs-consumer`
- **Action**: Ingests incoming log events and executes batch inserts into ClickHouse table `log_events`.

---

## 3. `s3-reverse-proxy`

Reverse proxy running on port `8000` that dynamically maps subdomain requests to deployed static assets in AWS S3.

### 3.1 Dynamic Wildcard Subdomain Proxy

- **Host Pattern**: `http://<subdomain>.localhost:8000/<path>`
- **Behavior**:
  1. Parses subdomain from `req.hostname`.
  2. Queries `api-server` via gRPC `GetProjectBySubdomain({ subdomain })`.
  3. If resolved, reverse proxies request to S3 bucket origin:
     `https://shipstack-s3.s3.eu-north-1.amazonaws.com/__outputs/<project_id>/<path>`
  4. Automatically rewrites `/` to `/index.html`.
- **Responses**:
  - `200 OK`: Serves static web assets (HTML, CSS, JS, images) from S3.
  - `404 Not Found`: `'Project Not Found'` if the subdomain does not exist.
  - `502 Bad Gateway`: `'Service Unavailable'` if `api-server` gRPC server is down.

### 3.2 gRPC Client: Project Lookup

- **Service Called**: `project.ProjectService.GetProjectBySubdomain`
- **Target**: `localhost:50051` (Configured via `API_GRPC_URL`)

---

## 4. `ai-service`

Event-driven worker analyzing failed builds and producing structured diagnosis reports.

### 4.1 Kafka Consumer: `diagnosis-requests`

- **Kafka Topic**: `diagnosis-requests`
- **Consumer Group**: `ai-service-diagnosis`
- **Ingress Message Payload**: Validated strictly against `DiagnosisRequest` Zod schema (see Section 2.4).
- **Processing Steps**:
  1. Parse JSON payload.
  2. Validate contract with Zod. (Invalid payloads sent to DLQ immediately).
  3. Call gRPC `UpsertPending(deployment_id)`. If `is_already_done` is true, skip.
  4. Run pipeline (preprocess logs, evaluate rule engine / LLM, build structured fix steps).
  5. Call gRPC `MarkDone(deployment_id, result)`.
  6. Commit Kafka offset upon completion.

---

### 4.2 Kafka Dead Letter Queue (DLQ): `diagnosis-requests.dlq`

Published when a message is unparseable, violates contract validation, or fails after 3 pipeline execution retries.

- **Topic**: `diagnosis-requests.dlq`
- **Message Key**: `deployment_id` (or `"unknown"`)
- **Message Value**:
  ```json
  {
    "original_message": {
      "deployment_id": "fe83af11-a1e3-429e-813b-6a31326cd539",
      "project_id": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a"
    },
    "error": "Contract validation failed: git_url: Invalid url",
    "received_at": "2026-10-10T07:20:15.123Z"
  }
  ```

---

### 4.3 gRPC Client: `DiagnosisService`

Connects to `api-server:50051` using `proto/diagnosis.proto`.
- Invokes:
  - `UpsertPending`
  - `MarkDone`
  - `MarkFailed`
  - `GetDiagnosis`

---

## 5. `build-server` (ECS Fargate Task)

Containerized builder executing inside AWS ECS Fargate Stockholm (`eu-north-1`).

### 5.1 Environment Configuration (Task Ingress)

Injected by `api-server` during `RunTaskCommand`:
- `GIT_REPOSITORY_URL`: Git repository to clone.
- `PROJECT_ID`: ShipStack Project UUID.
- `DEPLOYMENT_ID`: ShipStack Deployment UUID.
- `ECS_ACCESSKEY_ID`, `ECS_SECRET_ACCESSKEY`, `ECS_REGION`: AWS credentials for S3 uploads.
- `KAFKA_BROKER`, `KAFKA_USERNAME`, `KAFKA_PASSWORD`: Aiven Kafka credentials.

---

### 5.2 Kafka Log Stream: `container-logs`

- **Kafka Topic**: `container-logs`
- **Message Key**: `'log'`
- **Message Value Payloads**:

  - **Regular Log Output**:
    ```json
    {
      "PROJECT_ID": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a",
      "DEPLOYMENT_ID": "fe83af11-a1e3-429e-813b-6a31326cd539",
      "log": "[install] added 250 packages in 4s",
      "step": "install"
    }
    ```

  - **Step Start Marker**:
    ```json
    {
      "PROJECT_ID": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a",
      "DEPLOYMENT_ID": "fe83af11-a1e3-429e-813b-6a31326cd539",
      "log": "[build:start]",
      "step": "build",
      "event": "step_start"
    }
    ```

  - **Step End Marker**:
    ```json
    {
      "PROJECT_ID": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a",
      "DEPLOYMENT_ID": "fe83af11-a1e3-429e-813b-6a31326cd539",
      "log": "[build:end] exit_code=0",
      "step": "build",
      "event": "step_end",
      "exit_code": 0
    }
    ```

  - **Step Failure Marker**:
    ```json
    {
      "PROJECT_ID": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a",
      "DEPLOYMENT_ID": "fe83af11-a1e3-429e-813b-6a31326cd539",
      "log": "[clone:end] exit_code=1",
      "step": "clone",
      "event": "step_end",
      "exit_code": 1,
      "failure_reason": "CLONE_FAILED"
    }
    ```

---

### 5.3 S3 Build Context Artifact: `build-context.json`

Uploaded by `build-server` to S3 bucket `shipstack-s3` prior to running build commands to give diagnosis pipelines context on framework and dependencies.

- **S3 Key**: `__contexts/<PROJECT_ID>/<DEPLOYMENT_ID>/build-context.json`
- **Content-Type**: `application/json`
- **Payload Schema**:
  ```json
  {
    "projectId": "fd9f081b-5aa8-4f11-9a42-aefa53ed591a",
    "deploymentId": "fe83af11-a1e3-429e-813b-6a31326cd539",
    "gitUrl": "https://github.com/user/my-react-app",
    "framework": "vite",
    "packageJson": {
      "name": "my-react-app",
      "version": "0.0.1",
      "scripts": {
        "build": "vite build"
      },
      "dependencies": {
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      },
      "devDependencies": {
        "vite": "^5.0.0"
      }
    },
    "buildCommand": "npm run build",
    "expectedOutputDir": "dist",
    "generatedAt": "2026-10-10T07:16:15.000Z"
  }
  ```

---

### 5.4 S3 Build Output Assets

Uploaded upon successful build completion:
- **S3 Key Pattern**: `__outputs/<PROJECT_ID>/<asset_path>` (e.g. `__outputs/<PROJECT_ID>/index.html`, `__outputs/<PROJECT_ID>/assets/index.js`)
- **Metadata**: Content-Type inferred via `mime-types`.
