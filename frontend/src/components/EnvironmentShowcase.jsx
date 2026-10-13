import React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  Terminal,
  Server,
  GitBranch,
  ArrowLeftRight,
  Box,
  HardDrive,
  Variable,
  Users,
  Bell,
  KeyRound,
  Tag,
  Settings,
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  Plus,
  Shield,
  ChevronsUpDown,
  ChevronRight,
  Database,
  AppWindow,
  Layers,
} from 'lucide-react';

const RESOURCES = [
  { name: 'Storefront Crash Loop', type: 'Application', status: 'Restarting', domain: '—', server: 'edge-1', icon: 'app' },
  { name: 'Docker Compose API', type: 'Application', status: 'Exited', domain: '—', server: 'edge-1', icon: 'app' },
  { name: 'Dockerfile Worker', type: 'Application', status: 'Exited', domain: 'worker.shipstack.run', server: 'edge-1', icon: 'app' },
  { name: 'GitHub Deploy Key App', type: 'Application', status: 'Exited', domain: 'github-deploy.shipstack.run', server: 'edge-1', icon: 'app' },
  { name: 'GitLab Deploy Key App', type: 'Application', status: 'Exited', domain: 'gitlab-deploy.shipstack.run', server: 'edge-1', icon: 'app' },
  { name: 'Public Preview App', type: 'Application', status: 'Exited', domain: 'preview.shipstack.run', server: 'edge-1', icon: 'app' },
  { name: 'Local PostgreSQL', type: 'Database', status: 'Running', domain: '—', server: 'edge-1', icon: 'db', sub: 'Local PostgresDB for testing' },
  { name: 'Node.js Fastify API', type: 'Application', status: 'Exited', domain: 'api.shipstack.run', server: 'edge-1', icon: 'app' },
  { name: 'Edge Dockerfile App', type: 'Application', status: 'Running', domain: 'edge.shipstack.run', server: 'edge-1', icon: 'app' },
];

function StatusPill({ status }) {
  const kind = status === 'Running' ? 'running' : status === 'Restarting' ? 'restarting' : 'exited';
  return (
    <span className={`env-status env-status--${kind}`}>
      <i />
      {status}
    </span>
  );
}

function NavItem({ icon: Icon, label, active = false }) {
  return (
    <div className={`env-nav-item${active ? ' is-active' : ''}`}>
      <Icon size={14} strokeWidth={1.75} />
      <span>{label}</span>
    </div>
  );
}

export default function EnvironmentShowcase() {
  return (
    <section className="env-showcase-section" aria-label="ShipStack environment deployments">
      <div className="env-showcase-inner">
        <img
          src="https://coolify.io/images/screenshots/environment.webp"
          alt="Coolify environment view listing applications and databases with their status, domain and server"
          width="2880"
          height="1800"
          fetchPriority="high"
          className="w-full rounded-lg sp-e1 env-fallback-img"
          hidden
        />

        <div className="env-scale-frame">
          <div className="w-full rounded-lg sp-e1" role="img" aria-label="ShipStack production environment listing applications and databases with their status, domain and server">
            <div className="env-app">
              <aside className="env-sidebar">
                <div className="env-brand">
                  <Layers size={16} color="#fff" />
                  <div>
                    <strong>ShipStack</strong>
                  </div>
                </div>

                <div className="env-search">
                  <Search size={12} />
                  <span>Search</span>
                  <kbd>Ctrl K</kbd>
                </div>

                <p className="env-nav-label">Workspace</p>
                <NavItem icon={LayoutDashboard} label="Dashboard" />
                <NavItem icon={FolderKanban} label="Projects" active />
                <NavItem icon={BarChart3} label="Analytics" />
                <NavItem icon={Terminal} label="Terminal" />

                <p className="env-nav-label">Infrastructure</p>
                <NavItem icon={Server} label="Servers" />
                <NavItem icon={GitBranch} label="Sources" />
                <NavItem icon={ArrowLeftRight} label="Destinations" />
                <NavItem icon={Box} label="Registries" />
                <NavItem icon={HardDrive} label="S3 Storage" />
                <NavItem icon={Variable} label="Shared Variables" />

                <p className="env-nav-label">Manage</p>
                <NavItem icon={Users} label="Team" />
                <NavItem icon={Bell} label="Notifications" />
                <NavItem icon={KeyRound} label="Keys & Tokens" />
                <NavItem icon={Tag} label="Tags" />
                <NavItem icon={Settings} label="Settings" />

                <div className="env-sidebar-foot">
                  <div className="env-admin">
                    <span className="env-admin-dot" />
                    Admin
                  </div>
                  <div className="env-user">
                    <span className="env-user-avatar">R</span>
                    <span>Root User</span>
                    <ChevronsUpDown size={12} />
                  </div>
                </div>
              </aside>

              <div className="env-main">
                <div className="env-crumb">
                  <span>Root Team</span>
                  <ChevronRight size={12} />
                  <span>My first project</span>
                  <ChevronRight size={12} />
                  <span>production</span>
                </div>

                <div className="env-toolbar">
                  <div>
                    <h2>production</h2>
                    <p>9 resources in My first project</p>
                  </div>
                  <div className="env-toolbar-actions">
                    <button type="button" className="env-btn env-btn-neutral">
                      <Variable size={13} />
                      Shared Variables
                    </button>
                    <button type="button" className="env-btn env-btn-neutral">
                      <Settings size={13} />
                      Settings
                    </button>
                    <Link to="/new" className="env-btn env-btn-primary">
                      <Plus size={13} />
                      New Resource
                    </Link>
                  </div>
                </div>

                <div className="env-table-card">
                  <div className="env-table-controls">
                    <div className="env-resource-search">
                      <Search size={13} />
                      <span>Search resources</span>
                    </div>
                    <div className="env-table-controls-right">
                      <button type="button" className="env-btn env-btn-neutral env-btn-sm">
                        <Filter size={12} />
                        Filter
                      </button>
                      <button type="button" className="env-btn env-btn-neutral env-btn-sm">
                        <ArrowUpDown size={12} />
                        Sort
                      </button>
                      <button type="button" className="env-btn env-btn-icon env-btn-accent" aria-label="Grid view">
                        <LayoutGrid size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="env-table-wrap">
                    <table className="env-table">
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Domain</th>
                          <th>Server</th>
                          <th>Tags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {RESOURCES.map((row) => (
                          <tr key={row.name}>
                            <td>
                              <div className="env-resource">
                                <span className="env-resource-icon">
                                  {row.icon === 'db' ? <Database size={14} /> : <AppWindow size={14} />}
                                </span>
                                <div>
                                  <strong>{row.name}</strong>
                                  {row.sub ? <em>{row.sub}</em> : null}
                                </div>
                              </div>
                            </td>
                            <td>{row.type}</td>
                            <td><StatusPill status={row.status} /></td>
                            <td className="env-domain">{row.domain}</td>
                            <td>{row.server}</td>
                            <td>—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="env-table-foot">
                    <span>1-9 of 9</span>
                    <ChevronsUpDown size={11} />
                    <span>10</span>
                    <span className="env-table-pager">
                      <button type="button" aria-label="Previous page">‹</button>
                      <button type="button" aria-label="Next page">›</button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="env-showcase-caption">
          Deployments on ShipStack. Every application, database and service of an environment in one list, with status, domain and server.
        </p>
      </div>
    </section>
  );
}
