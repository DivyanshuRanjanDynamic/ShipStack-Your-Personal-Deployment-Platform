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
        username: process.env.USERNAME,
        password: process.env.KAFKA_PASSWORD,
    }

})

const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' })



// By using this client we can execute the sql queries on Clikhouse database.

const client = createClient({
    host: process.env.CLICKHOUSE_HOST,
    username: process.env.USERNAME,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: "default",
})



const ecsClient = new ECSClient({
    region: process.env.ECS_REGION,
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

app.post('/project', async (req, res) => {

    const schema = z.object({
        gitURL: z.string().url(),
        name: z.string()
    })

    const safeParseResult = schema.safeParse(req.body)

    if (safeParseResult.error) return res.status(400).json({ message: `Invalid input ${safeParseResult.error}` })

    const { gitURL, name } = safeParseResult.data

    // now for this gitURL we have to make a deployments / trigger a deployment

    const project = await prisma.project.create({
        data: {
            gitUrl: gitURL,
            name: name,
            subDomain: generateSlug()
        },
    })

    return res.json({ status: "success", data: { project } })

})

app.post('/deploy', async (req, res) => {

    const { projectId } = req.body

    if (!projectId) {
        return res.status(400).json({ error: "projectId is required in request body" })
    }

    // fetch project from db
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    // Check is there any deploynment that is InProgress / Queued

    const runningDeployment = await prisma.deployment.findFirst({
        where: {
            projectId: projectId,
            status: {
                in: ['QUEUED', 'IN_PROGRESS']
            }
        }
    })
    if (runningDeployment) return res.status(400).json({ message: 'Already deploying' })

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
                subnets: process.env.ECS_SUBNETS,
                securityGroups: process.env.ECS_SECURITY_GROUP,
            },
        },

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
                            name: 'USERNAME',
                            value: process.env.USERNAME,
                        }
                    ],
                },
            ],
        }

    })

    try {
        await ecsClient.send(command);
        return res.json({ status: 'queued', data: { deploymentID: newDeploymnet.id } })
    } catch (err) {
        console.error("ECS RunTask failed:", err);
        await prisma.deployment.update({
            where: { id: newDeploymnet.id },
            data: { status: 'FAILURE' }
        }).catch(e => console.error("Failed to set deployment status to FAILURE:", e));
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
                    const { log, PROJECT_ID, DEPLOYMENT_ID } = JSON.parse(stringMessage);

                    if (PROJECT_ID && DEPLOYMENT_ID) {
                        valuesToInsert.push({
                            event_id: uuidv4(),
                            deployment_id: DEPLOYMENT_ID,
                            log: log,
                            metadata: JSON.stringify({ project_id: PROJECT_ID })
                        });

                        // Update deployment status based on build progress log events
                        if (log.includes('Starting the build process......')) {
                            await prisma.deployment.update({
                                where: { id: DEPLOYMENT_ID },
                                data: { status: 'IN_PROGRESS' }
                            }).catch(err => console.error(`Error updating status to IN_PROGRESS:`, err.message));
                        } else if (log.includes('Uploading to S3 Done!!!!!!')) {
                            await prisma.deployment.update({
                                where: { id: DEPLOYMENT_ID },
                                data: { status: 'SUCCESS' }
                            }).catch(err => console.error(`Error updating status to SUCCESS:`, err.message));
                        } else if (log.includes('Build process failed!') || log.includes('Error: Neither')) {
                            await prisma.deployment.update({
                                where: { id: DEPLOYMENT_ID },
                                data: { status: 'FAILURE' }
                            }).catch(err => console.error(`Error updating status to FAILURE:`, err.message));
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
