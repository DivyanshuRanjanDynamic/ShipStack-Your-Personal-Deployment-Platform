const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildUserEnvJson, MAX_USER_ENV_BYTES } = require('../src/task-env');

describe('buildUserEnvJson', () => {
    it('serializes the stored [{key,value}] array into a JSON object of strings', () => {
        const r = buildUserEnvJson([{ key: 'API_URL', value: 'https://x' }, { key: 'FLAG', value: 1 }]);
        assert.deepStrictEqual(JSON.parse(r.json), { API_URL: 'https://x', FLAG: '1' });
        assert.strictEqual(r.count, 2);
        assert.strictEqual(r.tooLarge, false);
    });

    it('skips entries without a key and coerces null/undefined values to empty strings', () => {
        const r = buildUserEnvJson([{ key: 'A', value: null }, { value: 'orphan' }, { key: '', value: 'x' }]);
        assert.deepStrictEqual(JSON.parse(r.json), { A: '' });
    });

    it('accepts a plain object as well', () => {
        assert.deepStrictEqual(JSON.parse(buildUserEnvJson({ A: 'b', C: 2 }).json), { A: 'b', C: '2' });
    });

    it('produces {} for null/empty input', () => {
        assert.strictEqual(buildUserEnvJson(null).json, '{}');
        assert.strictEqual(buildUserEnvJson(undefined).json, '{}');
        assert.strictEqual(buildUserEnvJson([]).json, '{}');
    });

    it('flags input over the size limit', () => {
        const big = [{ key: 'BIG', value: 'x'.repeat(MAX_USER_ENV_BYTES + 100) }];
        const r = buildUserEnvJson(big);
        assert.strictEqual(r.tooLarge, true);
        assert.ok(r.bytes > MAX_USER_ENV_BYTES);
    });
});
