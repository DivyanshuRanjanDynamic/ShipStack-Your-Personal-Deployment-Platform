const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createLineBuffer } = require('../lib/log-lines');

describe('createLineBuffer', () => {
    it('returns complete lines and buffers a partial last line', () => {
        const buf = createLineBuffer();
        assert.deepStrictEqual(buf.push('hello\nwor'), ['hello']);
        assert.deepStrictEqual(buf.push('ld\n'), ['world']);
        assert.strictEqual(buf.flush(), '');
    });

    it('splits a multi-line chunk into separate lines', () => {
        const buf = createLineBuffer();
        assert.deepStrictEqual(buf.push('a\nb\nc\n'), ['a', 'b', 'c']);
    });

    it('trims a trailing CR from CRLF output', () => {
        const buf = createLineBuffer();
        assert.deepStrictEqual(buf.push('line1\r\nline2\r\n'), ['line1', 'line2']);
    });

    it('flushes a final line that has no trailing newline', () => {
        const buf = createLineBuffer();
        assert.deepStrictEqual(buf.push('done without newline'), []);
        assert.strictEqual(buf.flush(), 'done without newline');
    });

    it('reassembles a line split across several chunks', () => {
        const buf = createLineBuffer();
        assert.deepStrictEqual(buf.push('npm '), []);
        assert.deepStrictEqual(buf.push('error '), []);
        assert.deepStrictEqual(buf.push('ERESOLVE\n'), ['npm error ERESOLVE']);
    });

    it('emits an empty line for a blank line', () => {
        const buf = createLineBuffer();
        assert.deepStrictEqual(buf.push('a\n\nb\n'), ['a', '', 'b']);
    });
});
