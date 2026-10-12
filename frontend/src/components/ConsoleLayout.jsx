import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layers,
  GitBranch,
  FileText,
  BarChart3,
  Gauge,
  Activity,
  ShieldAlert,
  Globe,
  KeyRound,
  FolderLock,
  Plus,
  Bot,
  Search,
  ChevronDown,
  MoreHorizontal,
  Home,
  Sliders,
  Database,
  Radio,
  ExternalLink,
  FolderGit2,
  Check,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useDeploy } from '../context/DeployContext';
import { useProjects } from '../services/queries';
import '../styles/console.css';

export default function ConsoleLayout({ title, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const { data: serverProjects } = useProjects();
  const {
    projects: contextProjects,
    activeProject,
    setActiveProject,
    openCreateProjectModal
  } = useDeploy();

  const projects = Array.isArray(serverProjects) && serverProjects.length > 0 ? serverProjects : contextProjects;

  // Extract route-based project ID from URL if on project-scoped route
  // e.g. /projects/:projectId, /projects/:projectId/deployments/:deploymentId, or /logs?projectId=...
  const projectPathMatch = location.pathname.match(/^\/projects\/([^/?#]+)/);
  const pathProjectId = projectPathMatch ? projectPathMatch[1] : null;
  const queryProjectId = new URLSearchParams(location.search).get('projectId');
  const routeProjectId = pathProjectId || queryProjectId;

  // Determine the active project for the current view:
  // 1. If currently inside a project route (/projects/:id or /logs?projectId=...), prioritize that project.
  // 2. Else if activeProject is set and valid, use that.
  // 3. Else if saved in localStorage, use that.
  // 4. Fallback to the first project in list.
  const currentProject = useMemo(() => {
    if (!Array.isArray(projects) || projects.length === 0) return null;
    if (routeProjectId) {
      const found = projects.find(p => p.id === routeProjectId);
      if (found) return found;
    }
    if (activeProject?.id) {
      const found = projects.find(p => p.id === activeProject.id);
      if (found) return found;
    }
    const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem('shipstack_active_project_id') : null;
    if (savedId) {
      const found = projects.find(p => p.id === savedId);
      if (found) return found;
    }
    return projects[0];
  }, [routeProjectId, projects, activeProject]);

  // Sync activeProject state whenever currentProject resolves or changes
  useEffect(() => {
    if (currentProject && activeProject?.id !== currentProject.id) {
      setActiveProject(currentProject);
    }
  }, [currentProject, activeProject, setActiveProject]);

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentProjectId = currentProject?.id || projects[0]?.id;

  const navItems = [
    { label: 'Projects', path: '/', icon: FolderGit2, badge: String(projects.length) },
    {
      label: 'Deployments',
      path: currentProjectId ? `/projects/${currentProjectId}?tab=deployments` : '/',
      icon: GitBranch
    },
    {
      label: 'Environment Variables',
      path: currentProjectId ? `/projects/${currentProjectId}?tab=env` : '/',
      icon: KeyRound
    },
    {
      label: 'Settings',
      path: currentProjectId ? `/projects/${currentProjectId}?tab=settings` : '/',
      icon: Sliders
    },
    { label: 'AI Diagnosis Studio', path: '/diagnosis', icon: Sparkles, badge: 'AI' },
    {
      label: 'Logs',
      path: currentProjectId ? `/logs?projectId=${currentProjectId}` : '/logs',
      icon: FileText
    },
  ];

  const filteredProjects = projects.filter(p =>
    !projectSearch || p.name?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const handleSelectProject = (project) => {
    setActiveProject(project);
    setIsProjectDropdownOpen(false);
    if (location.pathname.startsWith('/projects/')) {
      navigate(`/projects/${project.id}`);
    } else if (location.pathname.startsWith('/logs')) {
      navigate(`/logs?projectId=${project.id}`);
    } else if (location.pathname === '/') {
      navigate(`/projects/${project.id}`);
    }
  };

  const isProjectsPage = currentPath === '/projects';

  return (
    <div className="console-layout">
      {/* Console Sidebar */}
      <aside className="console-sidebar" aria-label="Console Navigation">
        {/* Workspace Account Switcher */}
        <div className="sidebar-header">
          <Link to="/projects" className="scope-selector" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="scope-left">
              <span className="scope-avatar"></span>
              <span>Divyanshu-Ranjan's projects</span>
              <span className="scope-badge">Hobby</span>
            </div>
            <ChevronDown size={14} color="#666666" />
          </Link>
        </div>

        {/* Quick Find Bar */}
        <div className="sidebar-search-box">
          <Search size={14} className="sidebar-search-icon" />
          <input
            type="text"
            placeholder="Search console..."
            onClick={() => navigate('/projects')}
            readOnly
          />
          <span className="sidebar-search-kbd">⌘K</span>
        </div>

        {/* Navigation Link List */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path || (item.path === '/overview' && currentPath === '/');

            return (
              <Link
                key={item.label}
                to={item.path}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <div className="sidebar-item-left">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`sidebar-item-badge ${item.badge === 'AI' ? 'badge-ai-pill' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Promo Banner from attached images */}
        <div className="sidebar-footer-promo">
          <h5>Free .app or .dev Domain with Pro</h5>
          <p>Pro includes a free first-year domain on .app, .dev, and other eligible TLDs.</p>
          <button type="button" onClick={openCreateProjectModal}>
            Deploy Project
          </button>
        </div>

        {/* User Account Footer */}
        <div className="sidebar-user-footer">
          <div className="sidebar-user-left">
            <span className="sidebar-user-avatar"></span>
            <span className="sidebar-user-name">divyanshuranjandynamic</span>
          </div>
          <MoreHorizontal size={14} color="#666666" />
        </div>
      </aside>

      {/* Main Container */}
      <div className="console-main-container">
        {/* Top bar with Breadcrumbs & Actions */}
        <header className="console-topbar">
          <div className="topbar-left" ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Project Switcher Dropdown Button */}
            <button
              type="button"
              className="project-select-btn"
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              title="Switch Active Project"
              style={{
                background: isProjectDropdownOpen ? '#1a1a1a' : undefined,
                cursor: 'pointer'
              }}
            >
              <span className="project-icon">
                {currentProject?.name?.[0]?.toUpperCase() || 'P'}
              </span>
              <span>{currentProject?.name || 'Select Project'}</span>
              <ChevronDown
                size={13}
                color="#888888"
                style={{
                  transform: isProjectDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease'
                }}
              />
            </button>

            {/* Interactive Project Switcher Dropdown */}
            {isProjectDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '42px',
                left: 0,
                width: '280px',
                background: '#0a0a0a',
                border: '1px solid #222222',
                borderRadius: '8px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
                zIndex: 100,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                {/* Search */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#141414',
                  border: '1px solid #262626',
                  borderRadius: '5px',
                  padding: '5px 8px'
                }}>
                  <Search size={12} color="#666" />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    placeholder="Filter projects..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                      outline: 'none',
                      width: '100%'
                    }}
                    autoFocus
                  />
                </div>

                {/* Project List */}
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {filteredProjects.map((p) => {
                    const isSelected = currentProject?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProject(p)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 8px',
                          borderRadius: '5px',
                          background: isSelected ? 'rgba(0,112,243,0.1)' : 'transparent',
                          border: 'none',
                          color: isSelected ? '#ffffff' : '#aaaaaa',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%'
                        }}
                      >
                        <div className="flex-center gap-2" style={{ overflow: 'hidden' }}>
                          <span style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            background: '#1c1c1c',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#fff'
                          }}>
                            {p.name?.[0]?.toUpperCase()}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                        </div>
                        <div className="flex-center gap-2">
                          <span className="pulse-dot" style={{
                            width: 5, height: 5,
                            background: p.status === 'READY' ? '#10b981' : p.status === 'BUILDING' ? '#00dfd8' : '#ef4444'
                          }}></span>
                          {isSelected && <Check size={13} color="#0070f3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown Footer Actions */}
                <div style={{
                  paddingTop: '6px',
                  borderTop: '1px solid #1c1c1c',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <Link
                    to="/projects"
                    onClick={() => setIsProjectDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      color: '#888',
                      fontSize: '11px',
                      textDecoration: 'none',
                      borderRadius: '4px'
                    }}
                  >
                    <span>View All Projects ({projects.length})</span>
                    <ArrowRight size={11} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProjectDropdownOpen(false);
                      openCreateProjectModal();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 8px',
                      background: 'rgba(0,112,243,0.1)',
                      border: '1px solid rgba(0,112,243,0.3)',
                      color: '#60a5fa',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      justifyContent: 'center',
                      fontWeight: 500
                    }}
                  >
                    <Plus size={12} />
                    <span>Create New Project</span>
                  </button>
                </div>
              </div>
            )}

            <span className="topbar-divider">/</span>
            <span className="topbar-title">{title}</span>
          </div>

          <div className="topbar-right">
            <Link to="/marketing" className="btn-topbar-agent" title="Return to Marketing Home">
              <Home size={14} />
              <span>Marketing Home</span>
            </Link>

            {/* Wired "+ Create New" button requested by USER */}
            <button
              type="button"
              className="btn-topbar-create"
              onClick={openCreateProjectModal}
              title="Create New Project"
            >
              <Plus size={14} />
              <span>Create New</span>
            </button>

            <Link to="/diagnosis" className="btn-topbar-agent" title="AI Diagnosis Studio">
              <Sparkles size={14} color="#c084fc" />
              <span>AI Studio</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="console-content">
          {children}
        </main>
      </div>
    </div>
  );
}
