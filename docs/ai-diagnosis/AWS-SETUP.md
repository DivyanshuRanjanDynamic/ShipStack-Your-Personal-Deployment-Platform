# AWS Setup Reference — AI Deployment Diagnosis (Phase 1)

> Region: `eu-north-1` (Stockholm)  
> Purpose: SQS queues, EventBridge task-state forwarding rule, and IAM policy permissions for ShipStack ECS events.  
> **Security Notice**: Contains resource names and configurations only. No credentials, access keys, or secrets.

---

## 1. Amazon SQS Queues

### Main Queue: `shipstack-ecs-events`
- **Queue Type**: Standard
- **Default Visibility Timeout**: 60 seconds (must exceed poller batch processing duration)
- **Message Retention Period**: 4 days
- **Receive Message Wait Time**: 20 seconds (long polling)
- **Dead-letter Queue (DLQ) Settings**:
  - **Dead-letter Queue**: `shipstack-ecs-events-dlq`
  - **Maximum Receives**: 5

### Dead-letter Queue: `shipstack-ecs-events-dlq`
- **Queue Type**: Standard
- **Message Retention Period**: 14 days

---

## 2. Amazon EventBridge Rule

### Rule Name: `shipstack-ecs-task-state`
- **Event Bus**: `default`
- **Rule Type**: Rule with an event pattern
- **Event Source**: AWS services
- **Sample Event Pattern**:
```json
{
  "source": ["aws.ecs"],
  "detail-type": ["ECS Task State Change"],
  "detail": {
    "clusterArn": ["arn:aws:ecs:eu-north-1:*:cluster/builder-cluster"],
    "lastStatus": ["RUNNING", "STOPPED"]
  }
}
```
- **Targets**:
  - Target 1: SQS queue `shipstack-ecs-events`

---

## 3. IAM Policy (API Server)

### Policy Name: `shipstack-phase1`
Attach to the IAM user or role used by `api-server` (`ECS_ACCESSKEY_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SqsEcsEventsAccess",
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:eu-north-1:*:shipstack-ecs-events"
    },
    {
      "Sid": "EcsTaskControlAccess",
      "Effect": "Allow",
      "Action": [
        "ecs:StopTask",
        "ecs:DescribeTasks",
        "ecs:TagResource"
      ],
      "Resource": "arn:aws:ecs:eu-north-1:*:task/builder-cluster/*"
    }
  ]
}
```

---

## 4. Environment Variables Required

Add these to `api-server/.env` (already created in the environment):
```bash
AWS_REGION="eu-north-1"
SQS_QUEUE_URL="https://sqs.eu-north-1.amazonaws.com/<ACCOUNT_ID>/shipstack-ecs-events"
BUILD_DEADLINE_MINUTES=15
PROVISIONING_DEADLINE_MINUTES=10
```
