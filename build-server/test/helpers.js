const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

const FIXTURES = path.join(__dirname, 'fixtures');

// Writes { 'a/b.txt': 'content', 'empty-dir/': null } under a fresh temp folder; returns its path.
function makeTree(files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-server-test-'));
    for (const [rel, content] of Object.entries(files)) {
        const target = path.join(root, rel);
        if (rel.endsWith('/')) {
            fs.mkdirSync(target, { recursive: true });
            continue;
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    }
    return root;
}

// Log sink that records every event.
function recordingLogSink() {
    const events = [];
    return {
        events,
        logs: () => events.map((e) => e.log),
        publish: async (event) => { events.push(event); },
        close: async () => { },
    };
}

// Minimal ChildProcess stand-in: emit('out', text), emit('err', text), finish(code).
function fakeProcess() {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.out = (text) => proc.stdout.emit('data', Buffer.from(text));
    proc.err = (text) => proc.stderr.emit('data', Buffer.from(text));
    proc.finish = (code) => proc.emit('close', code);
    return proc;
}

module.exports = { FIXTURES, makeTree, recordingLogSink, fakeProcess };
