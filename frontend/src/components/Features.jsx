import React, { useState } from 'react';
import { 
  Cpu, 
  Terminal, 
  Sparkles, 
  Globe2, 
  ArrowRight, 
  Layers, 
  ShieldCheck, 
  Zap, 
  FileText,
  Workflow,
  CheckCircle2
} from 'lucide-react';

export default function Features({ onSelectFeature }) {
  const [activeCard, setActiveCard] = useState(null);

  const features = [
    {
      id: 'builds',
      colIndex: '01',
      title: 'Automated Container Builds',
      subtitle: 'Isolated AWS ECS Fargate Tasks',
      desc: 'Connect your GitHub repository. ShipStack provisions isolated Docker containers on AWS ECS Fargate that automatically install dependencies, compile assets, and ship production bundles in seconds.',
      icon: Cpu,
      accentColor: '#0070f3',
      metrics: 'Zero-config detection for Next.js, Vite & React',
      tag: 'Serverless CI/CD',
      codeSnippet: `POST /deploy\n{\n  "projectId": "fd9f081b-5aa8-4f11",\n  "branch": "main"\n}\n// → ECS Fargate container spawned`
    },
    {
      id: 'logs',
      colIndex: '02',
      title: 'Kafka Log Streaming & OLAP',
      subtitle: 'ClickHouse Real-time Analytics',
      desc: 'Build logs stream directly through high-throughput Apache Kafka topics into ClickHouse OLAP storage. Experience sub-millisecond terminal rendering and search millions of historical build events.',
      icon: Terminal,
      accentColor: '#00dfd8',
      metrics: '120k+ msgs/sec with persistent ClickHouse retention',
      tag: 'Event Streaming',
      codeSnippet: `Kafka Producer: container-logs\n→ Topic: container-logs\n→ ClickHouse Engine: MergeTree\n// → Sub-second log queries`
    },
    {
      id: 'diagnosis',
      colIndex: '03',
      title: 'AI Diagnosis & RAG Healing',
      subtitle: 'Vector-Assisted Root Cause Analysis',
      desc: 'When a build fails, ShipStack doesn’t leave you stranded with an exit code. The AI Diagnosis service isolates error signatures, queries RAG vector indexes of known issues, and generates actionable 1-click patches.',
      icon: Sparkles,
      accentColor: '#a855f7',
      metrics: '98.4% root cause accuracy with verified code diffs',
      tag: 'Autonomous AI',
      codeSnippet: `GET /deployments/:id/diagnosis\n{\n  "status": "DONE",\n  "confidence": 0.95,\n  "root_cause": "Node.js 20 deprecation"\n}`
    },
    {
      id: 'proxy',
      colIndex: '04',
      title: 'Dynamic gRPC Reverse Proxy',
      subtitle: 'Wildcard Subdomains & S3 Hosting',
      desc: 'Each build receives an instant wildcard subdomain. Our custom reverse proxy uses lightning-fast internal gRPC (port 50051) to resolve project paths and stream assets directly from Amazon S3 with zero origin lag.',
      icon: Globe2,
      accentColor: '#10b981',
      metrics: '< 25ms TTFB with global edge caching & SSL',
      tag: 'Edge Routing',
      codeSnippet: `Browser (*.shipstack.run)\n→ s3-reverse-proxy (HTTP:8000)\n→ gRPC ProjectService:50051\n// → AWS S3 (__outputs/)`
    }
  ];

  return (
    <section id="platform" className="features-section" aria-label="Services and Features Overview">
      <div className="container">
        
        {/* Section Header */}
        <div className="section-head text-center">
          <span className="badge badge-ai mb-3">
            <Layers size={13} />
            <span>Complete Cloud PaaS Architecture</span>
          </span>
          <h2 className="section-title">
            Engineered for High-Velocity Teams.{' '}
            <span className="gradient-text">Healed by Autonomous Intelligence.</span>
          </h2>
          <p className="section-subtitle">
            ShipStack combines industrial-grade distributed primitives—Docker ECS, Apache Kafka, ClickHouse, and gRPC—with a next-generation RAG diagnosis engine.
          </p>
        </div>

        {/* 4-Column Feature Grid */}
        <div className="features-grid">
          {features.map((f, i) => {
            const IconComp = f.icon;
            const isHovered = activeCard === f.id;

            return (
              <div 
                key={f.id}
                className="feature-card glass-card"
                onMouseEnter={() => setActiveCard(f.id)}
                onMouseLeave={() => setActiveCard(null)}
              >
                <div className="feature-card-header">
                  <div 
                    className="feature-icon-wrapper"
                    style={{ borderColor: `${f.accentColor}44`, background: `${f.accentColor}15` }}
                  >
                    <IconComp size={22} style={{ color: f.accentColor }} />
                  </div>
                  <span className="feature-col-num mono">{f.colIndex}</span>
                </div>

                <div className="feature-tag-row">
                  <span className="feature-category-badge">{f.tag}</span>
                  <span className="feature-subtitle-text">{f.subtitle}</span>
                </div>

                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>

                {/* Micro Code Snippet */}
                <div className="feature-code-box mono">
                  <pre>{f.codeSnippet}</pre>
                </div>

                <div className="feature-card-footer">
                  <div className="feature-metric-text">
                    <CheckCircle2 size={13} color={f.accentColor} />
                    <span>{f.metrics}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
