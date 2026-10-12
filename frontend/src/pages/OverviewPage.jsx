import React from 'react';
import { Link } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  GitBranch, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Activity, 
  Terminal, 
  Cpu, 
  Radio, 
  Sparkles,
  Layers,
  Globe,
  Database,
  Plus,
  FolderGit2
} from 'lucide-react';
import { useDeploy } from '../context/DeployContext';

export default function OverviewPage({ onOpenDeploy }) {
  const { activeProject, openCreateProjectModal } = useDeploy();

  const project = activeProject || {
    name: 'machhub',
    subDomain: 'machhub-prod',
    customDomain: 'www.mechhub.in',
    framework: 'React',
    branch: 'main',
    commit: 'b850295',
    status: 'READY'
  };

  const previewUrl = project.customDomain 
    ? `https://${project.customDomain}` 
    : `http://${project.subDomain}.localhost:8000`;

  return (
    <ConsoleLayout title="Overview">
      <div className="overview-page-view">
        
        {/* Production Deployment Card */}
        <div className="glass-card mb-6" style={{ background: '#080808', border: '1px solid #1f1f1f', padding: '24px' }}>
          <div className="flex-center justify-between mb-4">
            <div>
              <div className="flex-center gap-2">
                <span className="mono text-dim" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                  Active Project · Production Deployment
                </span>
                <Link to="/projects" className="btn-secondary" style={{ padding: '2px 8px', fontSize: '10px' }}>
                  <FolderGit2 size={10} />
                  <span>Switch Project</span>
                </Link>
              </div>
              <h2 style={{ fontSize: '20px', color: '#ffffff', margin: '6px 0 2px' }}>
                {project.name}
              </h2>
            </div>
            <div className="flex-center gap-2">
              <span className="status-tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                ● {project.status || 'Ready'}
              </span>
              <a 
                href={previewUrl} 
                target="_blank" 
                rel="noreferrer"
                className="btn-primary" 
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                <span>Visit</span>
                <ExternalLink size={13} />
              </a>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenDeploy ? onOpenDeploy() : openCreateProjectModal()}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <Plus size={13} />
                <span>Deploy</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', background: '#030303', padding: '16px', borderRadius: '8px', border: '1px solid #141414' }}>
            <div>
              <span className="text-dim" style={{ fontSize: '11px', display: 'block' }}>Domains / Subdomain</span>
              <span className="mono" style={{ fontSize: '13px', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>
                {project.customDomain || `${project.subDomain}.localhost:8000`}
              </span>
            </div>
            <div>
              <span className="text-dim" style={{ fontSize: '11px', display: 'block' }}>Branch & Commit</span>
              <span className="mono" style={{ fontSize: '13px', color: '#ffffff' }}>
                {project.branch || 'main'} ({project.commit || 'head'})
              </span>
            </div>
            <div>
              <span className="text-dim" style={{ fontSize: '11px', display: 'block' }}>Engine</span>
              <span className="mono" style={{ fontSize: '13px', color: '#ffffff' }}>
                {project.framework || 'React'} (AWS ECS Fargate)
              </span>
            </div>
            <div>
              <span className="text-dim" style={{ fontSize: '11px', display: 'block' }}>Build Cluster</span>
              <span style={{ fontSize: '13px', color: '#ffffff' }}>
                Kafka Logs + ClickHouse
              </span>
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards into Attached Pages */}
        <h3 style={{ fontSize: '15px', color: '#ffffff', marginBottom: '14px', fontWeight: 600 }}>Project Navigation & Console</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          
          <Link to="/projects" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '18px', background: '#060606', border: '1px solid #1a1a1a' }}>
            <div className="flex-center justify-between mb-2">
              <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>All Projects</span>
              <FolderGit2 size={16} color="#00dfd8" />
            </div>
            <p style={{ fontSize: '12px', color: '#888888', margin: 0, lineHeight: 1.5 }}>
              List all created projects, framework repositories, custom domains, and endpoints.
            </p>
          </Link>

          <Link to="/deployments" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '18px', background: '#060606', border: '1px solid #1a1a1a' }}>
            <div className="flex-center justify-between mb-2">
              <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>Deployments</span>
              <GitBranch size={16} color="#3b82f6" />
            </div>
            <p style={{ fontSize: '12px', color: '#888888', margin: 0, lineHeight: 1.5 }}>
              View git commit builds, preview URLs, deployment statuses, and logs for {project.name}.
            </p>
          </Link>

          <Link to="/logs" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '18px', background: '#060606', border: '1px solid #1a1a1a' }}>
            <div className="flex-center justify-between mb-2">
              <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>Logs & Streams</span>
              <Terminal size={16} color="#00dfd8" />
            </div>
            <p style={{ fontSize: '12px', color: '#888888', margin: 0, lineHeight: 1.5 }}>
              Real-time Apache Kafka log ingestion and ClickHouse OLAP queries.
            </p>
          </Link>

          <Link to="/diagnosis" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '18px', background: '#060606', border: '1px solid #1a1a1a' }}>
            <div className="flex-center justify-between mb-2">
              <span style={{ fontWeight: 600, color: '#c084fc', fontSize: '14px' }}>AI Diagnosis Studio</span>
              <Sparkles size={16} color="#c084fc" />
            </div>
            <p style={{ fontSize: '12px', color: '#888888', margin: 0, lineHeight: 1.5 }}>
              RAG self-healing engine, build failure triage, and 1-click patches.
            </p>
          </Link>

          <Link to="/analytics" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '18px', background: '#060606', border: '1px solid #1a1a1a' }}>
            <div className="flex-center justify-between mb-2">
              <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>Analytics</span>
              <Activity size={16} color="#a855f7" />
            </div>
            <p style={{ fontSize: '12px', color: '#888888', margin: 0, lineHeight: 1.5 }}>
              Visitors, page views, countries, devices, and traffic referrers.
            </p>
          </Link>

          <Link to="/env" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '18px', background: '#060606', border: '1px solid #1a1a1a' }}>
            <div className="flex-center justify-between mb-2">
              <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>Environment Variables</span>
              <Database size={16} color="#10b981" />
            </div>
            <p style={{ fontSize: '12px', color: '#888888', margin: 0, lineHeight: 1.5 }}>
              Manage encrypted API tokens, Firebase configs, and AWS credentials.
            </p>
          </Link>

        </div>

      </div>
    </ConsoleLayout>
  );
}
