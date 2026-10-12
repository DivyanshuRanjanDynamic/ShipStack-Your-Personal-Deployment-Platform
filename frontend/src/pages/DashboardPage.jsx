import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  FolderGit2, 
  Plus, 
  Search, 
  ExternalLink, 
  GitBranch, 
  Clock, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Terminal,
  Globe
} from 'lucide-react';
import { useProjects } from '../services/queries';
import { getProjectUrl } from '../types/api';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Never';
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

export default function DashboardPage() {
  const { data: projects = [], isLoading, isError, error, refetch, isFetching } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = projects.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(term) ||
      p.gitUrl?.toLowerCase().includes(term) ||
      p.subDomain?.toLowerCase().includes(term)
    );
  });

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
      case 'READY':
        return (
          <span className="status-tag" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block', borderRadius: '50%' }}></span>
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
            <span>Not Deployed</span>
          </span>
        );
    }
  };

  return (
    <ConsoleLayout title="Dashboard">
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 12px' }}>
        {/* Header bar */}
        <div className="flex-center justify-between" style={{ marginBottom: '28px' }}>
          <div>
            <div className="flex-center gap-2">
              <h1 style={{ fontSize: '26px', fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.5px' }}>
                Projects
              </h1>
              {!isLoading && (
                <span className="badge" style={{ fontSize: '11px', background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
                  {projects.length} Total
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: '#71717a', margin: '4px 0 0' }}>
              Your cloud deployments, web services, and AI agents.
            </p>
          </div>

          <div className="flex-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh projects list"
              style={{ padding: '8px 12px', fontSize: '13px' }}
            >
              <RefreshCw size={14} className={isFetching ? 'spin-icon' : ''} />
            </button>
            <Link
              to="/new"
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '13px', textDecoration: 'none' }}
            >
              <Plus size={15} />
              <span>New Project</span>
            </Link>
          </div>
        </div>

        {/* Search filter strip */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
            <Search size={15} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search projects by name, repo, or subdomain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: '#09090b',
                border: '1px solid #27272a',
                borderRadius: '8px',
                padding: '9px 12px 9px 36px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '24px',
                  height: '190px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  opacity: 0.6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ width: '140px', height: '18px', background: '#27272a', borderRadius: '4px' }}></div>
                  <div style={{ width: '60px', height: '18px', background: '#27272a', borderRadius: '4px' }}></div>
                </div>
                <div style={{ width: '220px', height: '14px', background: '#1c1c1f', borderRadius: '4px' }}></div>
                <div style={{ width: '100%', height: '36px', background: '#18181b', borderRadius: '6px' }}></div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              color: '#f87171',
              margin: '32px 0',
            }}
          >
            <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>Failed to load projects</h3>
            <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 16px' }}>
              {error?.message || 'Could not connect to the ShipStack API server.'}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => refetch()}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && projects.length === 0 && (
          <div
            style={{
              background: '#09090b',
              border: '1px dashed #27272a',
              borderRadius: '16px',
              padding: '64px 24px',
              textAlign: 'center',
              margin: '24px 0',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                background: 'rgba(0, 112, 243, 0.1)',
                border: '1px solid rgba(0, 112, 243, 0.25)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: '#0070f3',
              }}
            >
              <FolderGit2 size={30} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', margin: '0 0 8px' }}>
              No projects created yet
            </h2>
            <p style={{ fontSize: '14px', color: '#71717a', maxWidth: '440px', margin: '0 auto 24px', lineHeight: 1.5 }}>
              Import your Git repository, configure build commands and environment variables, and ship to cloud infrastructure in seconds.
            </p>
            <Link
              to="/new"
              className="btn-primary"
              style={{ display: 'inline-flex', padding: '10px 24px', fontSize: '14px', textDecoration: 'none' }}
            >
              <Plus size={16} />
              <span>New Project</span>
            </Link>
          </div>
        )}

        {/* Projects Grid */}
        {!isLoading && !isError && projects.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {filteredProjects.map((project) => {
              const latestDep = project.latestDeployment || (project.deployments && project.deployments[0]);
              const prodUrl = getProjectUrl(project);

              return (
                <div
                  key={project.id}
                  className="glass-card"
                  style={{
                    background: '#09090b',
                    border: '1px solid #1f1f23',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Top row: Project name & status badge */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                      <Link
                        to={`/projects/${project.id}`}
                        style={{
                          fontSize: '17px',
                          fontWeight: 600,
                          color: '#ffffff',
                          textDecoration: 'none',
                          wordBreak: 'break-word',
                        }}
                      >
                        {project.name}
                      </Link>
                      {renderStatusBadge(latestDep?.status)}
                    </div>

                    {/* Git Repo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#71717a', marginBottom: '16px' }}>
                      <GitBranch size={13} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {project.gitUrl.replace('https://github.com/', '')}
                      </span>
                    </div>
                  </div>

                  {/* Production URL & details */}
                  <div>
                    <div
                      style={{
                        background: '#030303',
                        border: '1px solid #18181b',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Globe size={13} color="#00dfd8" />
                        <a
                          href={prodUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '12px',
                            color: '#a1a1aa',
                            textDecoration: 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {project.customDomain || `${project.subDomain}.localhost:8000`}
                        </a>
                      </div>
                      <a
                        href={prodUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Visit production URL"
                        style={{ color: '#71717a', display: 'flex', alignItems: 'center' }}
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>

                    {/* Footer: Latest deployment time & view link */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#71717a', paddingTop: '10px', borderTop: '1px solid #18181b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        <span>Deployed {formatRelativeTime(latestDep?.createdAt || project.createdAt)}</span>
                      </span>

                      <Link
                        to={`/projects/${project.id}`}
                        style={{
                          color: '#0070f3',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        <span>Manage</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ConsoleLayout>
  );
}
