import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import {
  Search,
  RotateCw,
  Download,
  ChevronDown,
  Radio,
  SlidersHorizontal,
  Loader2,
  ArrowRight,
  AlertCircle,
  Terminal,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  FolderGit2,
  GitBranch,
  ExternalLink
} from 'lucide-react';
import { 
  useProjects, 
  useProjectDeployments, 
  useDeployment, 
  useDeploymentLogs 
} from '../services/queries';
import { useDeploy } from '../context/DeployContext';

// Helper to strip ANSI codes from logs
function stripAnsi(text = '') {
  return typeof text === 'string'
    ? text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    : '';
}

// Helper to format timestamps cleanly as HH:mm:ss.SSS
function formatLogTimestamp(ts) {
  if (!ts) return '--:--:--';
  try {
    const isoString = typeof ts === 'string' && ts.includes(' ') && !ts.includes('T')
      ? ts.replace(' ', 'T')
      : ts;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(ts);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const millis = String(d.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${millis}`;
  } catch {
    return String(ts);
  }
}

// Preset demo datasets (for offline/developer testing only)
const DEMO_FAIL_LOGS = [
  { event_id: 'd1', log: '[clone:start]', timestamp: '2026-10-11 11:18:59.010' },
  { event_id: 'd2', log: '[clone] Cloning repository https://github.com/nonexistent/my-private-repo', timestamp: '2026-10-11 11:18:59.120' },
  { event_id: 'd3', log: '[clone] fatal: repository \'https://github.com/nonexistent/my-private-repo\' not found', timestamp: '2026-10-11 11:19:02.450' },
  { event_id: 'd4', log: '[clone:end] exit_code=128', timestamp: '2026-10-11 11:19:02.789' },
  { event_id: 'd5', log: '[system:error] Task stopped: Essential container in task exited with code 128', timestamp: '2026-10-11 11:19:03.012' },
];

const DEMO_SUCCESS_LOGS = [
  { event_id: 's1', log: '[clone:start]', timestamp: '2026-10-11 11:18:59.010' },
  { event_id: 's2', log: '[clone] Cloning repository https://github.com/divyanshuranjandynamic/shipstack-starter', timestamp: '2026-10-11 11:18:59.120' },
  { event_id: 's3', log: '[clone:end] exit_code=0', timestamp: '2026-10-11 11:19:01.340' },
  { event_id: 's4', log: '[install:start]', timestamp: '2026-10-11 11:19:01.450' },
  { event_id: 's5', log: '[install] added 250 packages in 3.8s', timestamp: '2026-10-11 11:19:05.670' },
  { event_id: 's6', log: '[install:end] exit_code=0', timestamp: '2026-10-11 11:19:05.890' },
  { event_id: 's7', log: '[build:start]', timestamp: '2026-10-11 11:19:06.010' },
  { event_id: 's8', log: '[build] vite v5.0.0 building for production...', timestamp: '2026-10-11 11:19:07.230' },
  { event_id: 's9', log: '[build] ✓ 142 modules transformed', timestamp: '2026-10-11 11:19:09.450' },
  { event_id: 's10', log: '[build] dist/index.html   0.45 kB │ gzip: 0.29 kB', timestamp: '2026-10-11 11:19:09.890' },
  { event_id: 's11', log: '[build] dist/assets/index.js  142.10 kB │ gzip: 45.20 kB', timestamp: '2026-10-11 11:19:09.990' },
  { event_id: 's12', log: '[build:end] exit_code=0', timestamp: '2026-10-11 11:19:10.120' },
  { event_id: 's13', log: '[s3:upload:start] Uploading build artifacts to S3 __outputs', timestamp: '2026-10-11 11:19:10.250' },
  { event_id: 's14', log: '[s3:upload:end] S3 sync completed (32 files uploaded)', timestamp: '2026-10-11 11:19:11.890' },
  { event_id: 's15', log: '[deploy:ready] Project available at https://prod.localhost:8000', timestamp: '2026-10-11 11:19:12.010' },
];

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeProject, setActiveProject } = useDeploy();

  // 1. Fetch live projects from PostgreSQL
  const { data: serverProjects = [], isLoading: isProjectsLoading } = useProjects();

  // Read URL query parameters
  const urlProjectId = searchParams.get('projectId') || '';
  const urlDeploymentId = searchParams.get('id') || searchParams.get('deploymentId') || '';

  // Determine active project
  const selectedProjectId = useMemo(() => {
    if (urlProjectId && serverProjects.some(p => p.id === urlProjectId)) {
      return urlProjectId;
    }
    if (activeProject?.id && serverProjects.some(p => p.id === activeProject.id)) {
      return activeProject.id;
    }
    return serverProjects[0]?.id || '';
  }, [urlProjectId, activeProject, serverProjects]);

  const selectedProject = useMemo(() => {
    return serverProjects.find(p => p.id === selectedProjectId) || null;
  }, [serverProjects, selectedProjectId]);

  // Sync active project if changed
  useEffect(() => {
    if (selectedProject && activeProject?.id !== selectedProject.id) {
      setActiveProject(selectedProject);
    }
  }, [selectedProject, activeProject, setActiveProject]);

  // 2. Fetch live deployments for selected project
  const { 
    data: deployments = [], 
    isLoading: isDeploymentsLoading, 
    refetch: refetchDeployments 
  } = useProjectDeployments(selectedProjectId, {
    enabled: Boolean(selectedProjectId),
  });

  // Determine active deployment
  const selectedDeploymentId = useMemo(() => {
    if (urlDeploymentId && deployments.some(d => d.id === urlDeploymentId)) {
      return urlDeploymentId;
    }
    if (urlDeploymentId && !deployments.length) {
      return urlDeploymentId;
    }
    return deployments[0]?.id || '';
  }, [urlDeploymentId, deployments]);

  // 3. Fetch deployment metadata & status
  const { data: currentDeployment } = useDeployment(selectedDeploymentId, {
    enabled: Boolean(selectedDeploymentId),
  });

  // State: streaming, autoScroll, simulation
  const [isLive, setIsLive] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [manualLookupId, setManualLookupId] = useState('');
  const [demoPreset, setDemoPreset] = useState(null); // null | 'fail' | 'success'

  const [selectedLevels, setSelectedLevels] = useState({
    warn: true,
    error: true,
    fatal: true,
    info: true,
  });

  const [lastPollTime, setLastPollTime] = useState(null);
  const logEndRef = useRef(null);

  // 4. Fetch REAL ClickHouse logs via React Query
  const { 
    data: rawServerLogs = [], 
    isLoading: isLogsLoading, 
    isFetching: isLogsFetching, 
    error: logsError, 
    refetch: refetchLogs 
  } = useDeploymentLogs(demoPreset ? '' : selectedDeploymentId, {
    live: isLive && !demoPreset && Boolean(selectedDeploymentId),
  });

  useEffect(() => {
    if (rawServerLogs?.length > 0 || isLogsFetching) {
      setLastPollTime(new Date());
    }
  }, [rawServerLogs, isLogsFetching]);

  // Consolidated raw logs (real ClickHouse logs or test preset)
  const rawLogs = useMemo(() => {
    if (demoPreset === 'fail') return DEMO_FAIL_LOGS;
    if (demoPreset === 'success') return DEMO_SUCCESS_LOGS;
    return rawServerLogs.map(l => ({
      ...l,
      log: stripAnsi(l.log || '')
    }));
  }, [demoPreset, rawServerLogs]);

  // Level classification helper
  const getLogLevel = (text = '') => {
    const lower = text.toLowerCase();
    if (lower.includes('fatal')) return 'fatal';
    if (lower.includes('error') || lower.includes('fail') || lower.includes('exit_code=1')) return 'error';
    if (lower.includes('warn')) return 'warn';
    return 'info';
  };

  // Filter logs by level & search term
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((l) => {
      const level = getLogLevel(l.log);
      if (!selectedLevels[level]) return false;
      if (searchTerm && !l.log?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [rawLogs, selectedLevels, searchTerm]);

  // Auto-scroll when logs change
  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  // Level counts
  const levelCounts = useMemo(() => {
    const counts = { info: 0, warn: 0, error: 0, fatal: 0 };
    rawLogs.forEach(l => {
      const lvl = getLogLevel(l.log);
      if (counts[lvl] !== undefined) counts[lvl]++;
    });
    return counts;
  }, [rawLogs]);

  const hasErrors = levelCounts.error > 0 || levelCounts.fatal > 0 || currentDeployment?.status === 'FAILURE';

  // ── Button Handlers ──

  const handleCopyLogs = () => {
    const text = filteredLogs.map(l => `${l.timestamp || ''}\t${l.log}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleDownload = () => {
    const text = filteredLogs.map(l => `[${l.timestamp || ''}] ${l.log}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipstack-logs-${(selectedDeploymentId || 'session').slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    refetchLogs();
    refetchDeployments();
  };

  const handleProjectChange = (e) => {
    const newId = e.target.value;
    setDemoPreset(null);
    setSearchParams({ projectId: newId });
  };

  const handleDeploymentChange = (e) => {
    const newDepId = e.target.value;
    setDemoPreset(null);
    setSearchParams({ projectId: selectedProjectId, id: newDepId });
  };

  const handleManualLookup = (e) => {
    e.preventDefault();
    if (manualLookupId.trim()) {
      setDemoPreset(null);
      setSearchParams({ id: manualLookupId.trim() });
    }
  };

  const toggleLevel = (level) => {
    setSelectedLevels(prev => ({ ...prev, [level]: !prev[level] }));
  };

  const handleResetFilters = () => {
    setSelectedLevels({ warn: true, error: true, fatal: true, info: true });
    setSearchTerm('');
  };

  return (
    <ConsoleLayout title="Logs">
      <div className="logs-page-container">

        {/* ── Left Filter Sub-Sidebar ── */}
        <aside className="logs-filter-subsidebar">
          <div className="logs-filter-header">
            <span>Filters & Targets</span>
            <button type="button" className="btn-filter-reset" onClick={handleResetFilters}>Reset</button>
          </div>

          {/* Project Selector */}
          <div style={{ marginBottom: '16px' }}>
            <div className="filter-section-title">
              <FolderGit2 size={13} color="#00dfd8" />
              <span>Target Project</span>
            </div>
            {isProjectsLoading ? (
              <div style={{ padding: '6px', fontSize: '12px', color: '#666' }}>Loading projects...</div>
            ) : serverProjects.length > 0 ? (
              <select
                value={selectedProjectId}
                onChange={handleProjectChange}
                className="filter-select-box"
                style={{ width: '100%', cursor: 'pointer', background: '#0d0d0d', border: '1px solid #27272a', color: '#fff', borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
              >
                {serverProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.subDomain || 'default'})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: '11px', color: '#888' }}>
                No projects found. <Link to="/new" style={{ color: '#00dfd8' }}>Create one</Link>.
              </div>
            )}
          </div>

          {/* Deployment Selector */}
          <div style={{ marginBottom: '16px' }}>
            <div className="filter-section-title">
              <GitBranch size={13} color="#a855f7" />
              <span>Target Deployment</span>
            </div>
            {isDeploymentsLoading ? (
              <div style={{ padding: '6px', fontSize: '12px', color: '#666' }}>Loading deployments...</div>
            ) : deployments.length > 0 ? (
              <>
                <select
                  value={selectedDeploymentId}
                  onChange={handleDeploymentChange}
                  className="filter-select-box mono"
                  style={{ width: '100%', cursor: 'pointer', background: '#0d0d0d', border: '1px solid #27272a', color: '#fff', borderRadius: '6px', padding: '6px 8px', fontSize: '11px' }}
                >
                  {deployments.map((d) => (
                    <option key={d.id} value={d.id}>
                      [{d.status}] {d.id.slice(0, 8)}... ({new Date(d.createdAt).toLocaleTimeString()})
                    </option>
                  ))}
                </select>
                {selectedDeploymentId && selectedProjectId && (
                  <Link
                    to={`/projects/${selectedProjectId}/deployments/${selectedDeploymentId}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: '#00dfd8',
                      textDecoration: 'none',
                      marginTop: '6px'
                    }}
                  >
                    <span>View Deployment Details</span>
                    <ExternalLink size={10} />
                  </Link>
                )}
              </>
            ) : (
              <div style={{ fontSize: '11px', color: '#888' }}>
                No deployments yet for this project.
              </div>
            )}
          </div>

          {/* Direct Deployment UUID Input */}
          <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #1a1a1a' }}>
            <div className="filter-section-title">
              <Terminal size={13} />
              <span>Or Direct Deployment UUID</span>
            </div>
            <form onSubmit={handleManualLookup} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={manualLookupId}
                onChange={e => setManualLookupId(e.target.value)}
                placeholder="Paste UUID..."
                className="filter-select-box mono"
                style={{ flex: 1, cursor: 'text', fontSize: '11px', padding: '6px 8px' }}
              />
              <button
                type="submit"
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '11px' }}
              >
                Fetch
              </button>
            </form>
          </div>

          {/* Severity Checkbox Filters */}
          <div style={{ marginBottom: '16px' }}>
            <div className="filter-section-title">
              <ChevronDown size={14} />
              <span>Filter by Log Level</span>
            </div>
            <div className="console-level-list">
              <label className="console-level-item" style={{ cursor: 'pointer' }}>
                <span className="level-label">
                  <input
                    type="checkbox"
                    checked={selectedLevels.info}
                    onChange={() => toggleLevel('info')}
                  />
                  <span className="level-dot" style={{ background: '#3b82f6' }}></span>
                  <span>Info / Output</span>
                </span>
                <span className="mono" style={{ fontSize: '11px', color: '#a1a1aa' }}>
                  {levelCounts.info}
                </span>
              </label>

              <label className="console-level-item" style={{ cursor: 'pointer' }}>
                <span className="level-label">
                  <input
                    type="checkbox"
                    checked={selectedLevels.warn}
                    onChange={() => toggleLevel('warn')}
                  />
                  <span className="level-dot level-warn"></span>
                  <span>Warning</span>
                </span>
                <span className="mono" style={{ fontSize: '11px', color: '#a1a1aa' }}>
                  {levelCounts.warn}
                </span>
              </label>

              <label className="console-level-item" style={{ cursor: 'pointer' }}>
                <span className="level-label">
                  <input
                    type="checkbox"
                    checked={selectedLevels.error}
                    onChange={() => toggleLevel('error')}
                  />
                  <span className="level-dot level-error"></span>
                  <span>Error</span>
                </span>
                <span className="mono" style={{ fontSize: '11px', color: '#f87171' }}>
                  {levelCounts.error}
                </span>
              </label>

              <label className="console-level-item" style={{ cursor: 'pointer' }}>
                <span className="level-label">
                  <input
                    type="checkbox"
                    checked={selectedLevels.fatal}
                    onChange={() => toggleLevel('fatal')}
                  />
                  <span className="level-dot level-fatal"></span>
                  <span>Fatal</span>
                </span>
                <span className="mono" style={{ fontSize: '11px', color: '#ef4444' }}>
                  {levelCounts.fatal}
                </span>
              </label>
            </div>
          </div>

          {/* Auto-scroll setting */}
          <div style={{ marginBottom: '20px', paddingTop: '10px', borderTop: '1px solid #1a1a1a' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              <span>Auto-scroll to latest log</span>
            </label>
          </div>

          {/* Optional Test Simulator Presets */}
          <div style={{ paddingTop: '12px', borderTop: '1px solid #1a1a1a' }}>
            <div className="filter-section-title">
              <SlidersHorizontal size={13} />
              <span>Simulated Test Presets</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setDemoPreset('fail')}
                className="btn-secondary"
                style={{
                  fontSize: '11px',
                  padding: '6px 8px',
                  justifyContent: 'flex-start',
                  borderColor: demoPreset === 'fail' ? 'rgba(239,68,68,0.5)' : '#222',
                  background: demoPreset === 'fail' ? 'rgba(239,68,68,0.08)' : '#0a0a0a',
                  color: demoPreset === 'fail' ? '#f87171' : '#aaa'
                }}
              >
                <ShieldAlert size={12} color="#ef4444" />
                <span>Simulate Clone Failure</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoPreset('success')}
                className="btn-secondary"
                style={{
                  fontSize: '11px',
                  padding: '6px 8px',
                  justifyContent: 'flex-start',
                  borderColor: demoPreset === 'success' ? 'rgba(16,185,129,0.5)' : '#222',
                  background: demoPreset === 'success' ? 'rgba(16,185,129,0.08)' : '#0a0a0a',
                  color: demoPreset === 'success' ? '#34d399' : '#aaa'
                }}
              >
                <Check size={12} color="#10b981" />
                <span>Simulate Vite Success</span>
              </button>

              {demoPreset && (
                <button
                  type="button"
                  onClick={() => setDemoPreset(null)}
                  className="btn-primary"
                  style={{ fontSize: '11px', padding: '6px 8px', marginTop: '4px' }}
                >
                  <Radio size={12} />
                  <span>Return to Real Logs</span>
                </button>
              )}
            </div>
          </div>

        </aside>

        {/* ── Main Logs Feed ── */}
        <div className="logs-main-feed">

          {/* Controls Bar */}
          <div className="logs-controls-bar">
            <div className="flex-center gap-2">
              {demoPreset ? (
                <span className="badge" style={{ fontSize: '10px', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}>
                  Simulator: {demoPreset === 'fail' ? 'Sample Clone Failure' : 'Sample Vite Success'}
                </span>
              ) : selectedDeploymentId ? (
                <span className="badge badge-ai" style={{ fontSize: '10px' }}>
                  ClickHouse Stream: {selectedDeploymentId.slice(0, 8)}... {currentDeployment?.status ? `(${currentDeployment.status})` : ''}
                </span>
              ) : (
                <span className="badge" style={{ fontSize: '10px', color: '#888' }}>
                  No Active Deployment Selected
                </span>
              )}

              {isLive && !demoPreset && (
                <span
                  className="badge"
                  style={{
                    fontSize: '10px',
                    color: '#10b981',
                    borderColor: 'rgba(16,185,129,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title={`Live ClickHouse polling active (2.5s).${lastPollTime ? ` Last sync: ${lastPollTime.toLocaleTimeString()}` : ''}`}
                >
                  <span className="pulse-dot" style={{ width: 6, height: 6, background: '#10b981', boxShadow: '0 0 6px #10b981' }}></span>
                  <span>Live Stream {isLogsFetching ? '(Polling...)' : lastPollTime ? `(${lastPollTime.toLocaleTimeString()})` : '(2.5s)'}</span>
                </span>
              )}
            </div>

            {/* Keyword Search Filter */}
            <div className="logs-search-wrapper">
              <Search size={14} color="#666" />
              <input
                type="text"
                placeholder="Filter logs in stream (e.g. fatal, error, clone, vite)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="logs-action-buttons">
              {/* 1. Live Stream Toggle Button */}
              <button
                type="button"
                className={`btn-live-toggle ${isLive ? 'active-live' : ''}`}
                onClick={() => setIsLive(!isLive)}
                title={
                  isLive
                    ? `Streaming live: ClickHouse polled every 2.5s.${lastPollTime ? ` Last poll: ${lastPollTime.toLocaleTimeString()}` : ''}`
                    : 'Live streaming is paused. Click to resume real-time ClickHouse polling.'
                }
              >
                <Radio size={13} color={isLive ? "#10b981" : "#888"} className={isLive ? "pulse-dot" : ""} />
                <span>{isLive ? 'Streaming Live (2.5s)' : 'Stream Paused'}</span>
              </button>

              {/* 2. Copy Logs Button */}
              <button
                type="button"
                className="btn-icon-sub"
                title={copiedLogs ? 'Copied to clipboard!' : 'Copy all logs'}
                onClick={handleCopyLogs}
              >
                {copiedLogs ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#888" />}
              </button>

              {/* 3. Refresh Logs Button */}
              <button
                type="button"
                className="btn-icon-sub"
                title="Refresh logs from ClickHouse"
                onClick={handleRefresh}
                disabled={isLogsLoading || isLogsFetching}
              >
                <RotateCw size={14} color="#888" className={isLogsFetching ? 'spin-icon' : ''} />
              </button>

              {/* 4. Download Logs Button */}
              <button
                type="button"
                className="btn-icon-sub"
                title="Download log file (.txt)"
                onClick={handleDownload}
              >
                <Download size={14} color="#888" />
              </button>
            </div>
          </div>

          {/* AI Diagnosis Alert Banner (Shown when errors or fatal issues exist) */}
          {hasErrors && (
            <div style={{
              margin: '12px 20px 0',
              padding: '12px 16px',
              background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.08) 0%, rgba(168, 85, 247, 0.12) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={16} color="#c084fc" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f3e8ff' }}>
                    Build Errors Detected by Kafka Stream
                  </div>
                  <div style={{ fontSize: '11px', color: '#d8b4fe' }}>
                    ShipStack AI Self-Healing Diagnosis & RAG pipeline can identify the root cause and provide fix steps.
                  </div>
                </div>
              </div>
              <Link
                to={
                  selectedProjectId && selectedDeploymentId
                    ? `/projects/${selectedProjectId}/deployments/${selectedDeploymentId}`
                    : selectedDeploymentId
                      ? `/diagnosis/${selectedDeploymentId}`
                      : '/diagnosis'
                }
                className="btn-primary"
                style={{
                  fontSize: '11px',
                  padding: '6px 14px',
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                  boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Sparkles size={12} />
                <span>Run AI Diagnosis</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}

          {logsError && !demoPreset && (
            <div style={{
              margin: '12px 20px 0',
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={14} color="#ef4444" />
              <span style={{ fontSize: '12px', color: '#f87171' }}>{logsError.message || 'Failed to fetch ClickHouse logs'}</span>
            </div>
          )}

          {/* Log Table Header */}
          <div className="logs-table-header">
            <span className="log-col-num">#</span>
            <span className="log-col-time">Timestamp</span>
            <span className="log-col-msg">Log Output</span>
          </div>

          {/* Log Entries Container */}
          <div className="logs-table-body" style={{ flex: 1, overflowY: 'auto' }}>
            {(() => {
              if (isLogsLoading && rawLogs.length === 0) {
                return (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#71717a' }}>
                    <Loader2 size={24} className="spin-icon" color="#00dfd8" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '13px' }}>Streaming logs from ClickHouse...</p>
                  </div>
                );
              }

              if (rawLogs.length === 0) {
                return (
                  <div style={{ padding: '60px 24px', textAlign: 'center', color: '#71717a' }}>
                    <Terminal size={32} style={{ margin: '0 auto 12px', color: '#3f3f46' }} />
                    <h3 style={{ fontSize: '15px', color: '#ffffff', margin: '0 0 6px' }}>No logs recorded</h3>
                    <p style={{ fontSize: '13px', margin: '0 0 16px', maxWidth: '440px', marginInline: 'auto' }}>
                      {selectedDeploymentId 
                        ? `No log events found in ClickHouse for deployment ${selectedDeploymentId.slice(0, 8)}.`
                        : 'Select a project and deployment to view real container logs.'}
                    </p>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleRefresh}
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                    >
                      <RotateCw size={12} />
                      <span>Refresh Stream</span>
                    </button>
                  </div>
                );
              }

              if (filteredLogs.length === 0) {
                return (
                  <div className="log-entry-row" style={{ padding: '24px', justifyContent: 'center' }}>
                    <span className="text-dim" style={{ fontSize: '12px' }}>
                      No log entries match the current search or log level filter.
                    </span>
                  </div>
                );
              }

              return filteredLogs.map((l, i) => {
                const level = getLogLevel(l.log);
                const isStep = l.log?.includes(':start]') || l.log?.includes(':end]');
                return (
                  <div
                    key={l.event_id || i}
                    className={`log-entry-row ${
                      level === 'fatal' || level === 'error'
                        ? 'log-row-error'
                        : level === 'warn'
                          ? 'log-row-warn'
                          : isStep
                            ? 'log-row-step'
                            : ''
                    }`}
                  >
                    <span className="log-col-num">{i + 1}</span>
                    <span className="log-col-time">{formatLogTimestamp(l.timestamp)}</span>
                    <span className="log-col-msg mono">{l.log}</span>
                  </div>
                );
              });
            })()}
            <div ref={logEndRef} />
          </div>

          {/* Bottom Summary Bar */}
          <div className="flex-center justify-between" style={{
            padding: '12px 20px',
            borderTop: '1px solid #141414',
            background: '#040404',
            fontSize: '11px',
            color: '#666'
          }}>
            <div>
              <span>Displaying <strong>{filteredLogs.length}</strong> of {rawLogs.length} log events</span>
              {selectedDeploymentId && (
                <span className="mono" style={{ marginLeft: '12px', color: '#888' }}>
                  Target: {selectedDeploymentId}
                </span>
              )}
            </div>
            <div className="flex-center gap-2">
              <span className="pulse-dot" style={{
                background: isLive && !demoPreset ? '#10b981' : '#555',
                boxShadow: isLive && !demoPreset ? '0 0 6px #10b981' : 'none'
              }}></span>
              <span>{demoPreset ? 'Test Simulator' : isLive ? 'Live Polling Active (2.5s)' : 'Paused'}</span>
            </div>
          </div>

        </div>

      </div>
    </ConsoleLayout>
  );
}
