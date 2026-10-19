const { describe, it } = require('node:test');
const assert = require('node:assert');
const { candidateKeys, isMissing, hasExtension } = require('../lib/resolve');

const keys = (urlPath) => candidateKeys(urlPath).map(({ key, status }) => (status === null ? key : `${key} (${status})`));

describe('candidateKeys', () => {
    it('serves index.html for the root, then 404.html', () => {
        assert.deepStrictEqual(keys('/'), ['index.html', '404.html (404)']);
    });

    it('serves an asset with an extension as-is and never falls back to index.html', () => {
        assert.deepStrictEqual(keys('/_next/static/chunks/main-abc123.js'), [
            '_next/static/chunks/main-abc123.js',
            '404.html (404)',
        ]);
        assert.deepStrictEqual(keys('/about.html'), ['about.html', '404.html (404)']);
        assert.deepStrictEqual(keys('/404.html'), ['404.html']);
    });

    it('appends index.html to a directory path', () => {
        assert.deepStrictEqual(keys('/guides/'), ['guides/index.html', '404.html (404)', 'index.html (200)']);
    });

    it('tries <path>.html, then <path>/index.html, then the bare key for an extensionless path', () => {
        assert.deepStrictEqual(keys('/about'), [
            'about.html',
            'about/index.html',
            'about',
            '404.html (404)',
            'index.html (200)',
        ]);
        assert.deepStrictEqual(keys('/guides/getting-started').slice(0, 2), [
            'guides/getting-started.html',
            'guides/getting-started/index.html',
        ]);
    });

    it('ends a deep single-page-app route with the index.html fallback at 200', () => {
        const list = candidateKeys('/dashboard/settings');
        assert.deepStrictEqual(list.at(-1), { key: 'index.html', status: 200 });
        assert.deepStrictEqual(list.at(-2), { key: '404.html', status: 404 });
    });

    it('treats a dot in a directory name as part of the path, not an extension', () => {
        assert.deepStrictEqual(keys('/v1.2/intro')[0], 'v1.2/intro.html');
        assert.deepStrictEqual(keys('/v1.2/')[0], 'v1.2/index.html');
    });

    it('collapses repeated slashes and keeps percent-encoding as received', () => {
        assert.deepStrictEqual(keys('//blog//my%20post')[0], 'blog/my%20post.html');
    });

    it('rejects paths that could leave the project prefix', () => {
        for (const bad of ['/../other/index.html', '/a/%2e%2e/b', '/a/./b', '/a%5cb', '/a%00b', '/%E0%A4%A', 'http://x/y']) {
            assert.strictEqual(candidateKeys(bad), null, bad);
        }
    });
});

describe('isMissing', () => {
    it('treats both 403 (private bucket) and 404 (public bucket) as a missing key', () => {
        assert.ok(isMissing(403));
        assert.ok(isMissing(404));
        assert.ok(!isMissing(200));
        assert.ok(!isMissing(304));
        assert.ok(!isMissing(500));
    });
});

describe('hasExtension', () => {
    it('looks only at the last segment', () => {
        assert.ok(hasExtension('a/b.css'));
        assert.ok(!hasExtension('a.b/c'));
        assert.ok(!hasExtension('a/b.'));
    });
});
