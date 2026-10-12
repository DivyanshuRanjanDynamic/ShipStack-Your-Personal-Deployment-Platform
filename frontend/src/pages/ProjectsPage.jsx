import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  FolderGit2, 
  Plus, 
  Search, 
  Filter, 
  ExternalLink, 
  GitBranch, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Radio, 
  Globe, 
  Layers, 
  Trash2, 
  ArrowRight, 
  MoreHorizontal,
  Terminal,
  Sparkles,
  LayoutGrid,
  List,
  Check
} from 'lucide-react';
import { useDeploy } from '../context/DeployContext';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { 
    projects, 
    activeProject, 
    setActiveProject, 
    openCreateProjectModal,
    deleteProject 
  } = useDeploy();

  const [searchTerm, setSearchTerm] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Filter projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.subDomain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.gitUrl?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFramework = frameworkFilter === 'ALL' || 
      p.framework?.toLowerCase().includes(frameworkFilter.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || 
      p.status === statusFilter;

    return matchesSearch && matchesFramework && matchesStatus;
  });

  const totalDeployments = projects.reduce((acc, p) => acc + (p.deploymentsCount || 0), 0);
  const readyProjects = projects.filter(p => p.status === 'READY').length;

  const handleSelectProject = (project) => {
    setActiveProject(project);
  };

  const handleOpenConsole = (project) => {
    setActiveProject(project);
    navigate('/overview');
  };

  const handleDelete = (e, projectId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project? This will remove its deployment mappings.')) {
      deleteProject(projectId);
      setMenuOpenId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'READY':
        return (
          <span className="status-tag" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span className="pulse-dot" style={{ width: 5, height: 5, background: '#10b981', boxShadow: '0 0 6px #10b981' }}></span>
            <span>Ready</span>
          </span>
        );
      case 'BUILDING':
      case 'IN_PROGRESS':
        return (
          <span className="status-tag" style={{ background: 'rgba(0, 223, 216, 0.12)', color: '#00dfd8', border: '1px solid rgba(0, 223, 216, 0.3)' }}>
            <Loader2 size={10} className="spin-icon" />
            <span>Building</span>
          </span>
        );
      case 'FAILURE':
        return (
          <span className="status-tag" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <AlertTriangle size={10} />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="status-tag" style={{ background: '#1c1c1c', color: '#888' }}>
            <span>{status || 'Unknown'}</span>
          </span>
        );
    }
  };

  return (
    <ConsoleLayout title="Projects">
      <div className="projects-page-view" style={{ maxWidth: '1240px', margin: '0 auto' }}>

        {/* Page Header */}
        <div className="flex-center justify-between" style={{ marginBottom: '24px' }}>
          <div>
            <div className="flex-center gap-2">
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#ffffff' }}>Projects</h1>
              <span className="badge" style={{ fontSize: '11px', background: '#111', color: '#888' }}>
                {projects.length} Total
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#777', margin: '4px 0 0' }}>
              All cloud applications, microservices, and AI products in your workspace.
            </p>
          </div>

          <div className="flex-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={openCreateProjectModal}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              <Plus size={15} />
              <span>Create New Project</span>
            </button>
          </div>
        </div>

        {/* Workspace Metrics Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px',
          marginBottom: '24px'
        }}>
          <div className="glass-card" style={{ padding: '16px', background: '#070707', border: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Projects
            </span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>
              {projects.length}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', background: '#070707', border: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Deployments
            </span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#00dfd8', marginTop: '4px' }}>
              {totalDeployments}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', background: '#070707', border: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Healthy Endpoints
            </span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
              {readyProjects} / {projects.length}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', background: '#070707', border: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Project
            </span>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeProject?.name || 'None'}
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
          padding: '10px 14px',
          background: '#050505',
          border: '1px solid #181818',
          borderRadius: '8px'
        }}>
          {/* Search box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#0d0d0d',
            border: '1px solid #222',
            borderRadius: '6px',
            padding: '6px 12px',
            flex: 1,
            maxWidth: '380px'
          }}>
            <Search size={14} color="#666" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search projects by name, repo, or subdomain..."
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>

          {/* Framework and Status filter chips */}
          <div className="flex-center gap-2">
            <select
              value={frameworkFilter}
              onChange={e => setFrameworkFilter(e.target.value)}
              className="filter-select-box"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
            >
              <option value="ALL">All Frameworks</option>
              <option value="React">React</option>
              <option value="Next.js">Next.js</option>
              <option value="Vite">Vite</option>
              <option value="Python">Python</option>
              <option value="Go">Go / Serverless</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="filter-select-box"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="READY">Ready</option>
              <option value="BUILDING">Building</option>
              <option value="FAILURE">Failed</option>
            </select>

            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              background: '#0d0d0d',
              border: '1px solid #222',
              borderRadius: '6px',
              padding: '2px'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  background: viewMode === 'grid' ? '#222' : 'transparent',
                  border: 'none',
                  color: viewMode === 'grid' ? '#fff' : '#666',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  background: viewMode === 'table' ? '#222' : 'transparent',
                  border: 'none',
                  color: viewMode === 'table' ? '#fff' : '#666',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Table View"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ─── GRID VIEW ─── */}
        {viewMode === 'grid' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '16px',
            marginBottom: '40px'
          }}>
            {filteredProjects.map((p) => {
              const isActive = activeProject?.id === p.id;
              const subDomainUrl = `http://${p.subDomain}.localhost:8000`;
              const displayUrl = p.customDomain ? `https://${p.customDomain}` : subDomainUrl;

              return (
                <div
                  key={p.id}
                  className="glass-card"
                  style={{
                    background: '#080808',
                    border: `1px solid ${isActive ? '#0070f3' : '#1c1c1c'}`,
                    borderRadius: '10px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isActive ? '0 0 20px rgba(0,112,243,0.15)' : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div>
                    {/* Top Row: Avatar, Title, Framework, Status */}
                    <div className="flex-center justify-between" style={{ marginBottom: '12px' }}>
                      <div className="flex-center gap-3">
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #181818 0%, #242424 100%)',
                          border: '1px solid #333',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#ffffff'
                        }}>
                          {p.name?.[0]?.toUpperCase() || 'P'}
                        </div>
                        <div>
                          <div className="flex-center gap-2">
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                              {p.name}
                            </h3>
                            {isActive && (
                              <span style={{
                                fontSize: '10px',
                                background: 'rgba(0,112,243,0.2)',
                                color: '#60a5fa',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: '1px solid rgba(0,112,243,0.3)',
                                fontWeight: 500
                              }}>
                                Active
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: '#777' }}>
                            {p.framework || 'Web Application'}
                          </span>
                        </div>
                      </div>

                      {getStatusBadge(p.status)}
                    </div>

                    {/* Subdomain URL */}
                    <div style={{
                      padding: '8px 10px',
                      background: '#040404',
                      border: '1px solid #141414',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div className="flex-center gap-2" style={{ overflow: 'hidden' }}>
                        <Globe size={12} color="#00dfd8" />
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mono"
                          style={{
                            fontSize: '12px',
                            color: '#ccc',
                            textDecoration: 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {p.customDomain || `${p.subDomain}.localhost:8000`}
                        </a>
                      </div>
                      <a href={displayUrl} target="_blank" rel="noreferrer" style={{ color: '#888' }} title="Visit URL">
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    {/* Metadata: Git Repo & Deployments count */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                      <div className="flex-center gap-2" style={{ fontSize: '11px', color: '#777' }}>
                        <GitBranch size={12} color="#555" />
                        <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.gitUrl ? p.gitUrl.replace('https://github.com/', '') : 'repository'}
                        </span>
                      </div>
                      <div className="flex-center justify-between" style={{ fontSize: '11px', color: '#666' }}>
                        <span>
                          <strong>{p.deploymentsCount || 1}</strong> deployments recorded
                        </span>
                        <span>
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid #151515',
                    gap: '8px'
                  }}>
                    <div className="flex-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenConsole(p)}
                        className="btn-primary"
                        style={{ padding: '5px 12px', fontSize: '11px' }}
                      >
                        <Layers size={11} />
                        <span>Console</span>
                      </button>

                      <Link
                        to="/deployments"
                        onClick={() => handleSelectProject(p)}
                        className="btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '11px' }}
                      >
                        <GitBranch size={11} />
                        <span>Deploy</span>
                      </Link>

                      <Link
                        to="/logs"
                        onClick={() => handleSelectProject(p)}
                        className="btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '11px' }}
                      >
                        <Terminal size={11} />
                        <span>Logs</span>
                      </Link>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="btn-icon-sub"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === p.id ? null : p.id);
                        }}
                        style={{ padding: '4px 6px' }}
                      >
                        <MoreHorizontal size={14} color="#888" />
                      </button>

                      {menuOpenId === p.id && (
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          bottom: '30px',
                          background: '#111',
                          border: '1px solid #282828',
                          borderRadius: '6px',
                          padding: '4px',
                          minWidth: '150px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                          zIndex: 20
                        }}>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectProject(p);
                              setMenuOpenId(null);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              background: 'transparent',
                              border: 'none',
                              color: '#ccc',
                              fontSize: '11px',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Check size={12} color="#00dfd8" />
                            <span>Set as Active</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, p.id)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              background: 'transparent',
                              border: 'none',
                              color: '#f87171',
                              fontSize: '11px',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Trash2 size={12} color="#ef4444" />
                            <span>Delete Project</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── TABLE VIEW ─── */}
        {viewMode === 'table' && (
          <div style={{
            background: '#080808',
            border: '1px solid #1c1c1c',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '40px'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr 1fr',
              padding: '12px 18px',
              background: '#040404',
              borderBottom: '1px solid #1a1a1a',
              fontSize: '11px',
              color: '#777',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <span>Project</span>
              <span>Status</span>
              <span>Subdomain / URL</span>
              <span>Framework</span>
              <span>Deployments</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>

            {filteredProjects.map((p) => {
              const isActive = activeProject?.id === p.id;
              const subDomainUrl = `http://${p.subDomain}.localhost:8000`;

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr 1fr',
                    padding: '14px 18px',
                    borderBottom: '1px solid #141414',
                    alignItems: 'center',
                    background: isActive ? 'rgba(0,112,243,0.03)' : 'transparent',
                    fontSize: '13px'
                  }}
                >
                  <div className="flex-center gap-2">
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: '#181818',
                      border: '1px solid #282828',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      {p.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '13px' }}>{p.name}</strong>
                      {isActive && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', color: '#60a5fa' }}>● Active</span>
                      )}
                    </div>
                  </div>

                  <div>{getStatusBadge(p.status)}</div>

                  <div className="mono" style={{ fontSize: '12px', color: '#00dfd8' }}>
                    <a href={subDomainUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                      {p.subDomain}.localhost:8000
                    </a>
                  </div>

                  <div style={{ color: '#aaa', fontSize: '12px' }}>{p.framework || 'React'}</div>

                  <div style={{ color: '#aaa', fontSize: '12px' }}>{p.deploymentsCount || 1} builds</div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenConsole(p)}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      Console
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, p.id)}
                      className="btn-icon-sub"
                      title="Delete"
                      style={{ padding: '4px' }}
                    >
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {filteredProjects.length === 0 && (
          <div className="glass-card text-center" style={{ padding: '60px 20px', background: '#080808', border: '1px solid #1a1a1a', marginBottom: '40px' }}>
            <FolderGit2 size={36} color="#444" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px' }}>No projects match your filter</h3>
            <p style={{ fontSize: '13px', color: '#777', margin: '0 0 16px' }}>
              Try adjusting your search criteria or register a new project.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={openCreateProjectModal}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              <Plus size={14} />
              <span>Create New Project</span>
            </button>
          </div>
        )}

        {/* Quick Start Templates Section */}
        <div style={{
          padding: '24px',
          background: '#060606',
          border: '1px solid #181818',
          borderRadius: '10px'
        }}>
          <div className="flex-center justify-between" style={{ marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                Deploy from a Curated Framework Template
              </h3>
              <p style={{ fontSize: '12px', color: '#777', margin: '2px 0 0' }}>
                Instant setup with pre-configured CI/CD build scripts and container manifests.
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px'
          }}>
            {[
              { title: 'Next.js 14 Portal', desc: 'App router with SSR & server components', badge: 'Next.js', icon: '▲' },
              { title: 'Vite React Starter', desc: 'Lightweight client bundle with Tailwind', badge: 'Vite', icon: '⚡' },
              { title: 'AI Diagnosis Agent', desc: 'FastAPI microservice with Kafka consumer', badge: 'Python', icon: '🐍' },
              { title: 'Reverse Proxy Gateway', desc: 'High throughput S3 wildcard router', badge: 'Go', icon: '🌐' }
            ].map(tmpl => (
              <div
                key={tmpl.title}
                className="glass-card"
                style={{
                  padding: '14px',
                  background: '#090909',
                  border: '1px solid #1d1d1d',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div className="flex-center justify-between" style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{tmpl.icon}</span>
                    <span style={{ fontSize: '10px', background: '#1c1c1c', color: '#aaa', padding: '1px 6px', borderRadius: '4px' }}>
                      {tmpl.badge}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>{tmpl.title}</h4>
                  <p style={{ fontSize: '11px', color: '#777', margin: 0, lineHeight: 1.4 }}>{tmpl.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={openCreateProjectModal}
                  className="btn-secondary"
                  style={{ marginTop: '12px', padding: '5px 10px', fontSize: '11px', justifyContent: 'center' }}
                >
                  <span>Use Template</span>
                  <ArrowRight size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
