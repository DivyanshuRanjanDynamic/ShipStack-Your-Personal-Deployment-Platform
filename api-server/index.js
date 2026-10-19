const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { z } = require('zod')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@clickhouse/client')
const { Kafka } = require('kafkajs')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

const { createDiagnosisRouter } = require('./routes/diagnosis')
const { statusTransitionFor } = require('./src/deployment-status')
const { buildUserEnvJson, MAX_USER_ENV_BYTES } = require('./src/task-env')

require('dotenv').config();


const app = express()
const PORT = 9000

const prisma = new PrismaClient()

const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID,
    brokers: [process.env.KAFKA_BROKER],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
    },
    sasl: {
        mechanism: 'PLAIN',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
    }

})

const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' })
const producer = kafka.producer()
const { createDiagnosisPublisher } = require('./src/publisher')
const publishDiagnosisRequest = createDiagnosisPublisher(prisma, producer)



// By using this client we can execute the sql queries on Clikhouse database.

const client = createClient({
    host: process.env.CLICKHOUSE_HOST,
    username: process.env.KAFKA_USERNAME || 'avnadmin',
    password: process.env.CLICKHOUSE_PASSWORD,
    database: "default",
})



const { SQSClient } = require('@aws-sdk/client-sqs')
const { createWatchdog } = require('./src/watchdog')
const { createSqsPoller } = require('./src/sqs-poller')

const ecsClient = new ECSClient({
    region: process.env.ECS_REGION,
    credentials: {
        accessKeyId: process.env.ECS_ACCESSKEY_ID,
        secretAccessKey: process.env.ECS_SECRET_ACCESSKEY
    }
})

const sqsClient = new SQSClient({
    region: process.env.AWS_REGION || process.env.ECS_REGION || 'eu-north-1',
    credentials: {
        accessKeyId: process.env.ECS_ACCESSKEY_ID,
        secretAccessKey: process.env.ECS_SECRET_ACCESSKEY
    }
})

const config = {
    cluster: process.env.ECS_CLUSTER,
    taskDefinition: process.env.ECS_TASK_DEFINITION,
}

app.use(cors())
app.use(express.json())
app.use(createDiagnosisRouter(prisma))

app.get('/projects', async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            include: {
                deployments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { updatedAt: 'desc' }
        })
        return res.json({ status: "success", data: { projects } })
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch projects", details: err.message })
    }
})

app.get('/project/:id', async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                deployments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        })
        if (!project) return res.status(404).json({ error: "Project not found" })
        return res.json({ status: "success", data: { project } })
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch project", details: err.message })
    }
})

app.get('/project/:id/deployments', async (req, res) => {
    try {
        const deployments = await prisma.deployment.findMany({
            where: { projectId: req.params.id },
            orderBy: { createdAt: 'desc' }
        })
        return res.json({ status: "success", data: { deployments } })
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch deployments", details: err.message })
    }
})

app.get('/project/:id/env', async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            select: { envVars: true }
        })
        if (!project) return res.status(404).json({ error: "Project not found" })
        return res.json({ status: "success", data: { envVars: project.envVars || [] } })
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch env vars", details: err.message })
    }
})

app.put('/project/:id/env', async (req, res) => {
    try {
        const { envVars } = req.body
        const updated = await prisma.project.update({
            where: { id: req.params.id },
            data: { envVars }
        })
        return res.json({ status: "success", data: { envVars: updated.envVars } })
    } catch (err) {
        return res.status(500).json({ error: "Failed to update env vars", details: err.message })
    }
})

app.post('/project', async (req, res) => {

    const schema = z.object({
        gitURL: z.string().url(),
        name: z.string(),
        buildSettings: z.any().optional(),
        envVars: z.any().optional()
    })

    const safeParseResult = schema.safeParse(req.body)

    if (safeParseResult.error) return res.status(400).json({ message: `Invalid input ${safeParseResult.error}` })

    const { gitURL, name, buildSettings, envVars } = safeParseResult.data

    try {
        const project = await prisma.project.create({
            data: {
                gitUrl: gitURL,
                name: name,
                subDomain: generateSlug(),
                buildSettings: buildSettings || null,
                envVars: envVars || null
            },
        })

        return res.json({ status: "success", data: { project } })
    } catch (err) {
        return res.status(500).json({ error: "Failed to create project", details: err.message })
    }
})

