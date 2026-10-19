const { describe, it } = require('node:test');
const assert = require('node:assert');
const { makeTree } = require('./helpers');
const {
    readInstalledVersions,
    parseRequestedMajor,
    selectNodeVersion,
    selectNodeForProject,
    needsLegacyOpenSSL,
    appendNodeOption,
    describeNodeSelection,
} = require('../lib/node-version');

const INSTALLED = [
    { major: 16, version: '16.20.2', binDir: '/opt/node/16/bin' },
    { major: 18, version: '18.20.5', binDir: '/opt/node/18/bin' },
    { major: 20, version: '20.18.1', binDir: '/opt/node/20/bin' },
    { major: 22, version: '22.12.0', binDir: '/opt/node/22/bin' },
];
const select = (opts) => selectNodeVersion({ installed: INSTALLED, defaultMajor: 22, ...opts });

describe('parseRequestedMajor', () => {
    it('reads a major from plain, v-prefixed and full versions', () => {
        assert.strictEqual(parseRequestedMajor('18'), 18);
        assert.strictEqual(parseRequestedMajor('v16'), 16);
        assert.strictEqual(parseRequestedMajor('20.18.1'), 20);
        assert.strictEqual(parseRequestedMajor('  18  '), 18);
    });

    it('returns null for aliases it cannot resolve', () => {
        assert.strictEqual(parseRequestedMajor('lts/hydrogen'), null);
        assert.strictEqual(parseRequestedMajor('latest'), null);
    });
});

describe('selectNodeVersion', () => {
    it('defaults to the image default when there is no signal', () => {
        assert.deepStrictEqual(select({}), { major: 22, version: '22.12.0', binDir: '/opt/node/22/bin', source: 'default', warning: null });
    });

    it('uses the NODE_VERSION setting', () => {
        const r = select({ setting: '18' });
        assert.strictEqual(r.major, 18);
        assert.strictEqual(r.source, 'NODE_VERSION setting "18"');
        assert.strictEqual(r.binDir, '/opt/node/18/bin');
    });

    it('uses .nvmrc, matching major from a full version', () => {
        assert.strictEqual(select({ nvmrc: '20.11.0\n' }).major, 20);
        assert.strictEqual(select({ nvmrc: 'v16' }).source, '.nvmrc / .node-version');
    });

    it('falls back to the default with a warning for an unparseable .nvmrc', () => {
        const r = select({ nvmrc: 'lts/hydrogen' });
        assert.strictEqual(r.major, 22);
        assert.strictEqual(r.source, 'default');
        assert.match(r.warning, /could not parse/);
    });

    it('picks the highest installed major that satisfies engines.node', () => {
        assert.strictEqual(select({ engines: '>=18' }).major, 22);
        assert.strictEqual(select({ engines: '18.x' }).major, 18);
        assert.strictEqual(select({ engines: '^16.0.0' }).major, 16);
        assert.strictEqual(select({ engines: '>=16 <19' }).major, 18);
    });

    it('uses the oldest installed Node when engines is entirely below it', () => {
        const r = select({ engines: '14.x' });
        assert.strictEqual(r.major, 16);
        assert.strictEqual(r.source, 'engines.node "14.x"');
        assert.match(r.warning, /older than any installed/);
    });

    it('uses the default when engines is above the newest installed', () => {
        const r = select({ engines: '>=24' });
        assert.strictEqual(r.major, 22);
        assert.strictEqual(r.source, 'default');
        assert.match(r.warning, /matches no installed/);
    });

    it('uses the default with a warning for an invalid engines range', () => {
        const r = select({ engines: 'not-a-range' });
        assert.strictEqual(r.major, 22);
        assert.match(r.warning, /not a valid version range/);
    });

    it('prefers setting over .nvmrc over engines', () => {
        assert.strictEqual(select({ setting: '20', nvmrc: '18', engines: '16.x' }).major, 20);
        assert.strictEqual(select({ nvmrc: '18', engines: '16.x' }).major, 18);
    });

    it('resolves a requested major that is not installed', () => {
        assert.strictEqual(select({ setting: '17' }).major, 16); // odd major → highest installed below
        assert.strictEqual(select({ setting: '14' }).major, 16); // below oldest → oldest
        assert.match(select({ setting: '14' }).warning, /oldest installed/);
    });
});

