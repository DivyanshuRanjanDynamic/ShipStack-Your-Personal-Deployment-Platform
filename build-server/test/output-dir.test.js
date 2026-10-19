const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { makeTree } = require('./helpers');
const { findOutputDir } = require('../lib/output-dir');

describe('findOutputDir', () => {
    it('prefers dist', () => {
        const dir = makeTree({ 'dist/index.html': '', 'build/index.html': '' });
        assert.strictEqual(findOutputDir(dir), path.join(dir, 'dist'));
    });

    it('falls back to build', () => {
        const dir = makeTree({ 'build/index.html': '' });
        assert.strictEqual(findOutputDir(dir), path.join(dir, 'build'));
    });

    it('returns null when neither exists', () => {
        const dir = makeTree({ 'out/index.html': '' });
        assert.strictEqual(findOutputDir(dir), null);
    });
});
