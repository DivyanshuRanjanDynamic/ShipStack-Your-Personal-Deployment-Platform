import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  GitBranch, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  ExternalLink, 
  ArrowRight, 
  Cpu, 
  Loader2,
  Copy,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useDeploy } from '../context/DeployContext';

export default function DeploymentModal({ isOpen, onClose, initialRepo = '' }) {
  const navigate = useNavigate();
  const {
    deployState,
    activeProject,
    activeDeployment,
    deployError,
    logs,
    isStreamingLogs,
    diagnosis,
    diagnosisStatus,
    startFullDeployFlow,
    resetDeployState,
    apiBaseUrl,
  } = useDeploy();

  const [gitUrl, setGitUrl] = useState(initialRepo || '');
  const [projectName, setProjectName] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [localError, setLocalError] = useState('');
  const logEndRef = useRef(null);

  // Auto-extract project name from Git URL
  useEffect(() => {
    if (gitUrl) {
      const parts = gitUrl.split('/');
      const last = parts[parts.length - 1]?.replace('.git', '');
      if (last) setProjectName(last);
    }
  }, [gitUrl]);

  // Update gitUrl when initialRepo changes
  useEffect(() => {
    if (initialRepo) {
      setGitUrl(initialRepo);
    }
  }, [initialRepo]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Reset on close
  const handleClose = () => {
    resetDeployState();
    setLocalError('');
    onClose();
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleDeploy = async () => {
    if (isSubmitting || deployState !== 'idle') return;

    const trimmedUrl = gitUrl.trim();
    const trimmedName = projectName.trim();

    if (!trimmedUrl) {
      setLocalError('Git repository URL is required');
      return;
    }
    if (!trimmedName) {
      setLocalError('Project name is required');
      return;
    }

    try {
      const urlObj = new URL(trimmedUrl);
      if (!urlObj.hostname.includes('github.com')) {
        setLocalError('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repository)');
        return;
      }
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length < 2) {
        setLocalError('GitHub URL must include username/organization and repository name');
        return;
      }
    } catch {
      setLocalError('Please enter a valid URL (e.g., https://github.com/username/repository)');
      return;
    }

    setLocalError('');
    setIsSubmitting(true);
    
    try {
      await startFullDeployFlow(trimmedUrl, trimmedName);
    } catch (err) {
      // Error is set in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    const subdomain = activeProject?.subDomain;
    if (subdomain) {
      navigator.clipboard?.writeText(`http://${subdomain}.localhost:8000`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleViewDeployment = () => {
    if (activeDeployment?.id) {
      handleClose();
      navigate(`/deployment/${activeDeployment.id}`);
    }
  };

  const handleViewDiagnosis = () => {
    if (activeDeployment?.id) {
      handleClose();
      navigate(`/diagnosis/${activeDeployment.id}`);
    }
  };

  const handleRetry = () => {
    resetDeployState();
    setLocalError('');
  };

  // Determine status display
  const getStatusDisplay = () => {
    switch (deployState) {
      case 'creating': return { text: 'Registering project...', color: '#00dfd8' };
      case 'queued': return { text: 'Queued — waiting for ECS container...', color: '#f59e0b' };
      case 'building': return { text: 'Building on AWS ECS Fargate...', color: '#00dfd8' };
      case 'ready': return { text: 'Deployment successful!', color: '#10b981' };
      case 'failed': return { text: 'Build failed', color: '#ef4444' };
      case 'error': return { text: 'Error occurred', color: '#ef4444' };
      default: return { text: 'Ready to deploy', color: '#888888' };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="modal-backdrop animate-fade-in" onClick={handleClose}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="flex-center gap-2">
            <Cpu size={18} color="#0070f3" />
            <h3 className="modal-title">Deploy to ShipStack</h3>
          </div>
          <div className="flex-center gap-2">
            <span className="mono" style={{ fontSize: '10px', color: '#555', letterSpacing: '0.5px' }}>
              API: {apiBaseUrl}
            </span>
            <button 
              type="button" 
              className="modal-close-btn"
              onClick={handleClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── IDLE STATE: Input Form ─── */}
        {deployState === 'idle' && (
          <div className="modal-body">
            {localError && (
              <div className="deploy-error-banner">
                <AlertCircle size={14} color="#ef4444" />
                <span>{localError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="deploy-git-url" className="form-label">Git Repository URL</label>
              <div className="input-with-icon">
                <GitBranch size={16} className="input-icon" aria-hidden="true" />
                <input 
                  id="deploy-git-url"
                  type="url" 
                  value={gitUrl}
                  onChange={e => setGitUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className="modal-input"
                  required
                />
              </div>
              <span className="input-hint">Public GitHub repo (React, Next.js, Vite, Vue, Node.js)</span>
            </div>

            <div className="form-group">
              <label htmlFor="deploy-project-name" className="form-label">Project Name</label>
              <input 
                id="deploy-project-name"
                type="text" 
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="my-react-app"
                className="modal-input"
              />
            </div>

            <div className="modal-infra-preview">
              <div className="infra-preview-item">
                <span className="infra-key">Build Environment:</span>
                <span className="infra-val mono">AWS ECS Fargate (Docker)</span>
              </div>
              <div className="infra-preview-item">
                <span className="infra-key">Log Broker:</span>
                <span className="infra-val mono">Apache Kafka → ClickHouse</span>
              </div>
              <div className="infra-preview-item">
                <span className="infra-key">Serving Engine:</span>
                <span className="infra-val mono">S3 + gRPC Reverse Proxy</span>
              </div>
              <div className="infra-preview-item">
                <span className="infra-key">AI Diagnosis:</span>
                <span className="infra-val mono">RAG Vector Search + Rules Engine</span>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={handleDeploy}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="spin-icon" />
                    <span>Initiating Deploy...</span>
                  </>
                ) : (
                  <span>Deploy →</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── BUILDING STATE: Live Log Stream ─── */}
        {(deployState === 'creating' || deployState === 'queued' || deployState === 'building') && (
          <div className="modal-streaming-body">
            <div className="stream-header">
              <div className="flex-center gap-2">
                <Loader2 size={16} className="spin-icon" color={statusDisplay.color} />
                <span>{statusDisplay.text}</span>
              </div>
              <div className="flex-center gap-2">
                {activeProject?.subDomain && (
                  <span className="badge" style={{ fontSize: '10px' }}>
                    {activeProject.subDomain}
                  </span>
                )}
                {isStreamingLogs && (
                  <span className="badge badge-ai" style={{ fontSize: '10px' }}>
                    <span className="pulse-dot" style={{ width: 4, height: 4 }}></span>
                    Kafka Stream: Live
                  </span>
                )}
              </div>
            </div>

            {/* Pipeline Step Indicators */}
            <div className="deploy-pipeline-bar">
              <span className={`pipeline-step ${deployState !== 'idle' ? 'active' : ''}`}>
                POST /project
              </span>
              <span className="pipeline-arrow">→</span>
              <span className={`pipeline-step ${deployState === 'queued' || deployState === 'building' ? 'active' : ''}`}>
                POST /deploy
              </span>
              <span className="pipeline-arrow">→</span>
              <span className={`pipeline-step ${deployState === 'building' ? 'active' : ''}`}>
                ECS Build
              </span>
              <span className="pipeline-arrow">→</span>
              <span className="pipeline-step">
                S3 Upload
              </span>
            </div>

            {/* Log Terminal */}
            <div className="modal-terminal mono">
              {activeProject && (
                <div className="stream-line">
                  <span className="stream-time text-dim">[api]</span>
                  <span className="stream-msg text-green">
                    Project registered: {activeProject.name} → {activeProject.subDomain}
                  </span>
                </div>
              )}
              {activeDeployment?.id && (
                <div className="stream-line">
                  <span className="stream-time text-dim">[api]</span>
                  <span className="stream-msg text-cyan">
                    Deployment ID: {activeDeployment.id}
                  </span>
                </div>
              )}
              {logs.length > 0 ? (
                logs.map((l, i) => (
                  <div key={l.event_id || i} className="stream-line">
                    <span className="stream-time text-dim">
                      {l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : `[${i}]`}
                    </span>
                    <span className={`stream-msg ${
                      l.log?.includes('error') || l.log?.includes('fatal') 
                        ? 'text-red' 
                        : l.log?.includes('warn') 
                          ? 'text-amber' 
                          : ''
                    }`}>
                      {l.log}
                    </span>
                  </div>
                ))
              ) : (
                <div className="stream-line">
                  <span className="stream-time text-dim">[kafka]</span>
                  <span className="stream-msg text-dim">Waiting for container logs...</span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ─── SUCCESS STATE ─── */}
        {deployState === 'ready' && (
          <div className="modal-success-body animate-fade-in text-center">
            <div className="success-icon-large">
              <CheckCircle2 size={40} color="#10b981" />
            </div>

            <h3 className="success-title">Deployment Live!</h3>
            <p className="success-desc">
              Built on AWS ECS Fargate, assets uploaded to S3, 
              and routed via gRPC reverse proxy.
            </p>

            {activeProject?.subDomain && (
              <div className="url-copy-box">
                <span className="url-text mono">
                  http://{activeProject.subDomain}.localhost:8000
                </span>
                <button 
                  type="button" 
                  className="copy-btn"
                  onClick={handleCopy}
                >
                  {copiedLink ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}

            <div className="success-modal-actions flex-center gap-3 mt-4" style={{ justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={handleViewDeployment}
              >
                View Deployment
              </button>
              {activeProject?.subDomain && (
                <a 
                  href={`http://${activeProject.subDomain}.localhost:8000`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-primary"
                >
                  <span>Visit Live App</span>
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ─── FAILED STATE ─── */}
        {deployState === 'failed' && (
          <div className="modal-success-body animate-fade-in">
            <div className="text-center" style={{ marginBottom: '20px' }}>
              <AlertTriangle size={36} color="#ef4444" />
              <h3 className="success-title" style={{ color: '#f87171' }}>Build Failed</h3>
              <p className="success-desc">
                {activeDeployment?.stoppedReason || 'The deployment container exited with a non-zero code.'}
              </p>
              {activeDeployment?.stopCode && (
                <span className="badge" style={{ marginTop: '8px', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
                  {activeDeployment.stopCode}
                </span>
              )}
            </div>

            {/* Diagnosis Status */}
            <div style={{ 
              background: 'rgba(168, 85, 247, 0.08)', 
              border: '1px solid rgba(168, 85, 247, 0.2)', 
              borderRadius: '10px', 
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div className="flex-center gap-2" style={{ marginBottom: '8px' }}>
                <Sparkles size={14} color="#c084fc" />
                <span style={{ color: '#c084fc', fontWeight: 600, fontSize: '13px' }}>
                  AI Diagnosis {diagnosisStatus === 'pending' ? 'in progress...' : diagnosisStatus === 'done' ? 'complete' : ''}
                </span>
              </div>
              {diagnosisStatus === 'done' && diagnosis?.diagnosis && (
                <>
                  <p style={{ fontSize: '13px', color: '#d4d4d8', marginBottom: '8px' }}>
                    <strong>Root Cause:</strong> {diagnosis.diagnosis.root_cause}
                  </p>
                  <p style={{ fontSize: '11px', color: '#888' }}>
                    Category: {diagnosis.diagnosis.category} · 
                    Confidence: {(diagnosis.diagnosis.confidence * 100).toFixed(0)}% · 
                    Source: {diagnosis.diagnosis.source}
                  </p>
                </>
              )}
              {diagnosisStatus === 'pending' && (
                <div className="flex-center gap-2">
                  <Loader2 size={14} className="spin-icon" color="#c084fc" />
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    Querying RAG vector index and analyzing build logs...
                  </span>
                </div>
              )}
            </div>

            <div className="success-modal-actions flex-center gap-3" style={{ justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={handleRetry}
              >
                <RefreshCw size={14} />
                <span>Deploy Again</span>
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={handleViewDiagnosis}
                style={{ background: 'linear-gradient(135deg, #9333ea, #0070f3)', border: 'none', color: '#fff' }}
              >
                <Sparkles size={14} />
                <span>View Full Diagnosis</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── ERROR STATE ─── */}
        {deployState === 'error' && (
          <div className="modal-success-body animate-fade-in text-center">
            <AlertCircle size={36} color="#ef4444" />
            <h3 className="success-title" style={{ color: '#f87171' }}>Error</h3>
            <p className="success-desc">{deployError}</p>

            <div className="success-modal-actions flex-center gap-3 mt-4" style={{ justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={handleRetry}
              >
                <RefreshCw size={14} />
                <span>Try Again</span>
              </button>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
