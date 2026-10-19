const express = require('express')
const httpProxy = require('http-proxy')
const path = require('path')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const { candidateKeys, isMissing } = require('./lib/resolve')

const PORT = 8000

const BASE_PATH = 'https://shipstack-s3.s3.eu-north-1.amazonaws.com/__outputs'

// Headers that belong to one hop and must not be copied from S3's response to ours.
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'proxy-connection', 'upgrade'])
// A forced-status fallback (404.html) must come back whole, never as 304 or 206.
const CONDITIONAL = ['if-none-match', 'if-modified-since', 'if-match', 'if-unmodified-since', 'if-range', 'range']

// ─── gRPC Client ───
function createGrpcLookup() {
    const packageDefinition = protoLoader.loadSync(
        path.join(__dirname, '../proto/project.proto'),
        { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
    )
    const projectProto = grpc.loadPackageDefinition(packageDefinition).project

    const grpcClient = new projectProto.ProjectService(
        process.env.API_GRPC_URL || 'localhost:50051',
        grpc.credentials.createInsecure()
    )

    return (subdomain, callback) => grpcClient.GetProjectBySubdomain({ subdomain }, callback)
}

/**
 * lookupProject(subdomain, callback(err, { id })) resolves the project; basePath is the S3
 * prefix holding every project's output folder. Each request walks candidateKeys() in order
 * and serves the first key S3 has.
 */
function createApp({ lookupProject, basePath = BASE_PATH }) {
    const app = express()
    const proxy = httpProxy.createProxy()

    function tryCandidate(req, res, index) {
        const { target, candidates } = req.s3
        if (index >= candidates.length) return res.status(404).send('Not Found')

        req.s3.index = index
        req.url = `/${candidates[index].key}`
        proxy.web(req, res, { target, changeOrigin: true, selfHandleResponse: true }, (err) => {
            console.error(`Proxy error for ${target}${req.url}:`, err.message)
            if (!res.headersSent) res.status(502).send('Bad Gateway')
        })
    }

    proxy.on('proxyReq', (proxyReq, req) => {
        const { candidates, index } = req.s3
        if (candidates[index].status !== null)
            for (const header of CONDITIONAL) proxyReq.removeHeader(header)
    })

    proxy.on('proxyRes', (proxyRes, req, res) => {
        const { candidates, index } = req.s3
        if (isMissing(proxyRes.statusCode)) {
            proxyRes.resume()
            return tryCandidate(req, res, index + 1)
        }

        const forced = candidates[index].status
        const status = forced !== null && proxyRes.statusCode === 200 ? forced : proxyRes.statusCode
        for (const [name, value] of Object.entries(proxyRes.headers))
            if (!HOP_BY_HOP.has(name)) res.setHeader(name, value)
        res.writeHead(status)
        proxyRes.pipe(res)
    })

    app.use((req, res) => {
        const hostname = req.hostname;
        const subdomain = hostname.split('.')[0];

        lookupProject(subdomain, (err, response) => {
            if (err) {
                console.error(`gRPC error for subdomain "${subdomain}":`, err.details || err.message)
                if (err.code === grpc.status.NOT_FOUND) {
                    return res.status(404).send('Project Not Found')
                }
                return res.status(502).send('Service Unavailable')
            }

            // The query string is never forwarded: S3 gives some parameters meaning (?acl, ?versionId).
            const candidates = candidateKeys(req.url.split('?')[0])
            if (!candidates) return res.status(400).send('Bad Request')

            req.s3 = { target: `${basePath}/${response.id}`, candidates, index: 0 }
            tryCandidate(req, res, 0)
        })
    })

    return app
}

if (require.main === module) {
    createApp({ lookupProject: createGrpcLookup() })
        .listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`))
}

module.exports = { createApp }
