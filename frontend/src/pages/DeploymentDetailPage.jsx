import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Loader2, 
  GitBranch, 
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Terminal,
  ArrowRight,
  RefreshCw,
  Globe,
  Cpu,
  Activity
} from 'lucide-react';
import { getDeployment, getDeploymentLogs, getDiagnosis, pollDeploymentStatus } from '../services/api';

export default function DeploymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'logs' | 'diagnosis'
  const [isPolling, setIsPolling] = useState(false);
  const abortRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    fetchDeploymentData();

    return () => {
      abortRef.current?.abort();
    };
  }, [id]);

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const fetchDeploymentData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch deployment data
      const deployResult = await getDeployment(id);
      const dep = deployResult?.data?.deployment;
      setDeployment(dep);

      // Fetch logs
      try {
        const logResult = await getDeploymentLogs(id);
        setLogs(logResult?.data?.logs || []);
      } catch {
        // Logs may not be available yet
      }

      // If deployment is in progress, poll for updates
      if (dep && (dep.status === 'QUEUED' || dep.status === 'IN_PROGRESS')) {
        startPolling(dep.id);
      }

      // If failed, fetch diagnosis
      if (dep?.status === 'FAILURE') {
        try {
          const diagResult = await getDiagnosis(id);
          setDiagnosis(diagResult);
        } catch {
          // Diagnosis may not be available
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = async (deploymentId) => {
    setIsPolling(true);
    const abort = new AbortController();
    abortRef.current = abort;

    // Also poll logs
    const logInterval = setInterval(async () => {
      if (abort.signal.aborted) {
        clearInterval(logInterval);
        return;
      }
      try {
        const logResult = await getDeploymentLogs(deploymentId);
        setLogs(logResult?.data?.logs || []);
      } catch {}
    }, 3000);

    try {
      await pollDeploymentStatus(
        deploymentId,
        (dep) => setDeployment(dep),
        { signal: abort.signal }
      );
    } catch {}

    clearInterval(logInterval);
    setIsPolling(false);

    // Final data fetch
    try {
      const finalDep = await getDeployment(deploymentId);
      setDeployment(finalDep?.data?.deployment);
      const finalLogs = await getDeploymentLogs(deploymentId);
      setLogs(finalLogs?.data?.logs || []);

      if (finalDep?.data?.deployment?.status === 'FAILURE') {
        const diagResult = await getDiagnosis(deploymentId);
        setDiagnosis(diagResult);
      }
    } catch {}
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getStatusBadge = (status) => {
    const config = {
      QUEUED: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: Clock, label: 'Queued' },
      IN_PROGRESS: { color: '#00dfd8', bg: 'rgba(0,223,216,0.12)', icon: Loader2, label: 'Building' },
      READY: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle2, label: 'Ready' },
      FAILURE: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: AlertTriangle, label: 'Failed' },
    };
    const c = config[status] || config.QUEUED;
    const Icon = c.icon;
    return (
      <span className="status-tag" style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}33` }}>
        <Icon size={13} className={status === 'IN_PROGRESS' ? 'spin-icon' : ''} />
        <span>{c.label}</span>
      </span>
    );
  };

  const formatDuration = (start, end) => {
    if (!start) return '—';
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diffMs = e - s;
    const secs = Math.floor(diffMs / 1000);
    const mins = Math.floor(secs / 60);
    return mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
  };

  if (loading) {
    return (
      <ConsoleLayout title="Deployment">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px' }}>
          <Loader2 size={20} className="spin-icon" color="#0070f3" />
          <span style={{ color: '#888' }}>Loading deployment {id?.substring(0, 8)}...</span>
        </div>
      </ConsoleLayout>
    );
  }

  if (error) {
    return (
      <ConsoleLayout title="Deployment">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
          <AlertTriangle size={32} color="#ef4444" />
          <h3 style={{ color: '#f87171' }}>Deployment Not Found</h3>
          <p style={{ color: '#888', fontSize: '13px' }}>{error}</p>
          <button type="button" className="btn-secondary" onClick={() => navigate('/deployments')}>
            ← Back to Deployments
          </button>
        </div>
      </ConsoleLayout>
    );
  }

  return (
    <ConsoleLayout title={`Deployment ${deployment?.id?.substring(0, 8) || ''}`}>
      <div className="deployment-detail-page">
        
        {/* Header */}
        <div className="detail-header">
          <div>
            <div className="flex-center gap-2" style={{ marginBottom: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 600 }}>Deployment</h1>
              {deployment && getStatusBadge(deployment.status)}
              {isPolling && (
                <span className="badge badge-ai" style={{ fontSize: '10px' }}>
                  <span className="pulse-dot" style={{ width: 4, height: 4 }}></span>
                  Live
                </span>
              )}
            </div>
            <div className="flex-center gap-2">
              <span className="mono text-dim" style={{ fontSize: '12px' }}>{id}</span>
              <button type="button" className="copy-btn" onClick={handleCopyId} style={{ padding: '2px 6px' }}>
                {copiedId ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
              </button>
            </div>
          </div>
          <div className="flex-center gap-2">
            <button type="button" className="btn-secondary" onClick={fetchDeploymentData} style={{ padding: '6px 12px', fontSize: '12px' }}>
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
            {deployment?.status === 'FAILURE' && (
              <Link 
                to={`/diagnosis/${id}`} 
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '12px', background: 'linear-gradient(135deg, #9333ea, #0070f3)', border: 'none', color: '#fff' }}
              >
                <Sparkles size={13} />
                <span>View Diagnosis</span>
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="detail-tabs">
          <button 
            type="button" 
            className={`detail-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={14} />
            Overview
          </button>
          <button 
            type="button" 
            className={`detail-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <Terminal size={14} />
            Build Logs ({logs.length})
          </button>
          {deployment?.status === 'FAILURE' && (
            <button 
              type="button" 
              className={`detail-tab ${activeTab === 'diagnosis' ? 'active' : ''}`}
              onClick={() => setActiveTab('diagnosis')}
            >
              <Sparkles size={14} color="#c084fc" />
              AI Diagnosis
            </button>
          )}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && deployment && (
          <div className="detail-overview animate-fade-in">
            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-label">Status</span>
                {getStatusBadge(deployment.status)}
              </div>
              <div className="detail-card">
                <span className="detail-label">Project ID</span>
                <span className="mono" style={{ fontSize: '12px', color: '#ccc' }}>{deployment.projectId}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Duration</span>
                <span style={{ color: '#fff', fontSize: '14px' }}>
                  {formatDuration(deployment.startedAt, deployment.updatedAt)}
                </span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Created</span>
                <span style={{ fontSize: '13px', color: '#ccc' }}>
                  {deployment.createdAt ? new Date(deployment.createdAt).toLocaleString() : '—'}
                </span>
              </div>
              {deployment.ecsTaskArn && (
                <div className="detail-card" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-label">ECS Task ARN</span>
                  <span className="mono" style={{ fontSize: '11px', color: '#888', wordBreak: 'break-all' }}>
                    {deployment.ecsTaskArn}
                  </span>
                </div>
              )}
              {deployment.stopCode && (
                <div className="detail-card">
                  <span className="detail-label">Stop Code</span>
                  <span style={{ color: '#f87171', fontSize: '13px' }}>{deployment.stopCode}</span>
                </div>
              )}
              {deployment.stoppedReason && (
                <div className="detail-card">
                  <span className="detail-label">Stopped Reason</span>
                  <span style={{ color: '#f87171', fontSize: '13px' }}>{deployment.stoppedReason}</span>
                </div>
              )}
              <div className="detail-card">
                <span className="detail-label">Timed Out</span>
                <span style={{ color: deployment.timedOut ? '#ef4444' : '#10b981' }}>
                  {deployment.timedOut ? 'Yes' : 'No'}
                </span>
              </div>
              {deployment.deadlineAt && (
                <div className="detail-card">
                  <span className="detail-label">Deadline</span>
                  <span style={{ fontSize: '13px', color: '#ccc' }}>
                    {new Date(deployment.deadlineAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="detail-logs animate-fade-in">
            <div className="detail-log-terminal mono">
              {logs.length > 0 ? (
                logs.map((l, i) => (
                  <div key={l.event_id || i} className="log-line">
                    <span className="log-time">
                      {l.timestamp ? new Date(l.timestamp).toLocaleTimeString('en-US', { hour12: false }) : `[${i}]`}
                    </span>
                    <span className={`log-text ${
                      l.log?.includes('error') || l.log?.includes('fatal') || l.log?.includes('FAIL')
                        ? 'log-error' 
                        : l.log?.includes('warn') 
                          ? 'log-warn' 
                          : l.log?.includes(':start]') || l.log?.includes(':end]')
                            ? 'log-step'
                            : ''
                    }`}>
                      {l.log}
                    </span>
                  </div>
                ))
              ) : (
                <div className="log-line">
                  <span className="log-time">—</span>
                  <span className="log-text text-dim">No logs available for this deployment</span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* Diagnosis Tab */}
        {activeTab === 'diagnosis' && (
          <div className="detail-diagnosis animate-fade-in">
            {diagnosis ? (
              <>
                {diagnosis.status === 'DONE' && diagnosis.diagnosis && (
                  <div className="diag-result-card">
                    <div className="diag-header">
                      <div className="flex-center gap-2">
                        <Sparkles size={16} color="#c084fc" />
                        <span style={{ fontWeight: 600, color: '#c084fc' }}>AI Diagnosis Result</span>
                      </div>
                      <div className="flex-center gap-2">
                        <span className="badge" style={{ fontSize: '10px' }}>
                          {diagnosis.diagnosis.category}
                        </span>
                        <span className="badge badge-ai" style={{ fontSize: '10px' }}>
                          {(diagnosis.diagnosis.confidence * 100).toFixed(0)}% confidence
                        </span>
                        <span className="badge" style={{ fontSize: '10px', borderColor: 'rgba(0,223,216,0.3)', color: '#00dfd8' }}>
                          Source: {diagnosis.diagnosis.source}
                        </span>
                      </div>
                    </div>

                    <div className="diag-root-cause">
                      <h4>Root Cause</h4>
                      <p>{diagnosis.diagnosis.root_cause}</p>
                    </div>

                    {diagnosis.diagnosis.evidence?.length > 0 && (
                      <div className="diag-evidence">
                        <h4>Evidence from Build Logs</h4>
                        {diagnosis.diagnosis.evidence.map((ev, i) => (
                          <div key={i} className="evidence-line mono">
                            <span className="evidence-line-num">L{ev.line}</span>
                            <span className="evidence-line-text">{ev.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {diagnosis.diagnosis.fix_steps?.length > 0 && (
                      <div className="diag-fix-steps">
                        <h4>Recommended Fix Steps</h4>
                        {diagnosis.diagnosis.fix_steps.map((step, i) => (
                          <div key={i} className="fix-step-row">
                            <span className="fix-step-num">{i + 1}</span>
                            <span className="fix-step-text">{step.step}</span>
                            <span className="fix-step-type mono">{step.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {diagnosis.status === 'PENDING' && (
                  <div className="text-center" style={{ padding: '60px 20px' }}>
                    <Loader2 size={28} className="spin-icon" color="#c084fc" />
                    <p style={{ color: '#888', marginTop: '16px', fontSize: '13px' }}>
                      AI diagnosis is being generated... RAG vector search in progress.
                    </p>
                  </div>
                )}

                {diagnosis.status === 'NOT_APPLICABLE' && (
                  <div className="text-center" style={{ padding: '60px 20px' }}>
                    <CheckCircle2 size={28} color="#10b981" />
                    <p style={{ color: '#888', marginTop: '16px', fontSize: '13px' }}>
                      Diagnosis not applicable — deployment did not fail.
                    </p>
                  </div>
                )}

                {diagnosis.status === 'FAILED' && (
                  <div className="text-center" style={{ padding: '60px 20px' }}>
                    <AlertTriangle size={28} color="#ef4444" />
                    <p style={{ color: '#888', marginTop: '16px', fontSize: '13px' }}>
                      {diagnosis.error || 'Diagnosis generation failed. Please inspect build logs manually.'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center" style={{ padding: '60px 20px' }}>
                <Sparkles size={28} color="#555" />
                <p style={{ color: '#888', marginTop: '16px', fontSize: '13px' }}>
                  No diagnosis data available. Diagnosis is triggered automatically when a deployment fails.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </ConsoleLayout>
  );
}