function parseEnvList(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
        const normalized = val.replace(/'/g, '"');
        const parsed = JSON.parse(normalized);
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {
        return val.split(',').map(s => s.trim().replace(/^['"\[]|['"\]]$/g, '')).filter(Boolean);
    }
    return [val];
}

app.post('/deploy', async (req, res) => {

    const { projectId } = req.body

    if (!projectId) {
        return res.status(400).json({ error: "projectId is required in request body" })
    }

    // fetch project from db
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    // Serialize user env vars into a single USER_ENV_JSON value for the task.
    const userEnvJson = buildUserEnvJson(project.envVars)
    if (userEnvJson.tooLarge) {
        return res.status(400).json({
            error: `Project environment variables exceed ${MAX_USER_ENV_BYTES} bytes`,
            details: `${userEnvJson.bytes} bytes across ${userEnvJson.count} variables`,
        })
    }

    // deployemnt create in db

    const newDeploymnet = await prisma.deployment.create({
        data: {
            project: { connect: { id: projectId } },
            status: 'QUEUED'
        }
    })

    // spin a container in ECS

    const command = new RunTaskCommand({
        cluster: config.cluster,
        taskDefinition: config.taskDefinition,
        count: 1,
        launchType: 'FARGATE',

        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: parseEnvList(process.env.ECS_SUBNETS),
                securityGroups: parseEnvList(process.env.ECS_SECURITY_GROUP),
            },
        },
        tags: [{ key: "deployment_id", value: newDeploymnet.id }],
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        {
                            name: 'GIT_REPOSITORY_URL',
                            value: project.gitUrl,
                        },
                        {
                            name: 'PROJECT_ID',
                            value: projectId,
                        },
                        {
                            name: 'DEPLOYMENT_ID',
                            value: newDeploymnet.id,
                        },
                        {
                            name: 'ECS_ACCESSKEY_ID',
                            value: process.env.ECS_ACCESSKEY_ID,
                        },
                        {
                            name: 'ECS_SECRET_ACCESSKEY',
                            value: process.env.ECS_SECRET_ACCESSKEY,
                        },
                        {
                            name: 'ECS_REGION',
                            value: process.env.ECS_REGION || 'eu-north-1',
                        },
                        {
                            name: 'KAFKA_BROKER',
                            value: process.env.KAFKA_BROKER,
                        },
                        {
                            name: 'KAFKA_PASSWORD',
                            value: process.env.KAFKA_PASSWORD,
                        },
                        {
                            name: 'KAFKA_USERNAME',
                            value: process.env.KAFKA_USERNAME,
                        },
                        {
                            name: 'USER_ENV_JSON',
                            value: userEnvJson.json,
                        }
                    ],
                },
            ],
        }

    })

    let response;
    try {
        response = await ecsClient.send(command);

        const taskArn = response.tasks?.[0]?.taskArn;

        if (!taskArn) {
            const reason = response.failures?.[0]?.reason || 'No task was started';
            throw new Error(`ECS did not start a task: ${reason}`);
        }
        // Save the mapping that lets an ECS event find this deployment.
        // The build is already running, so a DB hiccup here must not fail the request.
        await prisma.deployment
            .update({
                where: { id: newDeploymnet.id },
                data: { ecsTaskArn: taskArn },
            })
            .catch((e) => console.error('Failed to save ecsTaskArn:', e));

        return res.json({ status: 'queued', data: { deploymentID: newDeploymnet.id } })

    } catch (err) {
        console.error("ECS RunTask failed:", err);
        const failureCode = response?.failures?.[0]?.reason || 'RUNTASK_FAILED';
        await prisma.deployment.update({
            where: { id: newDeploymnet.id },
            data: {
                status: 'FAILURE',
                stopCode: failureCode,
                stoppedReason: err.message,
            }
        }).catch(e => console.error("Failed to set deployment status to FAILURE:", e));

        // Publish diagnosis request on failure (non-blocking)
        publishDiagnosisRequest({
            deploymentId: newDeploymnet.id,
            projectId: projectId,
            gitUrl: project.gitUrl,
            failedStep: 'clone',
            exitCode: 1,
            failureReason: 'NONZERO_EXIT',
            stopCode: failureCode,
            stoppedReason: err.message,
        }).catch(e => console.error("Failed to publish diagnosis request:", e));

        return res.status(500).json({ error: "Failed to spin build container", details: err.message });
    }
})

