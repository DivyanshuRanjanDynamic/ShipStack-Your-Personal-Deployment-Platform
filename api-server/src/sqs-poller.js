const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { parseEcsEvent, mapEcsEventToFailureReason } = require('./event-mapper');

/**
 * Creates and runs the SQS Poller for ECS Task State Change events.
 */
function createSqsPoller({
    sqsClient,
    queueUrl = process.env.SQS_QUEUE_URL,
    prisma,
    publishDiagnosisRequest,
    buildDeadlineMinutes = 15,
}) {
    let isRunning = false;
    let abortController = null;

    async function handleEvent(eventPayload) {
        const parsed = parseEcsEvent(eventPayload);
        if (!parsed) {
            console.warn('[sqs-poller] Message is not an ECS Task State Change event');
            return { handled: false, reason: 'unrecognized_event' };
        }

        const { taskArn, lastStatus, startedAt, stoppedAt, stopCode, stoppedReason, rawDetail } = parsed;

        // 9.5 Race tolerance: Match deployment strictly by taskArn.
        const deployment = await prisma.deployment.findUnique({
            where: { ecsTaskArn: taskArn },
            include: { diagnosis: true, project: true },
        });

        if (!deployment) {
            // Task might have stopped before ecsTaskArn was saved.
            // DO NOT delete the message; leave it for SQS redrive.
            console.warn(`[sqs-poller] No deployment found matching taskArn ${taskArn}, leaving message for retry`);
            return { handled: false, reason: 'unmatched_task_arn' };
        }

        // 9.3 RUNNING event: record startedAt and deadlineAt (only if not already set)
        if (lastStatus === 'RUNNING') {
            if (!deployment.startedAt) {
                const eventStartedAt = startedAt || new Date();
                const deadlineAt = new Date(eventStartedAt.getTime() + buildDeadlineMinutes * 60 * 1000);

                try {
                    await prisma.deployment.update({
                        where: { id: deployment.id },
                        data: {
                            startedAt: eventStartedAt,
                            deadlineAt: deadlineAt,
                            status: deployment.status === 'NOT_STARTED' || deployment.status === 'QUEUED'
                                ? 'IN_PROGRESS'
                                : deployment.status,
                        },
                    });
                    console.log(`[sqs-poller] Recorded startedAt and deadlineAt for deployment ${deployment.id}`);
                } catch (err) {
                    console.error('[sqs-poller] Error saving startedAt:', err.message);
                    return { handled: false, reason: 'db_update_failed' };
                }
            }
            return { handled: true, action: 'running_recorded' };
        }

        // 9.3 STOPPED event: record stopCode, stoppedReason, evaluate outcome
        if (lastStatus === 'STOPPED') {
            try {
                await prisma.deployment.update({
                    where: { id: deployment.id },
                    data: {
                        stopCode: stopCode || deployment.stopCode,
                        stoppedReason: stoppedReason || deployment.stoppedReason,
                    },
                });
            } catch (err) {
                console.error('[sqs-poller] Error updating stop metadata:', err.message);
                return { handled: false, reason: 'db_update_failed' };
            }

            // Map failure reason
            const failureReason = mapEcsEventToFailureReason(rawDetail, deployment);

            if (failureReason) {
                // Deployment failed!
                console.log(`[sqs-poller] Deployment ${deployment.id} mapped to failureReason: ${failureReason}`);

                // 9.6 Delivery semantics: If diagnosis already exists, drop and log
                if (deployment.diagnosis) {
                    console.log(`[sqs-poller] Diagnosis row already exists for ${deployment.id}, dropping event`);
                    return { handled: true, action: 'duplicate_dropped' };
                }

                // If deployment is already terminal (e.g. Layer A handled failure, or SUCCESS) and not a watchdog timeout, drop
                if (deployment.status === 'SUCCESS' || (deployment.status === 'FAILURE' && !deployment.timedOut)) {
                    console.log(`[sqs-poller] Deployment ${deployment.id} is already in terminal state (${deployment.status}), dropping event`);
                    return { handled: true, action: 'already_terminal_dropped' };
                }

                // Mark deployment as FAILURE if not already terminal
                if (deployment.status !== 'FAILURE') {
                    try {
                        await prisma.deployment.update({
                            where: { id: deployment.id },
                            data: { status: 'FAILURE' },
                        });
                    } catch (err) {
                        console.error('[sqs-poller] Error setting FAILURE status:', err.message);
                        return { handled: false, reason: 'db_update_failed' };
                    }
                }

                // Publish to Kafka FIRST, then message will be deleted by caller
                if (publishDiagnosisRequest) {
                    try {
                        const pubResult = await publishDiagnosisRequest({
                            deploymentId: deployment.id,
                            projectId: deployment.projectId,
                            gitUrl: deployment.project?.gitUrl,
                            failedStep: failureReason === 'CLONE_FAILED' ? 'clone' : 'build',
                            exitCode: parsed.exitCode !== null ? parsed.exitCode : 1,
                            failureReason: failureReason,
                            stopCode: stopCode,
                            stoppedReason: stoppedReason,
                        });

                        if (pubResult && pubResult.error) {
                            console.error(`[sqs-poller] Kafka publish failed for deployment ${deployment.id}: ${pubResult.error}`);
                            return { handled: false, reason: 'kafka_publish_failed' };
                        }
                    } catch (pubErr) {
                        console.error(`[sqs-poller] Kafka publish threw for deployment ${deployment.id}:`, pubErr.message);
                        return { handled: false, reason: 'kafka_publish_failed' };
                    }
                }
            } else {
                console.log(`[sqs-poller] Task stopped cleanly (exit code 0) for deployment ${deployment.id}`);
            }

            return { handled: true, action: 'stopped_processed' };
        }

        return { handled: true, action: 'other_status_ignored' };
    }

    async function pollLoop() {
        if (!queueUrl) {
            console.warn('[sqs-poller] SQS_QUEUE_URL is not set, poller loop will not start');
            return;
        }

        console.log(`[sqs-poller] Starting SQS polling loop for ${queueUrl}`);

        while (isRunning) {
            try {
                const receiveCommand = new ReceiveMessageCommand({
                    QueueUrl: queueUrl,
                    MaxNumberOfMessages: 10,
                    WaitTimeSeconds: 20, // Long-polling explicit 20s
                });

                const response = await sqsClient.send(receiveCommand);
                const messages = response.Messages || [];

                for (const msg of messages) {
                    if (!isRunning) break;

                    let bodyObj;
                    try {
                        bodyObj = JSON.parse(msg.Body);
                    } catch (parseErr) {
                        console.error(`[sqs-poller] Malformed JSON in SQS message ${msg.MessageId}, leaving for DLQ`);
                        continue;
                    }

                    const result = await handleEvent(bodyObj);

                    // Delete message ONLY if successfully handled
                    if (result && result.handled) {
                        try {
                            const deleteCommand = new DeleteMessageCommand({
                                QueueUrl: queueUrl,
                                ReceiptHandle: msg.ReceiptHandle,
                            });
                            await sqsClient.send(deleteCommand);
                        } catch (delErr) {
                            console.error(`[sqs-poller] Failed to delete SQS message ${msg.MessageId}:`, delErr.message);
                        }
                    }
                }
            } catch (loopErr) {
                if (!isRunning) break;
                console.error('[sqs-poller] Polling cycle error:', loopErr.message);
                await new Promise((r) => setTimeout(r, 5000));
            }
        }
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        pollLoop().catch((err) => console.error('[sqs-poller] Fatal poller error:', err));
    }

    function stop() {
        if (!isRunning) return;
        isRunning = false;
        console.log('[sqs-poller] Stopped SQS poller service');
    }

    return {
        start,
        stop,
        handleEvent,
    };
}

module.exports = {
    createSqsPoller,
};
