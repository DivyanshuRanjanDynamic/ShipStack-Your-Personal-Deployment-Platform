const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseUserEnvJson, buildChildEnv } = require('../lib/env');

describe('parseUserEnvJson', () => {
    it('accepts a flat object of string values', () => {
        const r = parseUserEnvJson('{"API_URL":"https://x","FEATURE":"1"}');
        assert.deepStrictEqual(r.accepted, { API_URL: 'https://x', FEATURE: '1' });
        assert.deepStrictEqual(r.rejected, []);
        assert.strictEqual(r.error, null);
    });

    it('treats empty / missing input as no user env', () => {
        for (const raw of [undefined, null, '', '   ']) {
            assert.deepStrictEqual(parseUserEnvJson(raw), { accepted: {}, rejected: [], error: null });
        }
    });

    it('rejects invalid JSON, non-objects and arrays', () => {
        assert.match(parseUserEnvJson('{bad').error, /not valid JSON/);
        assert.match(parseUserEnvJson('"a string"').error, /must be a JSON object/);
        assert.match(parseUserEnvJson('[1,2]').error, /must be a JSON object/);
        assert.match(parseUserEnvJson('null').error, /must be a JSON object/);
    });

    it('rejects invalid names and non-string values by key, keeping the rest', () => {
        const r = parseUserEnvJson('{"GOOD":"ok","1BAD":"x","has space":"y","NUM":5,"OBJ":{}}');
        assert.deepStrictEqual(r.accepted, { GOOD: 'ok' });
        const reasons = Object.fromEntries(r.rejected.map((x) => [x.key, x.reason]));
        assert.strictEqual(reasons['1BAD'], 'invalid name');
        assert.strictEqual(reasons['has space'], 'invalid name');
        assert.strictEqual(reasons['NUM'], 'value is not a string');
        assert.strictEqual(reasons['OBJ'], 'value is not a string');
    });

    it('enforces the size limit', () => {
        const big = JSON.stringify({ BIG: 'x'.repeat(7000) });
        assert.match(parseUserEnvJson(big).error, /exceeds \d+ bytes/);
    });

    it('enforces the variable count limit', () => {
        const many = {};
        for (let i = 0; i < 101; i++) many[`V${i}`] = 'x';
        assert.match(parseUserEnvJson(JSON.stringify(many), { maxVars: 100 }).error, /more than 100 variables/);
    });
});

describe('buildChildEnv', () => {
    const baseEnv = {
        PATH: '/opt/node/22/bin:/usr/bin',
        HOME: '/home/appuser',
        LANG: 'C.UTF-8',
        TMPDIR: '/tmp',
        COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
        ECS_SECRET_ACCESSKEY: 'AKIA-super-secret',
        ECS_ACCESSKEY_ID: 'AKIA-id',
        KAFKA_PASSWORD: 'kafka-super-secret',
        KAFKA_USERNAME: 'avnadmin',
    };

    it('copies only the allowlist and COREPACK_*, never platform secrets', () => {
        const { env } = buildChildEnv({ baseEnv, nodeBinDir: '/opt/node/18/bin' });
        assert.strictEqual(env.HOME, '/home/appuser');
        assert.strictEqual(env.LANG, 'C.UTF-8');
        assert.strictEqual(env.TMPDIR, '/tmp');
        assert.strictEqual(env.COREPACK_ENABLE_DOWNLOAD_PROMPT, '0');
        assert.strictEqual(env.ECS_SECRET_ACCESSKEY, undefined);
        assert.strictEqual(env.ECS_ACCESSKEY_ID, undefined);
        assert.strictEqual(env.KAFKA_PASSWORD, undefined);
        assert.strictEqual(env.KAFKA_USERNAME, undefined);
        // No value in the whole env equals a platform secret.
        assert.ok(!Object.values(env).some((v) => v.includes('super-secret')));
    });

    it('prepends the selected Node bin dir to PATH', () => {
        const { env } = buildChildEnv({ baseEnv, nodeBinDir: '/opt/node/18/bin' });
        assert.ok(env.PATH.startsWith('/opt/node/18/bin'));
        assert.ok(env.PATH.endsWith('/opt/node/22/bin:/usr/bin'));
    });

    it('applies user env vars and reports them (names only)', () => {
        const { env, appliedKeys } = buildChildEnv({ baseEnv, nodeBinDir: '/opt/node/22/bin', userEnv: { API_URL: 'https://api', VITE_X: '1' } });
        assert.strictEqual(env.API_URL, 'https://api');
        assert.strictEqual(env.VITE_X, '1');
        assert.deepStrictEqual(appliedKeys, ['API_URL', 'VITE_X']);
    });

    it('rejects user vars that would clobber reserved keys', () => {
        const { env, rejectedReservedKeys } = buildChildEnv({
            baseEnv,
            nodeBinDir: '/opt/node/22/bin',
            userEnv: { PATH: '/evil', HOME: '/evil', TMPDIR: '/evil', COREPACK_HOME: '/evil', OK: 'keep' },
        });
        assert.deepStrictEqual(rejectedReservedKeys, ['COREPACK_HOME', 'HOME', 'PATH', 'TMPDIR']);
        assert.strictEqual(env.OK, 'keep');
        assert.strictEqual(env.HOME, '/home/appuser'); // unchanged
        assert.ok(env.PATH.startsWith('/opt/node/22/bin'));
    });

    it('keeps a user NODE_OPTIONS and appends the legacy flag without overwriting it', () => {
        const { env, appliedKeys } = buildChildEnv({
            baseEnv,
            nodeBinDir: '/opt/node/22/bin',
            legacyOpenSSL: true,
            userEnv: { NODE_OPTIONS: '--max-old-space-size=4096' },
        });
        assert.strictEqual(env.NODE_OPTIONS, '--max-old-space-size=4096 --openssl-legacy-provider');
        assert.ok(appliedKeys.includes('NODE_OPTIONS'));
    });

    it('sets the legacy flag alone when the user set no NODE_OPTIONS', () => {
        assert.strictEqual(buildChildEnv({ baseEnv, nodeBinDir: '/opt/node/22/bin', legacyOpenSSL: true }).env.NODE_OPTIONS, '--openssl-legacy-provider');
    });

    it('sets no NODE_OPTIONS when not needed', () => {
        assert.strictEqual('NODE_OPTIONS' in buildChildEnv({ baseEnv, nodeBinDir: '/opt/node/22/bin' }).env, false);
    });
});