app.get('/deployment/:id', async (req, res) => {
    const { id } = req.params
    try {
        const deployment = await prisma.deployment.findUnique({ where: { id } })
        if (!deployment) return res.status(404).json({ error: 'Deployment not found' })
        return res.json({ status: 'success', data: { deployment } })
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch deployment', details: err.message })
    }
})

app.get('/logs/:id', async (req, res) => {
    const id = req.params.id
    try {
        const logsResult = await client.query({
            query: `SELECT event_id, log, timestamp FROM log_events WHERE deployment_id = {id: String} ORDER BY timestamp ASC`,
            query_params: { id },
            format: 'JSONEachRow'
        })
        const logs = await logsResult.json()
        return res.json({ status: 'success', data: { logs } })
    } catch (err) {
        console.error("Error fetching logs from ClickHouse:", err)
        return res.status(500).json({ error: 'Failed to fetch logs', details: err.message })
    }
})


async function initKafkaConsumer() {
    await producer.connect().catch(err => console.error("Kafka Producer connect error:", err));
    await consumer.connect();
    await consumer.subscribe({ topics: ['container-logs'], fromBeginning: false })

    await consumer.run({
        autoCommit: false, // We will manually commit after the batch is successfully inserted

        eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
            const messages = batch.messages;
            console.log(`Received batch of ${messages.length} messages on ${batch.topic}`);

            const valuesToInsert = [];
            let lastOffset = null;

            // 1. Process all messages in the batch in memory
            for (const message of messages) {
                try {
                    const stringMessage = message.value.toString();
                    const parsedLogMessage = JSON.parse(stringMessage);
                    const { log, PROJECT_ID, DEPLOYMENT_ID, step, event, exit_code, failure_reason } = parsedLogMessage;

                    if (PROJECT_ID && DEPLOYMENT_ID) {
                        valuesToInsert.push({
                            event_id: uuidv4(),
                            deployment_id: DEPLOYMENT_ID,
                            log: log,
                            metadata: JSON.stringify({ project_id: PROJECT_ID })
                        });

                        // Update deployment status based on build progress log events.
                        // Status-text signals are only honored on platform lines (no step),
                        // so a user's build output cannot spoof its deployment status.
                        const transition = statusTransitionFor({ log, step, event, exit_code });
                        if (transition === 'IN_PROGRESS') {
                            await prisma.deployment.update({
                                where: { id: DEPLOYMENT_ID },
                                data: { status: 'IN_PROGRESS' }
                            }).catch(err => console.error(`Error updating status to IN_PROGRESS:`, err.message));
                        } else if (transition === 'SUCCESS') {
                            await prisma.deployment.update({
                                where: { id: DEPLOYMENT_ID },
                                data: { status: 'SUCCESS' }
                            }).catch(err => console.error(`Error updating status to SUCCESS:`, err.message));
                        } else if (transition === 'FAILURE') {
                            // Atomically mark deployment as FAILURE.
                            // If update count === 1, this is the first failure signal: publish diagnosis request.
                            // If update count === 0, it was already marked FAILURE by an earlier log line: skip duplicate publish.
                            const updateResult = await prisma.deployment.updateMany({
                                where: { id: DEPLOYMENT_ID, status: { not: 'FAILURE' } },
                                data: { status: 'FAILURE' }
                            }).catch(err => {
                                console.error(`Error updating status to FAILURE:`, err.message);
                                return { count: 0 };
                            });

                            if (updateResult && updateResult.count === 1) {
                                // Layer A: publish diagnosis-requests when build fails
                                publishDiagnosisRequest({
                                    deploymentId: DEPLOYMENT_ID,
                                    projectId: PROJECT_ID,
                                    failedStep: step || 'build',
                                    exitCode: typeof exit_code === 'number' ? exit_code : 1,
                                    failureReason: failure_reason || 'NONZERO_EXIT',
                                }).catch(err => console.error(`Error publishing diagnosis request for ${DEPLOYMENT_ID}:`, err.message));
                            }
                        }
                    }

                    lastOffset = message.offset;
                } catch (err) {
                    console.error("Error parsing message:", err);
                }
            }

            // 2. Perform a single bulk insert into ClickHouse
            if (valuesToInsert.length > 0) {
                try {
                    await client.insert({
                        table: 'log_events',
                        values: valuesToInsert,
                        format: 'JSONEachRow',
                    });

                    // 3. Mark the offsets as resolved and commit
                    resolveOffset(lastOffset);
                    await commitOffsetsIfNecessary();
                    await heartbeat();
                    console.log(`Successfully inserted ${valuesToInsert.length} logs`);
                } catch (err) {
                    console.error("Error inserting batch into ClickHouse:", err);
                    // We don't commit offsets here, so Kafka will retry delivering this batch later
                }
            } else {
                // If there were no valid messages, just commit the offsets
                if (lastOffset) {
                    resolveOffset(lastOffset);
                    await commitOffsetsIfNecessary();
                }
            }
        }
    });

}
initKafkaConsumer().catch(err => console.error("Kafka Consumer error:", err));


