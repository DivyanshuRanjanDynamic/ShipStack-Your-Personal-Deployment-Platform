const express = require('express')
const httpProxy = require('http-proxy')
const path = require('path')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

const app = express()
const PORT = 8000

const BASE_PATH = 'https://shipstack-s3.s3.eu-north-1.amazonaws.com/__outputs'

const proxy = httpProxy.createProxy()

// ─── gRPC Client ───
const packageDefinition = protoLoader.loadSync(
    path.join(__dirname, '../proto/project.proto'),
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
)
const projectProto = grpc.loadPackageDefinition(packageDefinition).project

const grpcClient = new projectProto.ProjectService(
    process.env.API_GRPC_URL || 'localhost:50051',
    grpc.credentials.createInsecure()
)

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    grpcClient.GetProjectBySubdomain({ subdomain }, (err, response) => {
        if (err) {
            console.error(`gRPC error for subdomain "${subdomain}":`, err.details || err.message)
            if (err.code === grpc.status.NOT_FOUND) {
                return res.status(404).send('Project Not Found')
            }
            return res.status(502).send('Service Unavailable')
        }

        const resolvesTo = `${BASE_PATH}/${response.id}`
        return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })
    })
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'
})

app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`))