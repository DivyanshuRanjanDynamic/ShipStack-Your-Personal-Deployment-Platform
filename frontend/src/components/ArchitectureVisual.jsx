import React, { useState } from 'react';
import { 
  Server, 
  Cpu, 
  Database, 
  Sparkles, 
  Globe, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Activity,
  HardDrive
} from 'lucide-react';

export default function ArchitectureVisual() {
  const [activeNode, setActiveNode] = useState('api');

  const nodes = [
    {
      id: 'api',
      title: 'API Server',
      subtitle: 'Node.js & Express (Port 9000)',
      desc: 'Orchestrates ECS Fargate tasks, generates slug subdomains, verifies Prisma models in PostgreSQL, and serves high-performance internal gRPC on port 50051.',
      icon: Server,
      badge: 'Orchestrator',
      color: '#0070f3'
    },
    {
      id: 'ecs',
      title: 'Build Server (ECS)',
      subtitle: 'Docker Containers on Fargate',
      desc: 'Isolates and executes git clones, runs dependency installs, and compiles production assets into S3. Emits build telemetry into Kafka.',
      icon: Cpu,
      badge: 'Sandboxed Runner',
      color: '#00dfd8'
    },
    {
      id: 'kafka',
      title: 'Kafka & ClickHouse',
      subtitle: 'Distributed Event Streaming',
      desc: 'Kafka brokers high-frequency container logs and triggers diagnosis requests. ClickHouse MergeTree tables store millions of log lines with sub-second queries.',
      icon: Activity,
      badge: 'Real-Time OLAP',
      color: '#f59e0b'
    },
    {
      id: 'ai',
      title: 'AI Diagnosis & RAG',
      subtitle: 'Kafka Consumer & Vector Knowledge',
      desc: 'Listens to diagnosis-requests, retrieves context from S3 build-context.json, performs RAG similarity queries, and produces structured remediation plans.',
      icon: Sparkles,
      badge: 'Self-Healing Engine',
      color: '#a855f7'
    },
    {
      id: 'proxy',
      title: 'S3 Reverse Proxy',
      subtitle: 'Wildcard Dynamic Routing',
      desc: 'Listens for requests at *.shipstack.run, performs a sub-millisecond gRPC lookup to the API Server for S3 paths, and proxies assets directly to users.',
      icon: Globe,
      badge: 'Edge Gateway',
      color: '#10b981'
    }
  ];

  const selectedData = nodes.find(n => n.id === activeNode);

  return (
    <section id="architecture" className="architecture-section" aria-label="Distributed System Architecture">
      <div className="container">
        
        {/* Section Header */}
        <div className="section-head text-center">
          <span className="badge badge-ai mb-3">
            <Server size={13} />
            <span>Distributed Systems Under The Hood</span>
          </span>
          <h2 className="section-title">
            Built on Battle-Tested Cloud Primitives.{' '}
            <span className="gradient-text">Zero Compromises on Latency.</span>
          </h2>
          <p className="section-subtitle">
            ShipStack replaces brittle monolithic CI/CD with an asynchronous, event-driven topology that ensures 99.99% uptime and sub-second log delivery.
          </p>
        </div>

        {/* Interactive Architecture Flow Graph */}
        <div className="architecture-canvas glass-card">
          <div className="architecture-flow-row">
            {nodes.map((node, i) => {
              const IconComp = node.icon;
              const isSelected = activeNode === node.id;

              return (
                <React.Fragment key={node.id}>
                  <button
                    type="button"
                    className={`arch-node-btn ${isSelected ? 'active-node' : ''}`}
                    onClick={() => setActiveNode(node.id)}
                    style={{
                      '--node-color': node.color
                    }}
                  >
                    <div className="arch-node-icon" style={{ borderColor: `${node.color}55`, background: `${node.color}15` }}>
                      <IconComp size={20} style={{ color: node.color }} />
                    </div>
                    <span className="arch-node-badge">{node.badge}</span>
                    <span className="arch-node-title">{node.title}</span>
                    <span className="arch-node-sub">{node.subtitle}</span>
                  </button>

                  {i < nodes.length - 1 && (
                    <div className="arch-flow-connector">
                      <div className="connector-line"></div>
                      <span className="connector-dot"></span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Detailed Selected Node Card */}
          {selectedData && (
            <div className="arch-detail-box animate-fade-in">
              <div className="detail-header">
                <div className="flex-center gap-2">
                  <span className="pulse-dot" style={{ backgroundColor: selectedData.color }}></span>
                  <span className="detail-title">{selectedData.title}</span>
                  <span className="detail-sub mono">({selectedData.subtitle})</span>
                </div>
                <span className="detail-tag mono">{selectedData.badge}</span>
              </div>
              <p className="detail-desc">{selectedData.desc}</p>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
