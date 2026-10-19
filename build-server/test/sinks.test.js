const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { makeTree } = require('./helpers');
const {
    createKafkaLogSink,
    createStdoutLogSink,
    createS3ObjectSink,
    createLocalObjectSink,
} = require('../lib/sinks');

function fakeProducer({ failSend = false } = {}) {
    const sent = [];
    return {
        sent,
        disconnected: false,
        async send(record) {
            if (failSend) throw new Error('broker down');
            sent.push(record);
        },
        async disconnect() { this.disconnected = true; },
    };
}

describe('Kafka log sink', () => {
    it('sends the payload shape the consumer reads, now with seq', async () => {
        const producer = fakeProducer();
        const sink = createKafkaLogSink({ producer, projectId: 'p1', deploymentId: 'd1' });

        await sink.publish({ log: 'hello' });
        await sink.publish({ log: '[build:end] exit_code=2', step: 'build', event: 'step_end', exit_code: 2, failure_reason: 'NONZERO_EXIT' });

        assert.strictEqual(producer.sent.length, 2);
        assert.strictEqual(producer.sent[0].topic, 'container-logs');
        assert.strictEqual(producer.sent[0].messages[0].key, 'log');
        assert.deepStrictEqual(JSON.parse(producer.sent[0].messages[0].value), { log: 'hello', PROJECT_ID: 'p1', DEPLOYMENT_ID: 'd1', seq: 0 });
        assert.deepStrictEqual(JSON.parse(producer.sent[1].messages[0].value), {
            log: '[build:end] exit_code=2',
            PROJECT_ID: 'p1',
            DEPLOYMENT_ID: 'd1',
            seq: 1,
            step: 'build',
            event: 'step_end',
            exit_code: 2,
            failure_reason: 'NONZERO_EXIT',
        });
    });

    it('keeps exit_code 0', async () => {
        const producer = fakeProducer();
        const sink = createKafkaLogSink({ producer, projectId: 'p1', deploymentId: 'd1' });
        await sink.publish({ log: '[upload:end] exit_code=0', step: 'upload', event: 'step_end', exit_code: 0 });
        assert.strictEqual(JSON.parse(producer.sent[0].messages[0].value).exit_code, 0);
    });

    it('publishLines sends one Kafka message per line in a single send, with increasing seq', async () => {
        const producer = fakeProducer();
        const sink = createKafkaLogSink({ producer, projectId: 'p1', deploymentId: 'd1' });

        await sink.publish({ log: 'first' });
        await sink.publishLines([
            { log: '[build] a', step: 'build' },
            { log: '[build] b', step: 'build' },
            { log: '[build] c', step: 'build' },
        ]);

        assert.strictEqual(producer.sent.length, 2); // one send for publish, one for the batch
        assert.strictEqual(producer.sent[1].messages.length, 3);
        const seqs = producer.sent[1].messages.map((m) => JSON.parse(m.value).seq);
        assert.deepStrictEqual(seqs, [1, 2, 3]); // continues after the seq 0 from publish()
        assert.deepStrictEqual(producer.sent[1].messages.map((m) => JSON.parse(m.value).log), ['[build] a', '[build] b', '[build] c']);
    });

    it('publishLines on an empty array sends nothing', async () => {
        const producer = fakeProducer();
        const sink = createKafkaLogSink({ producer, projectId: 'p1', deploymentId: 'd1' });
        await sink.publishLines([]);
        assert.strictEqual(producer.sent.length, 0);
    });

    it('does not throw when the broker fails', async () => {
        const sink = createKafkaLogSink({ producer: fakeProducer({ failSend: true }), projectId: 'p1', deploymentId: 'd1' });
        await assert.doesNotReject(sink.publish({ log: 'x' }));
    });

    it('disconnects on close', async () => {
        const producer = fakeProducer();
        await createKafkaLogSink({ producer, projectId: 'p1', deploymentId: 'd1' }).close();
        assert.strictEqual(producer.disconnected, true);
    });
});

describe('stdout log sink', () => {
    it('writes one line per event and shows the failure reason', async () => {
        const out = [];
        const sink = createStdoutLogSink({ write: (t) => out.push(t) });
        await sink.publish({ log: '[install] added 1 package\n' });
        await sink.publish({ log: '[upload:end] exit_code=1', step: 'upload', event: 'step_end', exit_code: 1, failure_reason: 'UPLOAD_EMPTY' });
        assert.deepStrictEqual(out, ['[install] added 1 package\n', '[upload:end] exit_code=1 [failure_reason=UPLOAD_EMPTY]\n']);
    });
});

describe('S3 object sink', () => {
    it('sends a PutObjectCommand with bucket, key, body and content type', async () => {
        const sent = [];
        class FakePut { constructor(input) { this.input = input; } }
        const sink = createS3ObjectSink({ client: { send: async (c) => sent.push(c) }, bucket: 'b', PutObjectCommand: FakePut });
        await sink.put('__outputs/p1/index.html', 'x', 'text/html');
        assert.deepStrictEqual(sent[0].input, { Bucket: 'b', Key: '__outputs/p1/index.html', Body: 'x', ContentType: 'text/html' });
    });

    it('propagates send errors', async () => {
        class FakePut { constructor(input) { this.input = input; } }
        const sink = createS3ObjectSink({ client: { send: async () => { throw new Error('denied'); } }, bucket: 'b', PutObjectCommand: FakePut });
        await assert.rejects(sink.put('k', 'x', 'text/plain'), /denied/);
    });
});

describe('local object sink', () => {
    it('writes strings and streams under the root, creating folders', async () => {
        const root = makeTree({});
        const sink = createLocalObjectSink({ rootDir: root });
        await sink.put('__meta/d1/build-context.json', '{"a":1}', 'application/json');
        await sink.put('__outputs/p1/assets/app.js', Readable.from(['console.log(1)']), 'text/javascript');
        assert.strictEqual(fs.readFileSync(path.join(root, '__meta/d1/build-context.json'), 'utf8'), '{"a":1}');
        assert.strictEqual(fs.readFileSync(path.join(root, '__outputs/p1/assets/app.js'), 'utf8'), 'console.log(1)');
    });

    it('rejects keys that escape the root', async () => {
        const sink = createLocalObjectSink({ rootDir: makeTree({}) });
        await assert.rejects(sink.put('../escape.txt', 'x'), /escapes/);
    });
});
