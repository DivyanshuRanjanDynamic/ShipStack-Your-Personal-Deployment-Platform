import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Loader2, 
  ExternalLink, 
  Copy, 
  Check, 
  RefreshCw, 
  Terminal, 
  ArrowLeft,
  Sparkles,
  Pause,
  Play,
  ArrowDown,
  Layers,
  Wand2,
  FileCode,
  Globe,
  Search
} from 'lucide-react';
import { 
  useDeployment, 
  useDeploymentLogs, 
  useProject, 
  useDiagnosis,
  useDeployMutation 
} from '../services/queries';
import { getDeploymentUrl } from '../types/api';

export default function DeploymentPage() {
  const { projectId, deploymentId } = useParams();
  const navigate = useNavigate();

  // Queries (keyed independently by deploymentId and projectId)
  const { data: deployment, isLoading: isDepLoading, isError: isDepError, error: depError, refetch: refetchDeployment } = useDeployment(deploymentId);
  const { data: project } = useProject(projectId || deployment?.projectId);
  const deployMutation = useDeployMutation();

  const isTerminal = deployment?.status === 'SUCCESS' || deployment?.status === 'READY' || deployment?.status === 'FAILURE' || deployment?.status === 'FAIL';
  const isFailed = deployment?.status === 'FAILURE' || deployment?.status === 'FAIL';

  // Live log polling state
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Poll logs live while build is active and not paused
  const shouldLiveStream = !isTerminal && !isPaused;
  const { data: rawLogs = [], isLoading: isLogsLoading, refetch: refetchLogs } = useDeploymentLogs(deploymentId, { live: shouldLiveStream });

  // AI Diagnosis query (only enabled if build failed)
  const { data: diagnosisData } = useDiagnosis(deploymentId, { enabled: isFailed });

  const logContainerRef = useRef(null);
  const logEndRef = useRef(null);

  // Deduplicate and sanitize logs
  const logs = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const item of rawLogs) {
      const key = `${item.timestamp}-${item.log}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  }, [rawLogs]);

  const [logSearchTerm, setLogSearchTerm] = useState('');

  // Filter logs by search term
  const filteredLogs = useMemo(() => {
    if (!logSearchTerm.trim()) return logs;
    const term = logSearchTerm.toLowerCase();
    return logs.filter((l) => l.log.toLowerCase().includes(term));
  }, [logs, logSearchTerm]);

  // Auto-scroll when new logs arrive if enabled
  useEffect(() => {
    if (autoScroll && !isPaused && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, autoScroll, isPaused]);

  // Copy full logs to clipboard
  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] ${l.log}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2500);
  };

  // Copy deployment ID
  const handleCopyId = () => {
    navigator.clipboard.writeText(deploymentId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Redeploy Handler
  const handleRedeploy = async () => {
    const targetProjId = projectId || deployment?.projectId;
    if (!targetProjId) return;
    try {
      const res = await deployMutation.mutateAsync({ projectId: targetProjId });
      const nextId = res.data.deploymentID;
      navigate(`/projects/${targetProjId}/deployments/${nextId}`);
    } catch (err) {
      alert(`Redeploy failed: ${err.message}`);
    }
  };

  // Status timeline steps
  const getTimelineSteps = () => {
    const current = deployment?.status;
    const isSuccess = current === 'SUCCESS' || current === 'READY';
    const isFail = current === 'FAILURE' || current === 'FAIL';
    const isBuilding = current === 'IN_PROGRESS';
    const isQueued = current === 'QUEUED';

    return [
      {
        id: 'queued',
        label: 'Queued',
        status: isQueued ? 'active' : 'done',
      },
      {
        id: 'building',
        label: 'Building',
        status: isBuilding ? 'active' : isSuccess || isFail ? 'done' : 'pending',
      },
      {
        id: 'final',
        label: isFail ? 'Failed' : 'Ready',
        status: isFail ? 'failed' : isSuccess ? 'success' : 'pending',
      },
    ];
  };

  if (isDepLoading) {
    return (
      <ConsoleLayout title="Loading Deployment...">
        <div style={{ maxWidth: '1100px', margin: '40px auto', textAlign: 'center' }}>
          <Loader2 size={32} className="spin-icon" color="#00dfd8" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#71717a', fontSize: '14px' }}>Loading deployment...</p>
        </div>
      </ConsoleLayout>
    );
  }

  if (isDepError || !deployment) {
    return (
      <ConsoleLayout title="Deployment Not Found">
        <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center' }}>
          <AlertTriangle size={36} color="#f87171" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#ffffff', fontSize: '20px', marginBottom: '8px' }}>Deployment Not Found</h2>
          <p style={{ color: '#71717a', fontSize: '14px', marginBottom: '24px' }}>
            {depError?.message || `Deployment with ID "${deploymentId}" was not found.`}
          </p>
          <Link to={projectId ? `/projects/${projectId}` : '/'} className="btn-primary" style={{ padding: '8px 20px', textDecoration: 'none' }}>
            Return to Project
          </Link>
        </div>
      </ConsoleLayout>
    );
  }

  const visitUrl = project ? getDeploymentUrl(project, deployment) : '#';
  const timeline = getTimelineSteps();

  return (
    <ConsoleLayout title={`Deployment ${deploymentId.slice(0, 8)}`}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 12px 64px' }}>
        {/* Back Link */}
        <Link
          to={projectId ? `/projects/${projectId}` : '/'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: '#71717a',
            textDecoration: 'none',
            marginBottom: '16px',
          }}
        >
          <ArrowLeft size={14} />
          <span>{project?.name ? `Back to ${project.name}` : 'Back to Project'}</span>
        </Link>

        {/* Top Header Card */}
        <div
          style={{
            background: '#09090b',
            border: '1px solid #1f1f23',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#ffffff', fontFamily: 'monospace' }}>
                  {deploymentId}
                </h1>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Copy Deployment ID"
                  style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '2px', display: 'flex' }}
                >
                  {copiedId ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#71717a' }}>
                {project && (
                  <span>
                    Project: <strong style={{ color: '#ffffff' }}>{project.name}</strong>
                  </span>
                )}
                <span>Created: {new Date(deployment.createdAt).toLocaleTimeString()}</span>
                {deployment.stopCode && (
                  <span style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    {deployment.stopCode}
                  </span>
                )}
              </div>
            </div>

            {/* Actions: Visit & Redeploy */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href={visitUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}
              >
                <span>Visit</span>
                <ExternalLink size={14} />
              </a>

              <button
                type="button"
                className="btn-primary"
                onClick={handleRedeploy}
                disabled={deployMutation.isPending}
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                {deployMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="spin-icon" />
                    <span>Redeploying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Redeploy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status Timeline Strip */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #18181b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {timeline.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 600,
                        background:
                          step.status === 'success'
                            ? '#10b981'
                            : step.status === 'failed'
                            ? '#ef4444'
                            : step.status === 'active'
                            ? '#00dfd8'
                            : step.status === 'done'
                            ? '#3f3f46'
                            : '#18181b',
                        color: step.status === 'pending' ? '#71717a' : '#000000',
                      }}
                    >
                      {step.status === 'active' ? (
                        <Loader2 size={14} className="spin-icon" color="#000" />
                      ) : step.status === 'success' || step.status === 'done' ? (
                        <Check size={14} color="#fff" />
                      ) : step.status === 'failed' ? (
                        <AlertTriangle size={14} color="#fff" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: step.status === 'active' ? 600 : 500,
                        color: step.status === 'pending' ? '#71717a' : '#ffffff',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < timeline.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: '2px',
                        background: step.status === 'done' || step.status === 'active' ? '#3f3f46' : '#18181b',
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* AI Diagnosis Panel (if build failed) */}
        {isFailed && diagnosisData?.diagnosis && (
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(147, 51, 234, 0.08) 0%, rgba(10, 10, 12, 0.95) 100%)',
              border: '1px solid rgba(147, 51, 234, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#c084fc" />
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                  AI Deployment Diagnosis
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(147, 51, 234, 0.2)',
                    color: '#c084fc',
                    border: '1px solid rgba(147, 51, 234, 0.4)',
                  }}
                >
                  {diagnosisData.diagnosis.category || 'BUILD_ERROR'}
                </span>
              </div>
              {typeof diagnosisData.diagnosis.confidence === 'number' && (
                <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                  Confidence: {Math.round(diagnosisData.diagnosis.confidence * 100)}%
                </span>
              )}
            </div>

            <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px' }}>
              <strong style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px', textTransform: 'uppercase' }}>
                Root Cause
              </strong>
              <p style={{ fontSize: '14px', color: '#ffffff', margin: 0, lineHeight: 1.5 }}>
                {diagnosisData.diagnosis.root_cause}
              </p>
            </div>

            {/* Fix Steps */}
            {diagnosisData.diagnosis.fix_steps?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Suggested Action Plan
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {diagnosisData.diagnosis.fix_steps.map((fix, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#09090b',
                        border: '1px solid #1f1f23',
                        borderRadius: '6px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <span style={{ color: '#00dfd8', fontWeight: 600 }}>{idx + 1}.</span>
                      <span style={{ flex: 1 }}>{fix.step}</span>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '3px', background: '#18181b', color: '#71717a' }}>
                        {fix.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log Evidence */}
            {diagnosisData.diagnosis.evidence?.length > 0 && (
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Log Evidence Excerpts
                </strong>
                <div
                  style={{
                    background: '#050505',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px',
                    color: '#f87171',
                  }}
                >
                  {diagnosisData.diagnosis.evidence.map((ev, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', padding: '2px 0' }}>
                      <span style={{ color: '#71717a', userSelect: 'none', minWidth: '35px' }}>L{ev.line}:</span>
                      <span>{ev.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Build Logs Console */}
        <div
          style={{
            background: '#050505',
            border: '1px solid #1f1f23',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Terminal Console Toolbar */}
          <div
            style={{
              background: '#09090b',
              borderBottom: '1px solid #1f1f23',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Terminal size={15} color="#00dfd8" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Build & Runtime Logs</span>
              <span style={{ fontSize: '11px', color: '#71717a' }}>({logs.length} lines)</span>
              {shouldLiveStream && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#00dfd8' }}>
                  <span className="pulse-dot" style={{ width: 6, height: 6, background: '#00dfd8', borderRadius: '50%' }}></span>
                  Streaming
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Pause / Resume button */}
              {!isTerminal && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsPaused(!isPaused)}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  {isPaused ? <Play size={12} /> : <Pause size={12} />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>
              )}

              {/* Auto scroll toggle */}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAutoScroll(!autoScroll)}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  color: autoScroll ? '#00dfd8' : '#71717a',
                }}
              >
                <ArrowDown size={12} />
                <span>Auto-scroll</span>
              </button>

              {/* Copy logs */}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCopyLogs}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                {copiedLogs ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Log filter input */}
              <div style={{ position: 'relative', width: '150px' }}>
                <Search size={12} color="#71717a" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#030303',
                    border: '1px solid #27272a',
                    borderRadius: '4px',
                    padding: '3px 8px 3px 24px',
                    color: '#ffffff',
                    fontSize: '11px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Manual refresh */}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => refetchLogs()}
                style={{ padding: '4px 8px', fontSize: '11px' }}
                title="Refresh logs"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {/* Terminal Logs Content */}
          <div
            ref={logContainerRef}
            style={{
              padding: '16px',
              maxHeight: '520px',
              minHeight: '280px',
              overflowY: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              lineHeight: 1.6,
              color: '#d4d4d8',
            }}
          >
            {isLogsLoading && logs.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#71717a', padding: '20px 0' }}>
                <Loader2 size={14} className="spin-icon" />
                <span>Waiting for container log stream...</span>
              </div>
            )}

            {!isLogsLoading && filteredLogs.length === 0 && (
              <div style={{ color: '#71717a', padding: '20px 0', textAlign: 'center' }}>
                {logSearchTerm ? `No log lines matching "${logSearchTerm}"` : 'No logs recorded for this deployment task yet.'}
              </div>
            )}

            {filteredLogs.map((item, index) => {
              const line = item.log;
              const isErrorLine =
                line.includes('ERR!') ||
                line.includes('Error:') ||
                line.includes('fatal:') ||
                line.includes('failed') ||
                line.includes('FAILURE');
              const isSuccessLine =
                line.includes('Done') ||
                line.includes('success') ||
                line.includes('✓') ||
                line.includes('Ready');

              return (
                <div
                  key={item.event_id || index}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '1px 0',
                    color: isErrorLine ? '#f87171' : isSuccessLine ? '#34d399' : '#d4d4d8',
                  }}
                >
                  <span style={{ color: '#52525b', userSelect: 'none', minWidth: '70px', fontSize: '11px' }}>
                    {item.timestamp ? item.timestamp.split('T')[1]?.slice(0, 8) || item.timestamp.slice(11, 19) : ''}
                  </span>
                  <span style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{line}</span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </ConsoleLayout>
  );
}
