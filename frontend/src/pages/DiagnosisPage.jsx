import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import {
  Sparkles,
  Terminal,
  Database,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Wand2,
  ArrowRight,
  FileCode,
  Layers,
  Cpu,
  Search,
  BookOpen,
  RotateCcw,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { getDiagnosis, getDeployment, getDeploymentLogs, pollDiagnosisStatus } from '../services/api';

export default function DiagnosisPage() {
  const { deploymentId } = useParams();

  // Manual lookup state (when no deploymentId in URL)
  const [lookupId, setLookupId] = useState('');
  const [activeDeploymentId, setActiveDeploymentId] = useState(deploymentId || '');

  // Data states
  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagStatus, setDiagStatus] = useState('idle');
  // 'idle' | 'loading' | 'pending' | 'done' | 'failed' | 'not_applicable' | 'error'
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch everything for a deployment
  const fetchDiagnosisData = useCallback(async (depId) => {
    if (!depId?.trim()) return;

    setActiveDeploymentId(depId);
    setDiagStatus('loading');
    setError(null);
    setDiagnosis(null);
    setDeployment(null);
    setLogs([]);

    try {
      // Fetch deployment metadata
      const depResult = await getDeployment(depId);
      setDeployment(depResult?.data?.deployment);

      // Fetch logs
      try {
        const logResult = await getDeploymentLogs(depId);
        setLogs(logResult?.data?.logs || []);
      } catch {
        // Logs may not exist yet
      }

      // Fetch diagnosis
      const diagResult = await getDiagnosis(depId);
      setDiagnosis(diagResult);

      if (diagResult?.status === 'PENDING') {
        setDiagStatus('pending');
        // Poll until done
        try {
          const finalDiag = await pollDiagnosisStatus(
            depId,
            (data) => {
              setDiagnosis(data);
              if (data?.status) {
                setDiagStatus(data.status.toLowerCase());
              }
            },
            { maxAttempts: 60 }
          );
          setDiagnosis(finalDiag);
          setDiagStatus(finalDiag?.status?.toLowerCase() || 'failed');
        } catch {
          setDiagStatus('failed');
        }
      } else {
        setDiagStatus(diagResult?.status?.toLowerCase() || 'error');
      }
    } catch (err) {
      if (err.status === 404 || err.message?.toLowerCase().includes('not found')) {
        setError(`Deployment "${depId}" does not exist in ShipStack.`);
        setDiagStatus('404');
      } else {
        setError(err.message || 'Failed to fetch diagnosis');
        setDiagStatus('error');
      }
    }
  }, []);

  // Auto-fetch if deploymentId is in URL
  useEffect(() => {
    if (deploymentId) {
      fetchDiagnosisData(deploymentId);
    }
  }, [deploymentId, fetchDiagnosisData]);

  const handleLookup = (e) => {
    e.preventDefault();
    if (lookupId.trim()) {
      fetchDiagnosisData(lookupId.trim());
    }
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(activeDeploymentId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.9) return '#10b981';
    if (conf >= 0.7) return '#f59e0b';
    return '#ef4444';
  };

  const getSourceLabel = (source) => {
    const map = {
      STUB: 'Deterministic Rules',
      RULES: 'Rule Engine',
      LLM: 'AI Language Model',
      LLM_FALLBACK: 'Rule Engine Fallback',
      CACHE: 'Cached Result'
    };
    return map[source] || source;
  };

  return (
    <ConsoleLayout title="AI Diagnosis">
      <div className="diagnosis-page-container">

        {/* Page Header */}
        <div className="diag-page-header">
          <div>
            <div className="flex-center gap-2" style={{ marginBottom: '4px' }}>
              <Sparkles size={20} color="#c084fc" />
              <h1 style={{ fontSize: '22px', fontWeight: 700 }}>AI Deployment Diagnosis</h1>
            </div>
            <p style={{ color: '#888', fontSize: '13px', maxWidth: '600px' }}>
              Analyze failed deployments with AI-powered root cause analysis, RAG vector search,
              and actionable fix suggestions backed by ShipStack knowledge base.
            </p>
          </div>
        </div>

        {/* Lookup Form (when no deployment is active) */}
        {!activeDeploymentId && diagStatus === 'idle' && (
          <div className="diag-lookup-card">
            <div className="flex-center gap-2" style={{ marginBottom: '16px' }}>
              <Search size={16} color="#888" />
              <span style={{ fontWeight: 600, color: '#ccc' }}>Look Up Deployment Diagnosis</span>
            </div>
            <form onSubmit={handleLookup} className="diag-lookup-form">
              <input
                type="text"
                value={lookupId}
                onChange={e => setLookupId(e.target.value)}
                placeholder="Enter deployment UUID (e.g. fe83af11-a1e3-429e-813b-6a31326cd539)"
                className="modal-input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '8px 20px' }}>
                <Sparkles size={14} />
                <span>Diagnose</span>
              </button>
            </form>
            <p style={{ color: '#555', fontSize: '11px', marginTop: '12px' }}>
              Diagnosis is automatically triggered when a deployment fails.
              You can also look up any past deployment by its UUID.
            </p>
          </div>
        )}

        {/* Loading State */}
        {diagStatus === 'loading' && (
          <div className="diag-loading-state animate-fade-in">
            <div className="diag-loading-inner">
              <Loader2 size={24} className="spin-icon" color="#c084fc" />
              <span>Fetching deployment data and diagnosis...</span>
              <span className="mono text-dim" style={{ fontSize: '11px' }}>
                GET /deployment/{activeDeploymentId?.substring(0, 8)}...
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {diagStatus === 'error' && (
          <div className="diag-error-state animate-fade-in">
            <AlertCircle size={32} color="#ef4444" />
            <h3 style={{ color: '#f87171', marginTop: '12px' }}>Unable to Fetch Diagnosis</h3>
            <p style={{ color: '#888', fontSize: '13px' }}>{error}</p>
            <div className="flex-center gap-2 mt-4">
              <button type="button" className="btn-secondary" onClick={() => { setDiagStatus('idle'); setActiveDeploymentId(''); }}>
                <Search size={14} />
                <span>Try Another ID</span>
              </button>
              <button type="button" className="btn-secondary" onClick={() => fetchDiagnosisData(activeDeploymentId)}>
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* 404 State: Deployment Not Found */}
        {diagStatus === '404' && (
          <div className="diag-error-state animate-fade-in" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
            <AlertCircle size={40} color="#ef4444" />
            <h3 style={{ color: '#f87171', marginTop: '12px', fontSize: '18px' }}>404 — Deployment Not Found</h3>
            <p style={{ color: '#aaa', fontSize: '13px', maxWidth: '520px', margin: '8px auto 0' }}>
              The deployment <span className="mono" style={{ color: '#fca5a5' }}>{activeDeploymentId}</span> does not exist in ShipStack. It may never have been triggered or the ID was mistyped.
            </p>
            <div className="flex-center gap-2 mt-4">
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => { setDiagStatus('idle'); setActiveDeploymentId(''); setLookupId(''); }}
              >
                <Search size={14} />
                <span>Look Up Another ID</span>
              </button>
            </div>
          </div>
        )}

        {/* Pending State */}
        {diagStatus === 'pending' && (
          <div className="diag-pending-state animate-fade-in">
            <div className="diag-pipeline-visual">
              <div className="pipeline-node done">
                <Database size={14} />
                <span>Fetch Logs</span>
              </div>
              <span className="pipeline-connector done"></span>
              <div className="pipeline-node done">
                <Terminal size={14} />
                <span>Preprocess</span>
              </div>
              <span className="pipeline-connector done"></span>
              <div className="pipeline-node done">
                <FileCode size={14} />
                <span>Signature</span>
              </div>
              <span className="pipeline-connector active"></span>
              <div className="pipeline-node active">
                <Search size={14} />
                <span>Rules Engine</span>
              </div>
              <span className="pipeline-connector"></span>
              <div className="pipeline-node">
                <Sparkles size={14} />
                <span>AI Synthesis</span>
              </div>
            </div>
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
              AI diagnosis pipeline is running... Preprocessing build logs, evaluating heuristic rules, and synthesizing root cause.
            </p>
          </div>
        )}

        {/* Not Applicable State */}
        {diagStatus === 'not_applicable' && (
          <div className="diag-na-state animate-fade-in">
            <CheckCircle2 size={32} color="#10b981" />
            <h3 style={{ color: '#34d399', marginTop: '12px' }}>No Diagnosis Needed</h3>
            <p style={{ color: '#888', fontSize: '13px' }}>
              This deployment {deployment?.status === 'READY' ? 'completed successfully' : 'is still in progress'}.
              AI diagnosis is only triggered for failed deployments.
            </p>
            {deployment && (
              <Link to={`/deployment/${activeDeploymentId}`} className="btn-secondary mt-4">
                View Deployment Details
              </Link>
            )}
          </div>
        )}

        {/* Diagnosis Done — Full Results */}
        {diagStatus === 'done' && diagnosis?.diagnosis && (
          <div className="diag-results animate-fade-in">

            {/* Deployment Context Bar */}
            {deployment && (
              <div className="diag-context-bar">
                <div className="flex-center gap-3">
                  <span className="status-tag" style={{
                    background: 'rgba(239,68,68,0.12)',
                    color: '#f87171',
                    border: '1px solid rgba(239,68,68,0.25)'
                  }}>
                    <AlertTriangle size={12} />
                    FAILURE
                  </span>
                  <span className="mono" style={{ fontSize: '12px', color: '#888' }}>
                    {activeDeploymentId}
                  </span>
                  <button type="button" className="copy-btn" onClick={handleCopyId} style={{ padding: '2px 6px' }}>
                    {copiedId ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  </button>
                </div>
                <div className="flex-center gap-2">
                  {deployment.stopCode && (
                    <span className="mono text-dim" style={{ fontSize: '11px' }}>{deployment.stopCode}</span>
                  )}
                  <Link to={`/deployment/${activeDeploymentId}`} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                    <ExternalLink size={11} />
                    Details
                  </Link>
                </div>
              </div>
            )}

            {/* Main Diagnosis Layout: Logs + AI Result */}
            <div className="diag-split-layout">

              {/* Left: Build Logs */}
              <div className="diag-logs-panel">
                <div className="diag-panel-header">
                  <div className="flex-center gap-2">
                    <Terminal size={14} color="#f87171" />
                    <span className="mono" style={{ fontSize: '12px' }}>Build Logs (ClickHouse)</span>
                  </div>
                  <span className="badge" style={{ fontSize: '10px' }}>{logs.length} entries</span>
                </div>
                <div className="diag-log-terminal mono">
                  {logs.length > 0 ? (
                    logs.map((l, i) => (
                      <div key={l.event_id || i} className={`diag-log-line ${diagnosis.diagnosis.evidence?.some(ev => ev.text && l.log?.includes(ev.text))
                          ? 'highlighted'
                          : ''
                        }`}>
                        <span className="diag-log-num">{i + 1}</span>
                        <span className={`diag-log-text ${l.log?.includes('error') || l.log?.includes('fatal') ? 'error' :
                            l.log?.includes('warn') ? 'warn' : ''
                          }`}>
                          {l.log}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="diag-log-line">
                      <span className="diag-log-num">—</span>
                      <span className="diag-log-text text-dim">No logs available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: AI Diagnosis Output */}
              <div className="diag-ai-panel">
                <div className="diag-panel-header">
                  <div className="flex-center gap-2">
                    <Sparkles size={14} color="#c084fc" />
                    <span style={{ fontWeight: 600, color: '#c084fc', fontSize: '13px' }}>
                      ShipStack AI Diagnosis
                    </span>
                  </div>
                  <div className="flex-center gap-2">
                    <span className="badge badge-ai" style={{ fontSize: '10px' }}>
                      {getSourceLabel(diagnosis.diagnosis.source)}
                    </span>
                  </div>
                </div>

                <div className="diag-ai-content">
                  {/* Category & Confidence */}
                  {(() => {
                    const isSuggestion = (diagnosis.diagnosis.confidence < 0.6) || diagnosis.diagnosis.category === 'UNKNOWN';
                    return (
                      <>
                        <div className="diag-meta-row">
                          <div className="flex-center gap-2">
                            <span className="diag-category-badge">
                              {diagnosis.diagnosis.category}
                            </span>
                            {isSuggestion && (
                              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', fontSize: '11px' }}>
                                Suggested Hypothesis
                              </span>
                            )}
                          </div>
                          <div className="diag-confidence">
                            <span style={{ fontSize: '11px', color: '#888' }}>Confidence:</span>
                            <span className="diag-confidence-bar">
                              <span
                                className="diag-confidence-fill"
                                style={{
                                  width: `${diagnosis.diagnosis.confidence * 100}%`,
                                  background: getConfidenceColor(diagnosis.diagnosis.confidence)
                                }}
                              ></span>
                            </span>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: getConfidenceColor(diagnosis.diagnosis.confidence)
                            }}>
                              {(diagnosis.diagnosis.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* Human Review Required Banner */}
                        {diagnosis.diagnosis.needs_human && (
                          <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            marginBottom: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '12px',
                            color: '#fcd34d'
                          }}>
                            <AlertCircle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                            <span>
                              <strong>Human Review Advised:</strong> The AI diagnosis pipeline flagged high uncertainty or used a heuristic fallback. Please inspect the build logs to confirm root cause.
                            </span>
                          </div>
                        )}

                        {/* Root Cause */}
                        <div className="diag-root-cause-card">
                          <h4>
                            <AlertTriangle size={14} color={isSuggestion ? "#f59e0b" : "#ef4444"} />
                            {isSuggestion ? 'Potential Root Cause (Suggested)' : 'Root Cause'}
                          </h4>
                          <p>{diagnosis.diagnosis.root_cause}</p>
                          {isSuggestion && (
                            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px', fontStyle: 'italic' }}>
                              Notice: Low confidence score ({(diagnosis.diagnosis.confidence * 100).toFixed(0)}%). This diagnosis is provided as a suggested lead rather than a confirmed failure cause. Please cross-reference build logs.
                            </p>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* Evidence */}
                  {diagnosis.diagnosis.evidence?.length > 0 && (
                    <div className="diag-evidence-card">
                      <h4>
                        <Search size={14} color="#00dfd8" />
                        Evidence from Build Logs
                      </h4>
                      {diagnosis.diagnosis.evidence.map((ev, i) => (
                        <div key={i} className="evidence-row mono">
                          <span className="evidence-ln">Line {ev.line}</span>
                          <span className="evidence-text">{ev.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fix Steps */}
                  {diagnosis.diagnosis.fix_steps?.length > 0 && (
                    <div className="diag-fix-card">
                      <h4>
                        <Wand2 size={14} color="#c084fc" />
                        Recommended Fix Steps
                      </h4>
                      {diagnosis.diagnosis.fix_steps.map((step, i) => (
                        <div key={i} className="fix-step-item">
                          <span className="fix-num">{i + 1}</span>
                          <span className="fix-text">{step.step}</span>
                          <div className="flex-center gap-1">
                            {step.source_chunk_id && (
                              <span
                                className="fix-source-badge mono"
                                title={`Grounded in knowledge chunk: ${step.source_chunk_id}`}
                              >
                                <BookOpen size={9} />
                                Grounded
                              </span>
                            )}
                            <span className="fix-type-badge mono">{step.type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Knowledge Base Sources */}
                  {diagnosis.diagnosis.sources?.length > 0 && (
                    <div className="diag-sources-card">
                      <h4>
                        <BookOpen size={14} color="#38bdf8" />
                        Grounded Knowledge Sources ({diagnosis.diagnosis.sources.length})
                      </h4>
                      <div className="sources-list">
                        {diagnosis.diagnosis.sources.map((src, i) => (
                          <div key={src.id || i} className="source-item">
                            <div className="source-info">
                              <span className="source-title">{src.title || src.id}</span>
                              <span className="source-meta mono">
                                {src.source || 'playbook'} &middot; {src.id}
                              </span>
                            </div>
                            {src.url?.startsWith('https://') && (
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link"
                                title={`Open ${src.title || 'documentation'}`}
                              >
                                <ExternalLink size={11} />
                                <span>Docs</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="diag-actions-bar">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setDiagStatus('idle'); setActiveDeploymentId(''); }}
              >
                <Search size={14} />
                <span>Diagnose Another</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fetchDiagnosisData(activeDeploymentId)}
              >
                <RefreshCw size={14} />
                <span>Re-fetch</span>
              </button>
            </div>
          </div>
        )}

        {/* Failed Diagnosis State */}
        {diagStatus === 'failed' && (
          <div className="diag-error-state animate-fade-in">
            <AlertTriangle size={32} color="#f59e0b" />
            <h3 style={{ color: '#fbbf24', marginTop: '12px' }}>Diagnosis Generation Failed</h3>
            <p style={{ color: '#888', fontSize: '13px' }}>
              {diagnosis?.error || 'The AI diagnosis pipeline could not produce a result. Please inspect build logs manually.'}
            </p>
            <div className="flex-center gap-2 mt-4">
              <Link to={`/deployment/${activeDeploymentId}`} className="btn-secondary">
                <Terminal size={14} />
                <span>View Build Logs</span>
              </Link>
              <button type="button" className="btn-secondary" onClick={() => fetchDiagnosisData(activeDeploymentId)}>
                <RefreshCw size={14} />
                <span>Retry Diagnosis</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </ConsoleLayout>
  );
}
