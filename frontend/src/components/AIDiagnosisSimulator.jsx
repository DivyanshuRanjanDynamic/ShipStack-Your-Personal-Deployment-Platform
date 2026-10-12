import React, { useState } from 'react';
import { 
  Sparkles, 
  Terminal, 
  Database, 
  CheckCircle2, 
  AlertOctagon, 
  Wand2, 
  ArrowRight, 
  FileCode, 
  Layers, 
  Cpu, 
  Search,
  BookOpen,
  RotateCcw
} from 'lucide-react';

export default function AIDiagnosisSimulator() {
  const scenarios = [
    {
      id: 'node20',
      title: 'Node.js 20 Deprecation',
      category: 'RUNTIME_MISMATCH',
      severity: 'Critical',
      badge: 'Vercel / Node 24 Required',
      failedLog: `[build:env] Detected engine node: ">=20.0.0"
[build:warn] Deprecation warning: Node.js 20 runtime is obsolete for new builds.
[build:error] Process exited with code 1. Deployment failed: Unsupported Node.js version in build-container.
[task:exited] EssentialContainerExited (exit 1)`,
      rootCause: 'The project configuration specifies Node.js 20 in package.json engines, which was deprecated on October 1, 2026. Modern serverless edge workers require Node.js 24.',
      confidence: 0.98,
      ragSource: 'ShipStack Infrastructure Policy: /docs/runtimes/nodejs-24-migration.md',
      ragSimilarity: 0.97,
      diffFile: 'package.json',
      diffOld: '  "engines": { "node": "^20.0.0" }',
      diffNew: '  "engines": { "node": ">=24.0.0" }',
      steps: [
        { text: 'Update package.json engine definition to Node.js 24.', type: 'config' },
        { text: 'Ensure modern native ES module syntax compatibility.', type: 'code' }
      ]
    },
    {
      id: 'prisma',
      title: 'Prisma Client Desync',
      category: 'BUILD_DEPENDENCY',
      severity: 'High',
      badge: 'Database ORM',
      failedLog: `[install:npm] Resolved 142 dependencies from lockfile
[build:start] vite build
[build:error] error TS2307: Cannot find module '@prisma/client'
[build:error] Did you forget to run "prisma generate"?
[task:exited] EssentialContainerExited (exit 1)`,
      rootCause: '@prisma/client was imported in serverless api route but prisma generate was omitted from the build script lifecycle.',
      confidence: 0.99,
      ragSource: 'ShipStack ORM Integration Guide: /docs/frameworks/prisma-ecs.md',
      ragSimilarity: 0.95,
      diffFile: 'package.json',
      diffOld: '  "build": "vite build"',
      diffNew: '  "build": "npx prisma generate && vite build"',
      steps: [
        { text: 'Add "npx prisma generate" to the build script in package.json.', type: 'config' },
        { text: 'Commit updated schema.prisma to trigger automated migration.', type: 'db' }
      ]
    },
    {
      id: 'oom',
      title: 'Fargate Container OOM',
      category: 'RESOURCE_EXHAUSTED',
      severity: 'Critical',
      badge: 'ECS Memory Watchdog',
      failedLog: `[build:bundler] Transforming 2,410 modules in parallel...
[build:warn] Heap memory approaching 2048 MB threshold
[watchdog:ecs] Container killed by Linux Out-Of-Memory (OOM) killer
[task:exited] EssentialContainerExited (exit 137)`,
      rootCause: 'The Next.js/Webpack build exceeded the 2GB memory quota due to unbound source-map generation and full parallel workers.',
      confidence: 0.94,
      ragSource: 'ShipStack ECS Tunings: /docs/troubleshooting/memory-oom-137.md',
      ragSimilarity: 0.92,
      diffFile: 'next.config.js',
      diffOld: '  productionBrowserSourceMaps: true,',
      diffNew: '  productionBrowserSourceMaps: false, // ShipStack edge generates remote sourcemaps',
      steps: [
        { text: 'Disable client-side sourcemap bundling in next.config.js.', type: 'config' },
        { text: 'ShipStack will auto-provision 4GB Fargate tier for next build attempt.', type: 'infra' }
      ]
    }
  ];

  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);
  const [fixedState, setFixedState] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const handleScenarioChange = (s) => {
    setSelectedScenario(s);
    setFixedState(false);
    setIsDiagnosing(true);
    setTimeout(() => {
      setIsDiagnosing(false);
    }, 600);
  };

  const handleApplyFix = () => {
    setFixedState(true);
  };

  const handleReset = () => {
    setFixedState(false);
  };

  return (
    <section id="ai-diagnosis" className="ai-diagnosis-section" aria-label="AI Deployment Diagnosis & RAG Studio">
      <div className="container">
        
        {/* Section Header */}
        <div className="section-head text-center">
          <span className="badge badge-ai mb-3">
            <Sparkles size={13} />
            <span>Interactive AI Diagnosis & RAG Studio</span>
          </span>
          <h2 className="section-title">
            Never Google a Broken Build Error Again.{' '}
            <span className="gradient-text-ai">Diagnosed & Healed at the Edge.</span>
          </h2>
          <p className="section-subtitle">
            ShipStack’s AI engine ingests real-time container exit codes, correlates Kafka log streams with your repo tree, 
            and conducts vector retrieval over thousands of verified fixes.
          </p>
        </div>

        {/* Scenario Selectors */}
        <div className="scenario-selector-bar">
          <span className="selector-title">Test a Failure Scenario:</span>
          <div className="scenario-pills">
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className={`scenario-pill-btn ${selectedScenario.id === sc.id ? 'active' : ''}`}
                onClick={() => handleScenarioChange(sc)}
              >
                <span>{sc.title}</span>
                <span className="scenario-pill-badge">{sc.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Interactive Studio Canvas */}
        <div className="simulator-canvas glass-card">
          
          {/* Top Bar with 6-Step Pipeline Visualizer */}
          <div className="pipeline-steps-bar">
            <span className="pipeline-label">Pipeline Trace:</span>
            <div className="pipeline-steps-list">
              <span className="step-item step-done">
                <span className="step-num">1</span>
                <span>fetchContext</span>
              </span>
              <span className="step-arrow">→</span>
              <span className="step-item step-done">
                <span className="step-num">2</span>
                <span>preprocess</span>
              </span>
              <span className="step-arrow">→</span>
              <span className="step-item step-done">
                <span className="step-num">3</span>
                <span>signature</span>
              </span>
              <span className="step-arrow">→</span>
              <span className="step-item step-done">
                <span className="step-num">4</span>
                <span>rules</span>
              </span>
              <span className="step-arrow">→</span>
              <span className="step-item step-active">
                <span className="step-num">5</span>
                <span>RAG Vector Search</span>
              </span>
              <span className="step-arrow">→</span>
              <span className="step-item step-highlight">
                <span className="step-num">6</span>
                <span>AI Root Cause + Patch</span>
              </span>
            </div>
          </div>

          {/* Dual Panel Body: Raw Log vs AI Resolution */}
          <div className="simulator-grid">
            
            {/* Left: Container Log Stream */}
            <div className="simulator-log-box">
              <div className="sim-box-header">
                <div className="flex-center gap-2">
                  <Terminal size={14} color="#f87171" />
                  <span className="mono">Kafka Event: container-logs</span>
                </div>
                <span className="status-tag status-tag-err">FAILURE DETECTED</span>
              </div>

              <div className="sim-console mono">
                <pre>{selectedScenario.failedLog}</pre>
              </div>

              <div className="sim-meta-bar mono">
                <span>Task: ECS Fargate</span>
                <span>Exit: nonzero</span>
                <span>Latency: 4.8ms</span>
              </div>
            </div>

            {/* Right: AI Diagnosis & RAG Results */}
            <div className="simulator-ai-box">
              <div className="sim-box-header">
                <div className="flex-center gap-2">
                  <Sparkles size={14} color="#c084fc" />
                  <span className="sim-header-title">ShipStack RAG Diagnosis Output</span>
                </div>
                <div className="confidence-pill">
                  Confidence: {(selectedScenario.confidence * 100).toFixed(0)}%
                </div>
              </div>

              {isDiagnosing ? (
                <div className="sim-loading-state">
                  <div className="pulse-dot-ai"></div>
                  <span>Querying RAG Vector Index & Diagnosing...</span>
                </div>
              ) : fixedState ? (
                /* Post-Fix Success State */
                <div className="sim-success-state animate-fade-in">
                  <div className="sim-success-badge">
                    <CheckCircle2 size={32} color="#10b981" />
                  </div>
                  <h3>Patch Applied Successfully!</h3>
                  <p>
                    Rebuild completed on AWS ECS container in 2.1s. Assets uploaded to S3 bucket and mapped to <code className="mono">https://healed-app.shipstack.run</code>.
                  </p>
                  <div className="flex-center gap-3 mt-4">
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={handleReset}
                    >
                      <RotateCcw size={14} />
                      <span>Re-test Scenario</span>
                    </button>
                    <a 
                      href="https://shipstack.run" 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn-primary"
                    >
                      <span>Preview Live Deployment</span>
                      <ArrowRight size={14} />
                    </a>
                  </div>
                </div>
              ) : (
                /* Diagnosis Details */
                <div className="sim-diagnosis-content animate-fade-in">
                  <div className="root-cause-banner">
                    <span className="root-label">Root Cause:</span>
                    <p className="root-text">{selectedScenario.rootCause}</p>
                  </div>

                  {/* RAG Context Retrieval Proof */}
                  <div className="rag-proof-card">
                    <div className="rag-proof-header">
                      <div className="flex-center gap-1.5">
                        <Database size={13} color="#00dfd8" />
                        <span className="rag-proof-title">RAG Vector Knowledge Reference</span>
                      </div>
                      <span className="rag-score mono">Cosine Similarity: {selectedScenario.ragSimilarity}</span>
                    </div>
                    <div className="rag-proof-path mono">{selectedScenario.ragSource}</div>
                  </div>

                  {/* Recommended Fix Steps */}
                  <div className="sim-fix-steps">
                    <span className="fix-steps-title">Recommended Solution Steps:</span>
                    <ul className="steps-list">
                      {selectedScenario.steps.map((st, idx) => (
                        <li key={idx} className="step-row">
                          <span className="step-bullet">{idx + 1}</span>
                          <span className="step-text">{st.text}</span>
                          <span className="step-type-pill mono">{st.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Diff Patch */}
                  <div className="sim-diff-box">
                    <div className="diff-bar mono">
                      <span>{selectedScenario.diffFile}</span>
                      <span className="diff-tag">1-Click Auto Patch</span>
                    </div>
                    <div className="diff-lines mono">
                      <div className="diff-line diff-del">{selectedScenario.diffOld}</div>
                      <div className="diff-line diff-add">{selectedScenario.diffNew}</div>
                    </div>
                  </div>

                  {/* Apply Fix Button */}
                  <div className="sim-action-row">
                    <button 
                      type="button" 
                      className="btn-primary btn-patch-action w-full"
                      onClick={handleApplyFix}
                    >
                      <Wand2 size={16} />
                      <span>Apply 1-Click Code Patch & Re-deploy</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
