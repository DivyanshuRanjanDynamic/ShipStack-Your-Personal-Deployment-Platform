const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { createApp } = require('../index');

// A stand-in for the bucket: serves /__outputs/<projectId>/<key> from `sites`, answering a
// missing key the way S3 does (403 on a private bucket, 404 on a public one).
function fakeS3(sites, missingStatus) {
    const requested = [];
    const server = http.createServer((req, res) => {
        requested.push(req.url);
        const match = req.url.match(/^\/__outputs\/([^/]+)\/(.*)$/);
        const body = match && sites[match[1]]?.[match[2]];
        if (body === undefined) {
            res.writeHead(missingStatus, { 'content-type': 'application/xml' });
            return res.end('<Error><Code>AccessDenied</Code></Error>');
        }
        const etag = `"${match[2]}"`;
        if (req.headers['if-none-match'] === etag) {
            res.writeHead(304, { etag });
            return res.end();
        }
        const type = match[2].endsWith('.html') ? 'text/html' : 'application/octet-stream';
        res.writeHead(200, { 'content-type': type, etag });
        res.end(body);
    });
    return { server, requested };
}

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));

function get(port, host, urlPath, headers = {}) {
    return new Promise((resolve, reject) => {
        http.get({ port, path: urlPath, headers: { host, ...headers } }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
        }).on('error', reject);
    });
}

const SITES = {
    // A Next.js `output: 'export'` build.
    next: {
        'index.html': 'next home',
        'about.html': 'next about',
        'guides/index.html': 'next guides',
        '404.html': 'next not found',
        '_next/static/app.js': 'console.log(1)',
    },
    // A Vite single-page app: no 404.html.
    spa: {
        'index.html': 'spa shell',
        'assets/index-abc.js': 'boot()',
    },
};

const LOOKUP = { next: 'next', spa: 'spa' };
const lookupProject = (subdomain, callback) => {
    if (LOOKUP[subdomain]) return callback(null, { id: LOOKUP[subdomain] });
    callback({ code: 5, details: 'not found' }); // grpc.status.NOT_FOUND
};

for (const missingStatus of [403, 404]) {
    describe(`proxy against a bucket that answers missing keys with ${missingStatus}`, () => {
        let s3;
        let proxyServer;
        let port;

        before(async () => {
            s3 = fakeS3(SITES, missingStatus);
            const s3Port = await listen(s3.server);
            proxyServer = http.createServer(createApp({
                lookupProject,
                basePath: `http://127.0.0.1:${s3Port}/__outputs`,
            }));
            port = await listen(proxyServer);
        });

        after(async () => {
            await close(proxyServer);
            await close(s3.server);
        });

        const cases = [
            ['next', '/', 200, 'next home'],
            ['next', '/about', 200, 'next about'],
            ['next', '/about?ref=nav', 200, 'next about'],
            ['next', '/guides/', 200, 'next guides'],
            ['next', '/guides', 200, 'next guides'],
            ['next', '/_next/static/app.js', 200, 'console.log(1)'],
            ['next', '/no-such-page', 404, 'next not found'],
            ['next', '/missing.js', 404, 'next not found'],
            ['spa', '/', 200, 'spa shell'],
            ['spa', '/dashboard/settings', 200, 'spa shell'],
            ['spa', '/assets/index-abc.js', 200, 'boot()'],
            ['spa', '/assets/gone.js', 404, 'Not Found'],
        ];
        for (const [site, urlPath, status, body] of cases) {
            it(`${site}.example.com${urlPath} -> ${status} ${body}`, async () => {
                const res = await get(port, `${site}.example.com`, urlPath);
                assert.strictEqual(res.status, status);
                assert.strictEqual(res.body, body);
            });
        }

        it('asks S3 for <path>.html first and never forwards the query string', async () => {
            s3.requested.length = 0;
            await get(port, 'next.example.com', '/about?acl');
            assert.deepStrictEqual(s3.requested, ['/__outputs/next/about.html']);
        });

        it('walks the candidates in order for a missing page', async () => {
            s3.requested.length = 0;
            await get(port, 'spa.example.com', '/pricing');
            assert.deepStrictEqual(s3.requested, [
                '/__outputs/spa/pricing.html',
                '/__outputs/spa/pricing/index.html',
                '/__outputs/spa/pricing',
                '/__outputs/spa/404.html',
                '/__outputs/spa/index.html',
            ]);
        });

        it('passes a 304 through for a page the browser already has', async () => {
            const res = await get(port, 'next.example.com', '/about', { 'if-none-match': '"about.html"' });
            assert.strictEqual(res.status, 304);
        });

        it('serves 404.html whole even when the browser has it cached', async () => {
            const res = await get(port, 'next.example.com', '/nope', { 'if-none-match': '"404.html"' });
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body, 'next not found');
            assert.strictEqual(res.headers['content-type'], 'text/html');
        });

        it('rejects a path that tries to leave the project prefix', async () => {
            s3.requested.length = 0;
            const res = await get(port, 'next.example.com', '/%2e%2e/spa/index.html');
            assert.strictEqual(res.status, 400);
            assert.deepStrictEqual(s3.requested, []);
        });

        it('keeps the unknown-subdomain response', async () => {
            const res = await get(port, 'ghost.example.com', '/');
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body, 'Project Not Found');
        });
    });
}