// ─── gRPC Server ───
const GRPC_PORT = 50051

const packageDefinition = protoLoader.loadSync(
    path.join(__dirname, '../proto/project.proto'),
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
)
const projectProto = grpc.loadPackageDefinition(packageDefinition).project

const diagnosisPackageDefinition = protoLoader.loadSync(
    path.join(__dirname, '../proto/diagnosis.proto'),
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
)
const diagnosisProto = grpc.loadPackageDefinition(diagnosisPackageDefinition).diagnosis

const grpcServer = new grpc.Server()

grpcServer.addService(projectProto.ProjectService.service, {
    GetProjectBySubdomain: async (call, callback) => {
        try {
            const project = await prisma.project.findUnique({
                where: { subDomain: call.request.subdomain }
            })

            if (!project) {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    details: 'Project not found'
                })
            }

            callback(null, {
                id: project.id,
                name: project.name,
                sub_domain: project.subDomain,
                git_url: project.gitUrl
            })
        } catch (err) {
            console.error('gRPC GetProjectBySubdomain error:', err)
            callback({
                code: grpc.status.INTERNAL,
                details: err.message
            })
        }
    }
})

grpcServer.addService(diagnosisProto.DiagnosisService.service, {
    UpsertPending: async (call, callback) => {
        try {
            const deploymentId = call.request.deployment_id;
            const existing = await prisma.diagnosis.findUnique({
                where: { deploymentId }
            });

            if (existing) {
                return callback(null, {
                    id: existing.id,
                    status: existing.status,
                    is_already_done: existing.status === 'DONE'
                });
            }

            const created = await prisma.diagnosis.upsert({
                where: { deploymentId },
                update: {},
                create: {
                    deploymentId,
                    status: 'PENDING',
                    source: 'STUB',
                }
            });

            callback(null, {
                id: created.id,
                status: created.status,
                is_already_done: created.status === 'DONE'
            });
        } catch (err) {
            console.error('gRPC UpsertPending error:', err);
            callback({ code: grpc.status.INTERNAL, details: err.message });
        }
    },
    MarkDone: async (call, callback) => {
        try {
            const {
                deployment_id, category, confidence, root_cause, fix_json, source,
                signature_hash, model, tokens_in, tokens_out, latency_ms,
                prompt_version, pipeline_version, needs_human,
            } = call.request;
            let parsedFixJson = {};
            try {
                parsedFixJson = fix_json ? JSON.parse(fix_json) : {};
            } catch (e) {
                parsedFixJson = {};
            }

            await prisma.diagnosis.update({
                where: { deploymentId: deployment_id },
                data: {
                    status: 'DONE',
                    category,
                    confidence: typeof confidence === 'number' ? confidence : 0,
                    rootCause: root_cause,
                    fixJson: parsedFixJson,
                    source: source || 'STUB',
                    // Phase 2 fields (optional, only set when provided)
                    ...(signature_hash ? { signatureHash: signature_hash } : {}),
                    ...(model ? { model } : {}),
                    ...(tokens_in ? { tokensIn: tokens_in } : {}),
                    ...(tokens_out ? { tokensOut: tokens_out } : {}),
                    ...(latency_ms ? { latencyMs: latency_ms } : {}),
                    ...(prompt_version ? { promptVersion: prompt_version } : {}),
                    ...(pipeline_version ? { pipelineVersion: pipeline_version } : {}),
                    ...(needs_human !== undefined ? { needsHuman: needs_human } : {}),
                }
            });
            callback(null, { success: true });
        } catch (err) {
            console.error('gRPC MarkDone error:', err);
            callback({ code: grpc.status.INTERNAL, details: err.message });
        }
    },
    MarkFailed: async (call, callback) => {
        try {
            const { deployment_id, error_reason } = call.request;
            await prisma.diagnosis.update({
                where: { deploymentId: deployment_id },
                data: {
                    status: 'FAILED',
                    rootCause: error_reason,
                }
            });
            callback(null, { success: true });
        } catch (err) {
            console.error('gRPC MarkFailed error:', err);
            callback({ code: grpc.status.INTERNAL, details: err.message });
        }
    },
    GetDiagnosis: async (call, callback) => {
        try {
            const deploymentId = call.request.deployment_id;
            const diag = await prisma.diagnosis.findUnique({
                where: { deploymentId },
                select: { id: true, status: true }
            });
            if (!diag) {
                return callback({ code: grpc.status.NOT_FOUND, details: 'Diagnosis not found' });
            }
            callback(null, { id: diag.id, status: diag.status });
        } catch (err) {
            console.error('gRPC GetDiagnosis error:', err);
            callback({ code: grpc.status.INTERNAL, details: err.message });
        }
    }
})

grpcServer.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err) => {
        if (err) {
            console.error('Failed to start gRPC server:', err)
            return
        }
        console.log(`gRPC Server running on port ${GRPC_PORT}`)
    }
)

app.listen(PORT, () => console.log(` API Server running on port ${PORT}`))

// ─── Watchdog & SQS Poller Background Services ───
const watchdog = createWatchdog({
    prisma,
    ecsClient,
    cluster: config.cluster,
    intervalMs: 30000,
    provisioningDeadlineMinutes: parseInt(process.env.PROVISIONING_DEADLINE_MINUTES || '10', 10),
})

const sqsPoller = createSqsPoller({
    sqsClient,
    queueUrl: process.env.SQS_QUEUE_URL,
    prisma,
    publishDiagnosisRequest,
    buildDeadlineMinutes: parseInt(process.env.BUILD_DEADLINE_MINUTES || '15', 10),
})

watchdog.start()
if (process.env.SQS_QUEUE_URL) {
    sqsPoller.start()
}

function handleShutdown() {
    console.log('Shutting down background services gracefully...')
    watchdog.stop()
    sqsPoller.stop()
}
process.on('SIGINT', handleShutdown)
process.on('SIGTERM', handleShutdown)