describe('selectNodeForProject', () => {
    it('reads .nvmrc from the project folder', () => {
        const dir = makeTree({ 'package.json': '{}', '.nvmrc': '18\n' });
        assert.strictEqual(selectNodeForProject({ projectDir: dir, pkg: {}, installed: INSTALLED, defaultMajor: 22 }).major, 18);
    });

    it('reads .node-version when there is no .nvmrc', () => {
        const dir = makeTree({ 'package.json': '{}', '.node-version': 'v20' });
        assert.strictEqual(selectNodeForProject({ projectDir: dir, pkg: {}, installed: INSTALLED, defaultMajor: 22 }).major, 20);
    });

    it('uses engines.node when there is no version file', () => {
        const dir = makeTree({ 'package.json': '{}' });
        assert.strictEqual(selectNodeForProject({ projectDir: dir, pkg: { engines: { node: '18.x' } }, installed: INSTALLED, defaultMajor: 22 }).major, 18);
    });

    it('a version file beats engines.node', () => {
        const dir = makeTree({ 'package.json': '{}', '.nvmrc': '20' });
        assert.strictEqual(selectNodeForProject({ projectDir: dir, pkg: { engines: { node: '16.x' } }, installed: INSTALLED, defaultMajor: 22 }).major, 20);
    });
});

describe('needsLegacyOpenSSL', () => {
    it('is true on Node 17+ for react-scripts below 5', () => {
        assert.strictEqual(needsLegacyOpenSSL({ major: 22, pkg: { dependencies: { 'react-scripts': '^4.0.3' } } }), true);
        assert.strictEqual(needsLegacyOpenSSL({ major: 18, pkg: { dependencies: { 'react-scripts': '3.4.1' } } }), true);
    });

    it('is true on Node 17+ for webpack 4', () => {
        assert.strictEqual(needsLegacyOpenSSL({ major: 22, pkg: { devDependencies: { webpack: '^4.46.0' } } }), true);
    });

    it('is false for react-scripts 5 and webpack 5', () => {
        assert.strictEqual(needsLegacyOpenSSL({ major: 22, pkg: { dependencies: { 'react-scripts': '5.0.1' } } }), false);
        assert.strictEqual(needsLegacyOpenSSL({ major: 22, pkg: { devDependencies: { webpack: '^5.90.0' } } }), false);
    });

    it('is false below Node 17 even with old webpack', () => {
        assert.strictEqual(needsLegacyOpenSSL({ major: 16, pkg: { dependencies: { 'react-scripts': '4.0.3' } } }), false);
    });

    it('is false when nothing relevant is present', () => {
        assert.strictEqual(needsLegacyOpenSSL({ major: 22, pkg: { dependencies: { vite: '5' } } }), false);
        assert.strictEqual(needsLegacyOpenSSL({ major: 22, pkg: {} }), false);
    });
});

describe('appendNodeOption', () => {
    it('sets the flag when NODE_OPTIONS is empty', () => {
        assert.strictEqual(appendNodeOption(undefined, '--openssl-legacy-provider'), '--openssl-legacy-provider');
        assert.strictEqual(appendNodeOption('', '--openssl-legacy-provider'), '--openssl-legacy-provider');
    });

    it('appends without overwriting an existing NODE_OPTIONS', () => {
        assert.strictEqual(appendNodeOption('--max-old-space-size=4096', '--openssl-legacy-provider'), '--max-old-space-size=4096 --openssl-legacy-provider');
    });

    it('does not add the flag twice', () => {
        assert.strictEqual(appendNodeOption('--openssl-legacy-provider', '--openssl-legacy-provider'), '--openssl-legacy-provider');
    });
});

describe('describeNodeSelection', () => {
    it('logs the version and source, the warning, and the legacy OpenSSL decision', () => {
        const selection = { major: 18, version: '18.20.5', binDir: '/opt/node/18/bin', source: 'engines.node ">=18"', warning: null };
        assert.deepStrictEqual(describeNodeSelection(selection, false), ['[setup] node 18.20.5 selected (source: engines.node ">=18")']);

        const withBoth = { major: 22, version: '22.12.0', binDir: '/opt/node/22/bin', source: 'default', warning: 'engines.node ">=24" matches no installed Node; using the default Node 22' };
        assert.deepStrictEqual(describeNodeSelection(withBoth, true), [
            '[setup] node 22.12.0 selected (source: default)',
            '[setup] engines.node ">=24" matches no installed Node; using the default Node 22',
            '[setup] appending --openssl-legacy-provider to NODE_OPTIONS (webpack 4 / react-scripts < 5 needs it on Node 22)',
        ]);
    });
});

describe('readInstalledVersions', () => {
    it('falls back to the running Node when the image manifest is absent', () => {
        const list = readInstalledVersions();
        assert.ok(Array.isArray(list) && list.length >= 1);
        assert.ok(Number.isInteger(list[0].major));
        assert.ok(typeof list[0].binDir === 'string');
    });
});
