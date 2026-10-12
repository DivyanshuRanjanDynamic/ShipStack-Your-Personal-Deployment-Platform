import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Cpu, 
  Zap, 
  Shield, 
  GitBranch, 
  Copy, 
  Check,
  Search,
  Wand2,
  FileCode2,
  Database
} from 'lucide-react';

export default function Hero({ onOpenDeploy }) {
  const [repoUrl, setRepoUrl] = useState('https://github.com/developer/nextjs-ai-storefront');
  const [activeTab, setActiveTab] = useState('diagnosis'); // 'pipeline' | 'diagnosis' | 'architecture'
  const [activeScenario, setActiveScenario] = useState('failed'); // 'success' | 'failed'
  const [isPatchApplied, setIsPatchApplied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Auto-reset patch when scenario switches
  useEffect(() => {
    setIsPatchApplied(false);
  }, [activeScenario]);

  const handleCopyCli = () => {
    navigator.clipboard?.writeText('npx shipstack deploy');
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <section className="hero-section">
      <div className="container hero-container">
        
        {/* Eyebrow Badge */}
        <div className="hero-eyebrow">
          <span className="badge badge-ai">
            <Sparkles size={13} className="nav-sparkle" />
            <span>ShipStack 2.0 with RAG Deployment Diagnosis</span>
          </span>
          <span className="hero-eyebrow-divider">•</span>
          <span className="hero-eyebrow-note">Zero-Config Global Edge Infrastructure</span>
        </div>

        {/* Main Headline (H1): 6-10 words statement */}
        <h1 className="hero-title">
          The Cloud Application Platform with Autonomous{' '}
          <span className="gradient-text-ai">AI Deployment Diagnosis</span>
        </h1>

        {/* Subheading / Value Proposition */}
        <p className="hero-subtitle">
          Turn any Git repository into high-performance serverless apps on global edge infrastructure. 
          When builds break, our real-time Kafka pipeline and RAG-powered AI isolate the root cause, 
          query tested solutions, and generate verified code fixes instantly.
        </p>

        {/* Call to Action (CTA) Box with Quick Input */}
        <div className="hero-cta-wrapper">
          <form 
            className="hero-deploy-input-card"
            onSubmit={(e) => {
              e.preventDefault();
              onOpenDeploy(repoUrl);
            }}
          >
            <div className="repo-input-icon">
              <GitBranch size={18} />
            </div>
            <input 
              type="text" 
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              className="hero-repo-input"
              aria-label="GitHub Repository URL"
            />
            <button 
              type="submit" 
              className="btn-primary hero-submit-btn"
            >
              <span>Deploy Now</span>
              <ArrowRight size={15} />
            </button>
          </form>

          <div className="hero-secondary-cta-row">
            <button 
              type="button" 
              className="btn-secondary hero-cli-btn"
              onClick={handleCopyCli}
              title="Copy CLI command"
            >
              <Terminal size={14} />
              <span className="mono">npx shipstack deploy</span>
              {copiedSnippet ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
            <a href="#ai-diagnosis" className="hero-guide-link">
              <span>See how AI Diagnosis works</span>
              <ArrowRight size={13} />
            </a>
          </div>
        </div>

        {/* Hero Visual: Interactive Product Showcase */}
        <div className="hero-visual-card">
          <div className="hero-visual-header">
            <div className="window-dots">
              <span className="dot dot-red"></span>
              <span className="dot dot-yellow"></span>
              <span className="dot dot-green"></span>
            </div>

            {/* View Mode Tabs */}
            <div className="hero-visual-tabs">
              <button 
                type="button" 
                className={`visual-tab ${activeTab === 'diagnosis' ? 'active' : ''}`}
                onClick={() => setActiveTab('diagnosis')}
              >
                <Sparkles size={13} />
                <span>AI Diagnosis + RAG</span>
                <span className="tab-pill">Live</span>
              </button>
              <button 
                type="button" 
                className={`visual-tab ${activeTab === 'pipeline' ? 'active' : ''}`}
                onClick={() => setActiveTab('pipeline')}
              >
                <Terminal size={13} />
                <span>Real-Time Logs (Kafka)</span>
              </button>
              <button 
                type="button" 
                className={`visual-tab ${activeTab === 'architecture' ? 'active' : ''}`}
                onClick={() => setActiveTab('architecture')}
              >
                <Cpu size={13} />
                <span>Edge Telemetry</span>
              </button>
            </div>

            {/* Scenario toggle */}
            <div className="scenario-switcher">
              <span className="scenario-label">Scenario:</span>
              <button 
                type="button" 
                className={`scenario-btn ${activeScenario === 'failed' && !isPatchApplied ? 'active-fail' : ''}`}
                onClick={() => setActiveScenario('failed')}
              >
                <AlertTriangle size={12} />
                <span>Build Failure</span>
              </button>
              <button 
                type="button" 
                className={`scenario-btn ${(activeScenario === 'success' || isPatchApplied) ? 'active-success' : ''}`}
                onClick={() => setActiveScenario('success')}
              >
                <CheckCircle2 size={12} />
                <span>Healed / Success</span>
              </button>
            </div>
          </div>

          {/* Hero Visual Content Body */}
          <div className="hero-visual-body">
            
            {/* TAB 1: AI DIAGNOSIS + RAG INTERACTIVE DISPLAY */}
            {activeTab === 'diagnosis' && (
              <div className="diagnosis-panel animate-fade-in">
                {activeScenario === 'failed' && !isPatchApplied ? (
                  <div className="diagnosis-failure-layout">
                    {/* Left: Raw Build Log failure */}
                    <div className="diagnosis-log-preview">
                      <div className="preview-header">
                        <span className="mono preview-tag">ClickHouse Event Stream #893c5</span>
                        <span className="badge-error-sm">Exit Code: 1</span>
                      </div>
                      <div className="console-code mono">
                        <div className="code-line"><span className="text-dim">07:16:01</span> [clone:start] Cloning into repository...</div>
                        <div className="code-line"><span className="text-dim">07:16:03</span> [install:npm] Resolving dependencies (pnpm-lock.yaml)</div>
                        <div className="code-line"><span className="text-dim">07:16:07</span> [build:vite] vite build --mode production</div>
                        <div className="code-line text-err-line">
                          <span className="text-err-bullet">✖</span> error TS2307: Cannot find module '@prisma/client' or its corresponding type declarations.
                        </div>
                        <div className="code-line text-err-line">
                          <span className="text-err-bullet">✖</span> Did you run "npx prisma generate" before build?
                        </div>
                        <div className="code-line"><span className="text-dim">07:16:09</span> [task:exited] Fargate Task EssentialContainerExited (exit 1)</div>
                      </div>

                      <div className="kafka-transit-badge">
                        <span className="pulse-dot-amber"></span>
                        <span>Dispatched to Kafka: <code className="mono">diagnosis-requests</code> in 4ms</span>
                      </div>
                    </div>

                    {/* Right: AI Diagnosis & RAG Inference Card */}
                    <div className="diagnosis-ai-card">
                      <div className="ai-card-top">
                        <div className="ai-badge-group">
                          <div className="badge badge-ai">
                            <Sparkles size={13} />
                            <span>ShipStack RAG Engine</span>
                          </div>
                          <span className="confidence-pill">Confidence: 98.4%</span>
                        </div>
                        <span className="status-badge-failed">Root Cause Pinpointed</span>
                      </div>

                      <div className="ai-card-content">
                        <h4 className="ai-root-title">
                          Missing Prisma Client Code Generation in Build Step
                        </h4>
                        <p className="ai-root-desc">
                          The repository imports <code className="mono">@prisma/client</code> in 
                          <code className="mono"> lib/prisma.ts</code>, but <code className="mono">package.json</code> 
                          build script does not execute <code className="mono">prisma generate</code> prior to the bundler run.
                        </p>

                        {/* RAG Vector Knowledge Citations */}
                        <div className="rag-citation-box">
                          <div className="rag-citation-header">
                            <Database size={13} color="#00dfd8" />
                            <span>RAG Vector Match (Similarity 0.94):</span>
                          </div>
                          <p className="rag-citation-text">
                            "ShipStack Knowledge Base / Node.js Frameworks: Serverless builds require pre-generating ORM binaries during container build lifecycle."
                          </p>
                        </div>

                        {/* Suggested Code Patch */}
                        <div className="diff-patch-preview">
                          <div className="diff-header">
                            <span className="mono">package.json</span>
                            <span className="diff-badge">Suggested Patch</span>
                          </div>
                          <div className="diff-body mono">
                            <div className="diff-line diff-del">- "build": "next build"</div>
                            <div className="diff-line diff-add">+ "build": "prisma generate && next build"</div>
                          </div>
                        </div>

                        <div className="ai-card-actions">
                          <button 
                            type="button" 
                            className="btn-primary btn-apply-patch"
                            onClick={() => setIsPatchApplied(true)}
                          >
                            <Wand2 size={15} />
                            <span>Apply 1-Click RAG Patch & Re-deploy</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* HEALED / SUCCESS DEPLOYMENT STATE */
                  <div className="diagnosis-success-layout animate-fade-in">
                    <div className="healed-banner">
                      <div className="healed-icon-box">
                        <CheckCircle2 size={24} color="#10b981" />
                      </div>
                      <div className="healed-text">
                        <h3>Deployment Healed & Live on Global Edge</h3>
                        <p>Patch verified across test container. Build artifact uploaded to S3 and routed via gRPC reverse proxy.</p>
                      </div>
                      <a 
                        href="https://fuzzy-tiger-42.shipstack.run" 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn-primary live-url-btn"
                      >
                        <span>fuzzy-tiger-42.shipstack.run</span>
                        <ExternalLink size={14} />
                      </a>
                    </div>

                    <div className="healed-metrics-grid">
                      <div className="healed-metric-box">
                        <span className="metric-label">Build Duration</span>
                        <span className="metric-value">2.41s</span>
                        <span className="metric-sub text-green">4.2x faster than cold run</span>
                      </div>
                      <div className="healed-metric-box">
                        <span className="metric-label">Diagnosis Time</span>
                        <span className="metric-value">340ms</span>
                        <span className="metric-sub text-purple">RAG vector cosine match</span>
                      </div>
                      <div className="healed-metric-box">
                        <span className="metric-label">Edge Subdomain</span>
                        <span className="metric-value mono">fuzzy-tiger-42</span>
                        <span className="metric-sub">gRPC reverse proxy registered</span>
                      </div>
                      <div className="healed-metric-box">
                        <span className="metric-label">Asset Location</span>
                        <span className="metric-value">AWS S3 eu-north-1</span>
                        <span className="metric-sub">Global CloudFront edge caching</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: REAL-TIME LOGS (KAFKA / CLICKHOUSE STREAM) */}
            {activeTab === 'pipeline' && (
              <div className="logs-terminal-panel animate-fade-in">
                <div className="terminal-bar">
                  <div className="flex-center gap-2">
                    <Terminal size={14} color="#00dfd8" />
                    <span className="mono">Kafka Topic: container-logs | Consumer Group: api-server-clickhouse</span>
                  </div>
                  <span className="badge badge-green">
                    <span className="pulse-dot"></span> Streaming Active
                  </span>
                </div>
                <div className="terminal-scroller mono">
                  <div className="log-row"><span className="log-time">07:16:00.102</span> <span className="log-tag tag-info">[init]</span> Spawning AWS ECS Fargate task: arn:aws:ecs:eu-north-1:task/abc12345</div>
                  <div className="log-row"><span className="log-time">07:16:01.314</span> <span className="log-tag tag-info">[clone:start]</span> git clone --depth=1 https://github.com/developer/nextjs-ai-storefront</div>
                  <div className="log-row"><span className="log-time">07:16:02.890</span> <span className="log-tag tag-success">[clone:end]</span> Cloned 4.12 MB in 1.57s</div>
                  <div className="log-row"><span className="log-time">07:16:03.110</span> <span className="log-tag tag-info">[install:start]</span> pnpm install --frozen-lockfile</div>
                  <div className="log-row"><span className="log-time">07:16:04.982</span> <span className="log-tag tag-success">[install:end]</span> 248 packages installed</div>
                  <div className="log-row"><span className="log-time">07:16:05.100</span> <span className="log-tag tag-info">[build:start]</span> pnpm run build</div>
                  <div className="log-row"><span className="log-time">07:16:06.450</span> <span className="log-tag tag-accent">[build:output]</span> Generated client static chunks in dist/</div>
                  <div className="log-row"><span className="log-time">07:16:06.920</span> <span className="log-tag tag-info">[upload:start]</span> Syncing dist/ assets to s3://shipstack-outputs/__outputs/fd9f081b/</div>
                  <div className="log-row"><span className="log-time">07:16:07.410</span> <span className="log-tag tag-success">[upload:end]</span> Uploaded 38 files in 490ms</div>
                  <div className="log-row"><span className="log-time">07:16:07.500</span> <span className="log-tag tag-purple">[proxy:grpc]</span> Registered subdomain 'fuzzy-tiger-42' to Reverse Proxy (Port 50051)</div>
                  <div className="log-row"><span className="log-time">07:16:07.520</span> <span className="log-tag tag-success">[ready]</span> Site deployed successfully: https://fuzzy-tiger-42.shipstack.run</div>
                </div>
              </div>
            )}

            {/* TAB 3: EDGE TELEMETRY & GAUGES */}
            {activeTab === 'architecture' && (
              <div className="telemetry-panel animate-fade-in">
                <div className="telemetry-grid">
                  <div className="gauge-card">
                    <div className="gauge-header">
                      <span>Edge P99 RTT</span>
                      <span className="mono text-cyan">28ms</span>
                    </div>
                    <div className="gauge-bar-bg">
                      <div className="gauge-bar-fill" style={{ width: '28%' }}></div>
                    </div>
                    <p className="gauge-caption">Dynamic routing via S3 Reverse Proxy over gRPC</p>
                  </div>

                  <div className="gauge-card">
                    <div className="gauge-header">
                      <span>Kafka Log Throughput</span>
                      <span className="mono text-purple">125k msgs/sec</span>
                    </div>
                    <div className="gauge-bar-bg">
                      <div className="gauge-bar-fill gauge-purple" style={{ width: '84%' }}></div>
                    </div>
                    <p className="gauge-caption">Batch streaming directly to ClickHouse tables</p>
                  </div>

                  <div className="gauge-card">
                    <div className="gauge-header">
                      <span>RAG Vector Similarity</span>
                      <span className="mono text-green">0.96 Score</span>
                    </div>
                    <div className="gauge-bar-bg">
                      <div className="gauge-bar-fill gauge-green" style={{ width: '96%' }}></div>
                    </div>
                    <p className="gauge-caption">Self-healing solution retrieval accuracy</p>
                  </div>

                  <div className="gauge-card">
                    <div className="gauge-header">
                      <span>S3 Cache Hit Ratio</span>
                      <span className="mono text-amber">99.4%</span>
                    </div>
                    <div className="gauge-bar-bg">
                      <div className="gauge-bar-fill gauge-amber" style={{ width: '99%' }}></div>
                    </div>
                    <p className="gauge-caption">Zero-origin hit for immutable asset requests</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer of Visual with Platform Indicators */}
          <div className="hero-visual-footer">
            <div className="visual-footer-item">
              <span className="pulse-dot"></span>
              <span>Container: AWS ECS Fargate</span>
            </div>
            <div className="visual-footer-item">
              <Cpu size={13} color="#a855f7" />
              <span>Event Stream: Apache Kafka 3.6</span>
            </div>
            <div className="visual-footer-item">
              <Database size={13} color="#00dfd8" />
              <span>OLAP DB: ClickHouse Cloud</span>
            </div>
            <div className="visual-footer-item">
              <Shield size={13} color="#10b981" />
              <span>Zero-Config SSL Wildcard</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
