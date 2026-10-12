import React, { useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  GitBranch, 
  Globe, 
  ExternalLink, 
  RefreshCw, 
  Plus, 
  Layers, 
  KeyRound, 
  Sliders, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Trash2, 
  Eye, 
  EyeOff, 
  FileText, 
  ArrowLeft,
  ArrowRight,
  Terminal,
  Save,
  Check
} from 'lucide-react';
import { 
  useProject, 
  useProjectDeployments, 
  useProjectEnvVars, 
  useDeployMutation,
  useUpdateEnvVarsMutation 
} from '../services/queries';
import { getProjectUrl, getDeploymentUrl } from '../types/api';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

function calculateDuration(start, end) {
  if (!start) return '--';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((e - s) / 1000));
  const min = Math.floor(diffSec / 60);
  const sec = diffSec % 60;
  return `${min}m ${sec}s`;
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'deployments';

  const { data: project, isLoading: isProjectLoading, isError: isProjectError, error: projectError } = useProject(projectId);
  const { data: deployments = [], isLoading: isDeploymentsLoading, refetch: refetchDeployments } = useProjectDeployments(projectId);
  const { data: serverEnvVars = [], isLoading: isEnvLoading } = useProjectEnvVars(projectId);

  const deployMutation = useDeployMutation();
  const updateEnvMutation = useUpdateEnvVarsMutation();

  // Local state for Environment Variables editor
  const [envVars, setEnvVars] = useState([]);
  const [envInitialized, setEnvInitialized] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [isEnvSaved, setIsEnvSaved] = useState(false);
  const [envError, setEnvError] = useState('');
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkEnvText, setBulkEnvText] = useState('');

  // Sync server env vars to local state on initial load
  if (!envInitialized && serverEnvVars && !isEnvLoading) {
    setEnvVars(serverEnvVars.length > 0 ? serverEnvVars : [{ key: '', value: '' }]);
    setEnvInitialized(true);
  }

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  // Redeploy Handler: triggers new deployment and navigates to it
  const handleRedeploy = async () => {
    try {
      const res = await deployMutation.mutateAsync({ projectId });
      const newDeploymentId = res.data.deploymentID;
      navigate(`/projects/${projectId}/deployments/${newDeploymentId}`);
    } catch (err) {
      alert(`Redeploy failed: ${err.message}`);
    }
  };

  // Env Vars actions
  const handleAddEnvRow = () => {
    setEnvVars((prev) => [...prev, { key: '', value: '' }]);
    setIsEnvSaved(false);
  };

  const handleRemoveEnvRow = (index) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
    setIsEnvSaved(false);
  };

  const handleEnvChange = (index, field, val) => {
    setEnvVars((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
    setIsEnvSaved(false);
  };

  const toggleReveal = (index) => {
    setRevealedKeys((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleApplyBulkEnv = () => {
    if (!bulkEnvText.trim()) {
      setShowBulkPaste(false);
      return;
    }
    const lines = bulkEnvText.split('\n');
    const parsed = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        parsed.push({ key, value });
      }
    }
    if (parsed.length > 0) {
      setEnvVars((prev) => {
        const clean = prev.filter((e) => e.key.trim() || e.value.trim());
        return [...clean, ...parsed];
      });
      setIsEnvSaved(false);
    }
    setBulkEnvText('');
    setShowBulkPaste(false);
  };

  const handleSaveEnvVars = async () => {
    setEnvError('');
    const clean = envVars.filter((e) => e.key.trim() || e.value.trim());
    const seen = new Set();
    for (const env of clean) {
      const k = env.key.trim();
      if (!k) {
        setEnvError('Environment variable key cannot be blank.');
        return;
      }
      if (/\s/.test(k)) {
        setEnvError(`Variable key "${k}" cannot contain spaces.`);
        return;
      }
      if (seen.has(k)) {
        setEnvError(`Duplicate variable key: "${k}".`);
        return;
      }
      seen.add(k);
    }

    try {
      await updateEnvMutation.mutateAsync({
        projectId,
        envVars: clean.map((e) => ({ key: e.key.trim(), value: e.value })),
      });
      setIsEnvSaved(true);
      setTimeout(() => setIsEnvSaved(false), 4000);
    } catch (err) {
      setEnvError(err.message || 'Failed to save environment variables.');
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
      case 'READY':
        return (
          <span className="status-tag" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span style={{ width: 6, height: 6, background: '#10b981', display: 'inline-block', borderRadius: '50%' }}></span>
            <span>Ready</span>
          </span>
        );
      case 'IN_PROGRESS':
      case 'BUILDING':
      case 'QUEUED':
        return (
          <span className="status-tag" style={{ background: 'rgba(0, 223, 216, 0.12)', color: '#00dfd8', border: '1px solid rgba(0, 223, 216, 0.3)' }}>
            <Loader2 size={11} className="spin-icon" />
            <span>{status === 'QUEUED' ? 'Queued' : 'Building'}</span>
          </span>
        );
      case 'FAILURE':
      case 'FAIL':
        return (
          <span className="status-tag" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <AlertTriangle size={11} />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="status-tag" style={{ background: '#18181b', color: '#a1a1aa' }}>
            <span>{status}</span>
          </span>
        );
    }
  };

  if (isProjectLoading) {
    return (
      <ConsoleLayout title="Loading Project...">
        <div style={{ maxWidth: '1100px', margin: '40px auto', textAlign: 'center' }}>
          <Loader2 size={32} className="spin-icon" color="#00dfd8" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#71717a', fontSize: '14px' }}>Loading project details...</p>
        </div>
      </ConsoleLayout>
    );
  }

  if (isProjectError || !project) {
    return (
      <ConsoleLayout title="Project Not Found">
        <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center' }}>
          <AlertTriangle size={36} color="#f87171" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#ffffff', fontSize: '20px', marginBottom: '8px' }}>Project Not Found</h2>
          <p style={{ color: '#71717a', fontSize: '14px', marginBottom: '24px' }}>
            {projectError?.message || `The project with ID "${projectId}" could not be located.`}
          </p>
          <Link to="/" className="btn-primary" style={{ padding: '8px 20px', textDecoration: 'none' }}>
            Return to Dashboard
          </Link>
        </div>
      </ConsoleLayout>
    );
  }

  const prodUrl = getProjectUrl(project);

  return (
    <ConsoleLayout title={project.name}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 12px 64px' }}>
        {/* Back navigation */}
        <Link
          to="/"
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
          <span>All Projects</span>
        </Link>

        {/* Project Header */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.5px' }}>
                  {project.name}
                </h1>
                {deployments[0] && renderStatusBadge(deployments[0].status)}
              </div>

              {/* Repo & Production Domain Links */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', fontSize: '13px' }}>
                <a
                  href={project.gitUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a1a1aa', textDecoration: 'none' }}
                >
                  <GitBranch size={14} />
                  <span>{project.gitUrl.replace('https://github.com/', '')}</span>
                  <ExternalLink size={12} color="#71717a" />
                </a>

                <a
                  href={prodUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00dfd8', textDecoration: 'none' }}
                >
                  <Globe size={14} />
                  <span>{project.customDomain || `${project.subDomain}.localhost:8000`}</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Actions: Visit & Redeploy */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href={prodUrl}
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
                    <span>Triggering Build...</span>
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
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1f1f23', marginBottom: '24px' }}>
          {[
            { id: 'deployments', label: 'Deployments', icon: Layers, count: deployments.length },
            { id: 'env', label: 'Environment Variables', icon: KeyRound, count: serverEnvVars?.length },
            { id: 'settings', label: 'Settings', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 500,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #0070f3' : '2px solid transparent',
                  color: isActive ? '#ffffff' : '#71717a',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} color={isActive ? '#0070f3' : '#71717a'} />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    style={{
                      fontSize: '11px',
                      background: isActive ? '#18181b' : '#141416',
                      color: isActive ? '#ffffff' : '#71717a',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      border: '1px solid #27272a',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: Deployments List ── */}
        {activeTab === 'deployments' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                Deployment History ({deployments.length})
              </h2>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => refetchDeployments()}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
            </div>

            {isDeploymentsLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#71717a' }}>
                <Loader2 size={24} className="spin-icon" style={{ margin: '0 auto 10px' }} />
                <span>Loading deployments...</span>
              </div>
            )}

            {!isDeploymentsLoading && deployments.length === 0 && (
              <div
                style={{
                  background: '#09090b',
                  border: '1px dashed #27272a',
                  borderRadius: '12px',
                  padding: '48px 24px',
                  textAlign: 'center',
                }}
              >
                <Layers size={28} color="#71717a" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '16px', color: '#ffffff', margin: '0 0 6px' }}>No deployments yet</h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: '0 0 16px' }}>
                  Trigger your first deployment to build and publish this project.
                </p>
                <button type="button" className="btn-primary" onClick={handleRedeploy} style={{ padding: '8px 18px', fontSize: '13px' }}>
                  Deploy Now
                </button>
              </div>
            )}

            {!isDeploymentsLoading && deployments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {deployments.map((dep) => {
                  const depUrl = getDeploymentUrl(project, dep);
                  return (
                    <div
                      key={dep.id}
                        style={{
                          background: '#09090b',
                          border: '1px solid #1f1f23',
                          borderRadius: '10px',
                          padding: '16px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '14px',
                          transition: 'border-color 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {renderStatusBadge(dep.status)}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <Link
                                to={`/projects/${projectId}/deployments/${dep.id}`}
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  color: '#ffffff',
                                  textDecoration: 'none',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {dep.id.slice(0, 8)}...
                              </Link>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#71717a', background: '#141416', padding: '1px 6px', borderRadius: '4px', border: '1px solid #27272a' }}>
                                <GitBranch size={11} />
                                <span>main</span>
                              </span>
                              {dep.stopCode && (
                                <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                  {dep.stopCode}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#71717a', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} />
                                <span>{formatRelativeTime(dep.createdAt)}</span>
                              </span>
                              <span>Duration: {calculateDuration(dep.startedAt || dep.createdAt, dep.status === 'QUEUED' || dep.status === 'IN_PROGRESS' ? null : dep.updatedAt)}</span>
                              {dep.status === 'SUCCESS' && (
                                <a
                                  href={depUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#00dfd8', textDecoration: 'none' }}
                                >
                                  <Globe size={11} />
                                  <span>{project?.subDomain}.localhost:8000</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Link
                            to={`/projects/${projectId}/deployments/${dep.id}`}
                            className="btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '12px', textDecoration: 'none' }}
                          >
                            <Terminal size={13} />
                            <span>Logs & Details</span>
                            <ArrowRight size={12} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Environment Variables ── */}
        {activeTab === 'env' && (
          <div>
            {/* Banner: Changes apply to next deployment */}
            <div
              style={{
                background: 'rgba(0, 112, 243, 0.08)',
                border: '1px solid rgba(0, 112, 243, 0.25)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#60a5fa',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Changes apply to the next deployment. Redeploy to apply.</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRedeploy}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                Redeploy Now
              </button>
            </div>

            {envError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#f87171',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {envError}
              </div>
            )}

            <div
              style={{
                background: '#09090b',
                border: '1px solid #1f1f23',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 2px' }}>
                    Project Environment Variables
                  </h3>
                  <p style={{ fontSize: '12px', color: '#71717a', margin: 0 }}>
                    Secrets and configuration keys injected at build time.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowBulkPaste(!showBulkPaste)}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    <FileText size={13} />
                    <span>Paste .env</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAddEnvRow}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    <Plus size={13} />
                    <span>Add Variable</span>
                  </button>
                </div>
              </div>

              {/* Bulk paste drawer */}
              {showBulkPaste && (
                <div style={{ background: '#030303', border: '1px solid #27272a', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
                    Paste .env lines:
                  </label>
                  <textarea
                    rows={4}
                    value={bulkEnvText}
                    onChange={(e) => setBulkEnvText(e.target.value)}
                    placeholder="KEY=value&#10;SECRET=123"
                    style={{
                      width: '100%',
                      background: '#09090b',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      marginBottom: '10px',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" className="btn-secondary" onClick={() => setShowBulkPaste(false)} style={{ padding: '4px 10px', fontSize: '12px' }}>
                      Cancel
                    </button>
                    <button type="button" className="btn-primary" onClick={handleApplyBulkEnv} style={{ padding: '4px 12px', fontSize: '12px' }}>
                      Append
                    </button>
                  </div>
                </div>
              )}

              {/* Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {envVars.map((env, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="KEY (e.g. DATABASE_URL)"
                      value={env.key}
                      onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                      style={{
                        flex: 1,
                        background: '#030303',
                        border: '1px solid #27272a',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <div style={{ position: 'relative', flex: 1.4 }}>
                      <input
                        type={revealedKeys[idx] ? 'text' : 'password'}
                        placeholder="Value"
                        value={env.value}
                        onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                        style={{
                          width: '100%',
                          background: '#030303',
                          border: '1px solid #27272a',
                          borderRadius: '6px',
                          padding: '8px 36px 8px 12px',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleReveal(idx)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#71717a',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        {revealedKeys[idx] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {envVars.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEnvRow(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '6px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                {isEnvSaved && (
                  <span style={{ fontSize: '13px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} />
                    <span>Saved successfully</span>
                  </span>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveEnvVars}
                  disabled={updateEnvMutation.isPending}
                  style={{ padding: '8px 20px', fontSize: '13px' }}
                >
                  {updateEnvMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="spin-icon" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Environment Variables</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: Settings ── */}
        {activeTab === 'settings' && (
          <div
            style={{
              background: '#09090b',
              border: '1px solid #1f1f23',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 16px' }}>
              Project Settings
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '4px' }}>
                  Project ID
                </label>
                <input
                  type="text"
                  readOnly
                  value={project.id}
                  style={{ width: '100%', background: '#030303', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 12px', color: '#a1a1aa', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '4px' }}>
                  Subdomain Slug
                </label>
                <input
                  type="text"
                  readOnly
                  value={project.subDomain}
                  style={{ width: '100%', background: '#030303', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 12px', color: '#a1a1aa', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '4px' }}>
                Git Source Repository
              </label>
              <input
                type="text"
                readOnly
                value={project.gitUrl}
                style={{ width: '100%', background: '#030303', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 12px', color: '#a1a1aa', fontSize: '13px', fontFamily: 'monospace' }}
              />
            </div>

            {/* Build Specifications */}
            <div style={{ paddingTop: '20px', borderTop: '1px solid #18181b' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', margin: '0 0 14px' }}>
                Build Specifications
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Framework</span>
                  <div style={{ background: '#030303', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 12px', color: '#ffffff', fontSize: '12px' }}>
                    {project.buildSettings?.framework || 'React (Vite)'}
                  </div>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Root Directory</span>
                  <div style={{ background: '#030303', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 12px', color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
                    {project.buildSettings?.rootDir || './'}
                  </div>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Output Directory</span>
                  <div style={{ background: '#030303', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 12px', color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
                    {project.buildSettings?.outDir || 'dist'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Install Command</span>
                  <div style={{ background: '#030303', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 12px', color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
                    {project.buildSettings?.installCmd || 'npm install'}
                  </div>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Build Command</span>
                  <div style={{ background: '#030303', border: '1px solid #27272a', borderRadius: '6px', padding: '8px 12px', color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
                    {project.buildSettings?.buildCmd || 'npm run build'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConsoleLayout>
  );
}
