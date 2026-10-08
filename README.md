# ShipStack-Your-Personal-Deployment-Platform

A personal deployment platform that automates building and hosting frontend applications, turning GitHub repositories into live websites instantly.

![shipStack Architecture](https://img.sanishtech.com/u/a272da655f3432f0be25657628270bbc.png)

## Why I Built This
shipStack was built to simplify the deployment workflow for frontend developers. Inspired by platforms like Vercel and Netlify, it provides a seamless experience for taking a GitHub repository and making it live on the web in minutes. It serves as an exploration into distributed systems, container orchestration, and real-time data streaming.

## Features
- **Automated Builds:** Clones and builds React/Node.js applications directly from GitHub URLs.
- **Containerized Build Environment:** Leverages Docker and AWS ECS to isolate and execute builds securely in the cloud.
- **Real-time Log Streaming:** Streams build logs in real-time using Apache Kafka, persisting them in a high-performance ClickHouse database.
- **S3 Hosting:** Automatically uploads built static assets (HTML, CSS, JS) to AWS S3.
- **Custom Subdomains:** Generates unique subdomains (e.g., `project-id.localhost:8000`) for accessing deployments.
- **Dynamic Reverse Proxy:** Uses a custom reverse proxy that maps subdomains to the correct S3 bucket paths on the fly using gRPC.

## Tech Stack
- **Frontend:** React
- **Backend Services:** Node.js, Express
- **Database (Relational):** PostgreSQL with Prisma ORM
- **Database (OLAP/Logs):** ClickHouse
- **Message Broker:** Apache Kafka
- **Infrastructure & Storage:** Docker, AWS Elastic Container Service (ECS), AWS S3
- **Communication:** gRPC (for internal service communication)

## Architecture
1. **Trigger:** A user provides a GitHub URL via the React frontend.
2. **Orchestration:** The API Server receives the request and provisions a new task on AWS ECS using a custom Docker image (`build-server`).
3. **Build & Upload:** The ECS container clones the repository, runs the build command, and uploads the generated static files (e.g., `dist` or `build` folder) to an AWS S3 bucket.
4. **Log Streaming:** Throughout the build process, logs are pushed to a Kafka topic. A Kafka consumer reads these messages and inserts them into ClickHouse for real-time frontend consumption.
5. **Serving:** When a user visits their assigned subdomain (e.g., `my-app.localhost:8000`), the Reverse Proxy intercepts the request. It makes a gRPC call to the API Server to look up the S3 deployment path for that subdomain, and then proxies the request directly to S3, returning the built assets to the browser.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Docker
- PostgreSQL
- ClickHouse
- Apache Kafka
- AWS Account (with S3 and ECS configured)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shipStack.git
   cd shipStack
   ```

2. Install dependencies for all services:
   ```bash
   cd api-server && npm install
   cd ../build-server && npm install
   cd ../s3-reverse-proxy && npm install
   ```

### Environment Variables
You will need to set up environment variables for the different services. Create a `.env` file in the respective service directories (e.g., `api-server/.env`).

Example for `api-server/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/shipstack"
KAFKA_BROKER="localhost:9092"
CLICKHOUSE_HOST="http://localhost:8123"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="your-aws-region"
ECS_CLUSTER="your-ecs-cluster-name"
ECS_TASK_DEFINITION="your-ecs-task-definition"
```
*(Ensure you configure S3 bucket names and Kafka credentials where necessary across the other services).*

### Running Locally
1. **Start Infrastructure:** Ensure PostgreSQL, Kafka, and ClickHouse are running locally or accessible.
2. **Start the API Server:**
   ```bash
   cd api-server
   npm run postinstall # generates Prisma client
   npm start
   ```
3. **Start the Reverse Proxy:**
   ```bash
   cd s3-reverse-proxy
   npm start
   ```
4. **Start the Frontend (if in repository):**
   ```bash
   cd frontend
   npm start
   ```

*(Note: The build-server runs inside ECS, so you typically push its Docker image to a registry rather than running it directly, unless testing locally).*

## Usage
1. Open the frontend in your browser.
2. Enter a public GitHub repository URL for a React/Node app.
3. Click "Deploy" and watch the real-time build logs.
4. Once completed, click the generated subdomain link to view your live site!

## Testing
Currently, the test suite is minimal. You can run any available tests within each service directory:
```bash
npm test
```

## Challenges & Learnings
- **Real-time Log Streaming:** Setting up a reliable pipeline to stream logs from transient ECS containers to the frontend required integrating Kafka for high-throughput message queuing and ClickHouse for fast reads.
- **Dynamic Routing:** Building a custom reverse proxy capable of dynamic resolution (via gRPC) rather than static configuration was a significant but rewarding challenge to ensure new deployments were instantly accessible without reloading the proxy server.

## Roadmap
- [ ] Add support for private GitHub repositories.
- [ ] Implement custom domains (CNAME mapping).
- [ ] Support more frameworks (Next.js, Vue, Svelte).
- [ ] Add deployment rollbacks and branch previews.

## License
This project is licensed under the ISC License.

## Contact
Your Name - [Your Twitter/LinkedIn](https://www.linkedin.com/in/divyanshu-ranjan-6b3b37277/) - divyanshu.work914214@gmail.com
Project Link: [https://github.com/yourusername/shipStack](https://github.com/yourusername/shipStack)
Portfolio Link: [https://divyanshu.online)

