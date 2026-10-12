import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import {
  Plus,
  GitBranch,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Search
} from 'lucide-react';
import { useProjects, useProjectDeployments } from '../services/queries';

export default function DeploymentsPage({ onOpenDeploy }) {
  const { activeProject } = useDeploy();
  const { data: serverProjects = [] } = useProjects();

  const currentProject = activeProject?.id && !activeProject.id.startsWith('prj_')
    ? activeProject
    : serverProjects[0] || null;

  const { data: realDeployments = [], isLoading: isDeploymentsLoading } = useProjectDeployments(
    currentProject?.id,
    { enabled: Boolean(currentProject?.id) }
  );

  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [isLooking, setIsLooking] = useState(false);

  // Look up a specific deployment by ID
  const handleLookup = useCallback(async (e) => {
    e?.preventDefault();
    if (!lookupId.trim()) return;

    setIsLooking(true);
    setLookupError('');
    setLookupResult(null);

    try {
      const result = await getDeployment(lookupId.trim());
      setLookupResult(result?.data?.deployment);
    } catch (err) {
      setLookupError(err.message || 'Deployment not found');
    } finally {
      setIsLooking(false);
    }
  }, [lookupId]);

  const deployments = realDeployments.map(d => ({
    id: d.id,
    msg: `Deployment ${d.id.slice(0, 8)}`,
    status: d.status,
    duration: '--',
    env: 'Production',
    commit: d.id.slice(0, 7),
    branch: 'main',
    date: new Date(d.createdAt).toLocaleDateString(),
  }));

  const getStatusIcon = (status) => {
    switch (status) {
      case 'READY':
      case 'SUCCESS': return <CheckCircle2 size={13} color="#10b981" />;
      case 'FAILURE':
      case 'FAIL': return <AlertTriangle size={13} color="#ef4444" />;
      case 'QUEUED': return <Clock size={13} color="#f59e0b" />;
      case 'IN_PROGRESS': return <Loader2 size={13} color="#00dfd8" className="spin-icon" />;
      default: return <CheckCircle2 size={13} color="#10b981" />;
    }
  };

  const getStatusLabel = (status, duration) => {
    switch (status) {
      case 'READY':
      case 'SUCCESS': return `Ready ${duration || ''}`;
      case 'FAILURE': return 'Failed';
      case 'QUEUED': return 'Queued';
      case 'IN_PROGRESS': return 'Building...';
      default: return `Ready ${duration || ''}`;
    }
  };

  return (
    <ConsoleLayout title="Deployments">
      <div className="deployments-page-view">
        <div className="flex-center justify-between" style={{ marginBottom: '20px' }}>
          <div>
            <div className="flex-center gap-2">
              <h1 style={{ margin: 0 }}>Deployments</h1>
              <span className="badge" style={{ fontSize: '11px', color: '#00dfd8', borderColor: 'rgba(0,223,216,0.3)' }}>
                {currentProject?.name || 'Projects'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#777', margin: '4px 0 0' }}>
              Showing deployment history for project <strong style={{ color: '#ccc' }}>{currentProject?.name || 'All'}</strong>
            </p>
          </div>
          <div className="flex-center gap-2">
            <Link to="/projects" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              <span>All Projects</span>
            </Link>
            <button type="button" className="btn-primary" onClick={() => onOpenDeploy?.()}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              <Plus size={14} />
              <span>New Deployment</span>
            </button>
          </div>
        </div>

        {/* Deployment Lookup Bar */}
        <div className="deploy-lookup-bar">
          <form onSubmit={handleLookup} className="flex-center gap-2" style={{ width: '100%' }}>
            <Search size={14} color="#666" />
            <input
              type="text"
              value={lookupId}
              onChange={e => setLookupId(e.target.value)}
              placeholder="Look up deployment by UUID..."
              className="deploy-lookup-input"
            />
            <button type="submit" className="btn-secondary" style={{ padding: '5px 12px', fontSize: '11px' }} disabled={isLooking}>
              {isLooking ? <Loader2 size={12} className="spin-icon" /> : <span>Lookup</span>}
            </button>
          </form>
        </div>

        {/* Lookup Result */}
        {lookupResult && (
          <div className="deploy-lookup-result animate-fade-in">
            <div className="flex-center justify-between">
              <div className="flex-center gap-2">
                {getStatusIcon(lookupResult.status)}
                <span className="mono" style={{ fontSize: '12px', color: '#ccc' }}>
                  {lookupResult.id}
                </span>
                <span className="status-tag" style={{
                  background: lookupResult.status === 'READY' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: lookupResult.status === 'READY' ? '#34d399' : '#f87171',
                  border: `1px solid ${lookupResult.status === 'READY' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  fontSize: '10px'
                }}>
                  {lookupResult.status}
                </span>
              </div>
              <div className="flex-center gap-2">
                <Link to={`/deployment/${lookupResult.id}`} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                  <ExternalLink size={11} />
                  View Details
                </Link>
                {lookupResult.status === 'FAILURE' && (
                  <Link to={`/diagnosis/${lookupResult.id}`} className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', borderColor: 'rgba(168,85,247,0.3)', color: '#c084fc' }}>
                    <Sparkles size={11} />
                    AI Diagnosis
                  </Link>
                )}
              </div>
            </div>
            {lookupResult.stoppedReason && (
              <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                {lookupResult.stoppedReason}
              </p>
            )}
          </div>
        )}

        {lookupError && (
          <div className="deploy-lookup-result animate-fade-in" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <div className="flex-center gap-2">
              <AlertTriangle size={13} color="#ef4444" />
              <span style={{ color: '#f87171', fontSize: '12px' }}>{lookupError}</span>
            </div>
          </div>
        )}

        {/* Filters Bar */}
        <div className="deployments-filter-bar">
          <button type="button" className="btn-add-filter">
            <Filter size={13} />
            <span>Add Filter</span>
          </button>

          <span className="filter-active-tag">
            Author: <strong>divyanshuranjandynamic</strong>
          </span>

          <span className="filter-active-tag">
            Environment: <strong>Production</strong>
          </span>
        </div>

        {/* Deployments List Table */}
        <div className="deployments-table">
          {deployments.map((d) => (
            <Link
              key={d.id}
              to={d.id.length > 10 ? `/deployment/${d.id}` : '#'}
              className="deployment-row"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="deploy-col-main">
                <span className="deploy-msg">{d.msg}</span>
                <span className="deploy-status-badge">
                  {getStatusIcon(d.status)}
                  <span>{getStatusLabel(d.status, d.duration)}</span>
                </span>
              </div>

              <div className="deploy-col-env">
                <span className={`env-pill-production ${d.status === 'FAILURE' ? 'env-pill-error' : ''}`}>
                  <span className="pulse-dot" style={{
                    width: 4, height: 4,
                    backgroundColor: d.status === 'FAILURE' ? '#ef4444' : '#10b981',
                    boxShadow: d.status === 'FAILURE' ? '0 0 6px #ef4444' : '0 0 6px #10b981'
                  }}></span>
                  <span>{d.env}</span>
                </span>
              </div>

              <div className="deploy-col-commit">
                <span>o- {d.commit}</span>
              </div>

              <div className="deploy-col-branch">
                <GitBranch size={13} color="#888888" />
                <span>{d.branch}</span>
              </div>

              <div className="deploy-col-date">
                <span>{d.date}</span>
              </div>

              <div className="deploy-col-actions">
                {d.status === 'FAILURE' && (
                  <Sparkles size={13} color="#c084fc" title="AI Diagnosis Available" />
                )}
                <MoreHorizontal size={14} />
              </div>
            </Link>
          ))}
        </div>

        {/* Retention Notice */}
        <div className="deploy-retention-notice">
          <span>
            Deployment Retention is enabled for this project — some deployments will be deleted after a set time period.{' '}
            <a href="#">Learn more</a>
          </span>
          <button type="button" className="btn-view-deleted">
            View Recently Deleted
          </button>
        </div>
      </div>
    </ConsoleLayout>
  );
}
