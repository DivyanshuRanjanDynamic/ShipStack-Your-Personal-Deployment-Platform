const { describe, it } = require('node:test');
const assert = require('node:assert');
const { statusTransitionFor } = require('../src/deployment-status');

describe('statusTransitionFor', () => {
    it('marks IN_PROGRESS and SUCCESS from platform lines (no step)', () => {
        assert.strictEqual(statusTransitionFor({ log: 'Starting the build process......' }), 'IN_PROGRESS');
        assert.strictEqual(statusTransitionFor({ log: 'Uploading to S3 Done!!!!!!' }), 'SUCCESS');
    });

    it('ignores status text that comes from a build step (anti-spoofing)', () => {
        assert.strictEqual(statusTransitionFor({ log: 'Uploading to S3 Done!!!!!!', step: 'build' }), null);
        assert.strictEqual(statusTransitionFor({ log: 'Starting the build process......', step: 'install' }), null);
        assert.strictEqual(statusTransitionFor({ log: 'Build process failed!', step: 'build' }), null);
    });

    it('marks FAILURE from the platform failure line', () => {
        assert.strictEqual(statusTransitionFor({ log: 'Build process failed! Cannot proceed to upload.' }), 'FAILURE');
        assert.strictEqual(statusTransitionFor({ log: "Error: Neither 'dist' nor 'build' directory exists" }), 'FAILURE');
    });

    it('marks FAILURE from an authoritative failed step_end regardless of step', () => {
        assert.strictEqual(statusTransitionFor({ log: '[build:end] exit_code=1', step: 'build', event: 'step_end', exit_code: 1 }), 'FAILURE');
        assert.strictEqual(statusTransitionFor({ log: '[install:end] exit_code=2', step: 'install', event: 'step_end', exit_code: 2, failure_reason: 'NONZERO_EXIT' }), 'FAILURE');
    });

    it('does not transition on a successful step_end', () => {
        assert.strictEqual(statusTransitionFor({ log: '[build:end] exit_code=0', step: 'build', event: 'step_end', exit_code: 0 }), null);
    });

    it('returns null for ordinary output lines', () => {
        assert.strictEqual(statusTransitionFor({ log: 'added 120 packages', step: 'install' }), null);
        assert.strictEqual(statusTransitionFor({ log: 'vite building for production...', step: 'build' }), null);
        assert.strictEqual(statusTransitionFor({ log: 'some unrelated platform note' }), null);
    });
});
