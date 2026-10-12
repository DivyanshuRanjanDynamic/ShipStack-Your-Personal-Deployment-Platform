import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  FolderPlus,
  GitBranch,
  Globe,
  Cpu,
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Terminal,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useDeploy } from '../context/DeployContext';

const FRAMEWORKS = [
  { id: 'React', name: 'React', buildCmd: 'npm run build', outDir: 'dist', icon: '⚛️' },
  { id: 'Next.js', name: 'Next.js', buildCmd: 'npm run build', outDir: '.next', icon: '▲' },
  { id: 'Vite', name: 'Vite', buildCmd: 'npm run build', outDir: 'dist', icon: '⚡' },
  { id: 'Vue', name: 'Vue.js', buildCmd: 'npm run build', outDir: 'dist', icon: '🟢' },
  { id: 'FastAPI / Python', name: 'Python / FastAPI', buildCmd: 'pip install -r requirements.txt', outDir: 'app', icon: '🐍' },
  { id: 'Node.js', name: 'Node.js', buildCmd: 'npm install', outDir: 'dist', icon: '🟩' },
];

const PRESETS = [
  { name: 'Vite Starter', url: 'https://github.com/divyanshuranjandynamic/vite-starter', framework: 'Vite' },
  { name: 'Next.js App', url: 'https://github.com/divyanshuranjandynamic/nextjs-portal', framework: 'Next.js' },
  { name: 'ShipStack AI Agent', url: 'https://github.com/divyanshuranjandynamic/shipstack-ai-engine', framework: 'FastAPI / Python' },
];

export default function CreateProjectModal() {
  const navigate = useNavigate();
  const {
    isCreateProjectModalOpen,
    closeCreateProjectModal,
    createNewProject,
    apiBaseUrl
  } = useDeploy();

  const [gitUrl, setGitUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [framework, setFramework] = useState('React');
  const [rootDir, setRootDir] = useState('./');
  const [buildCmd, setBuildCmd] = useState('npm run build');
  const [outDir, setOutDir] = useState('dist');
  const [deployNow, setDeployNow] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill project name from Git URL
  useEffect(() => {
    if (gitUrl) {
      try {
        const parts = gitUrl.trim().replace(/\/$/, '').split('/');
        const repo = parts[parts.length - 1]?.replace('.git', '');
        if (repo && !projectName) {
          setProjectName(repo);
        }
      } catch { }
    }
  }, [gitUrl]);

  // Update build cmd when framework changes
  const handleSelectFramework = (fw) => {
    setFramework(fw.id);
    setBuildCmd(fw.buildCmd);
    setOutDir(fw.outDir);
  };

  const handleApplyPreset = (preset) => {
    setGitUrl(preset.url);
    const parts = preset.url.split('/');
    const repo = parts[parts.length - 1];
    setProjectName(repo);
    const fw = FRAMEWORKS.find(f => f.id === preset.framework) || FRAMEWORKS[0];
    handleSelectFramework(fw);
  };

  const handleClose = () => {
    setError('');
    setIsSubmitting(false);
    closeCreateProjectModal();
  };

  if (!isCreateProjectModalOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!projectName.trim()) {
      setError('Please provide a project name.');
      return;
    }
    if (!gitUrl.trim()) {
      setError('Please enter a valid Git repository URL.');
      return;
    }

    try {
      const urlObj = new URL(gitUrl.trim());
      if (!urlObj.hostname.includes('github.com')) {
        setError('Invalid Git URL. Please provide a valid GitHub repository URL.');
        return;
      }
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length < 2) {
        setError('GitHub URL must include username/organization and repository name.');
        return;
      }
    } catch {
      setError('Invalid Git URL format. Use https://github.com/user/repo');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const created = await createNewProject({
        name: projectName.trim(),
        gitUrl: gitUrl.trim(),
        framework,
        rootDir: rootDir.trim() || './',
        buildCmd: buildCmd.trim() || 'npm run build',
        outDir: outDir.trim() || 'dist',
        deployNow,
      });

      handleClose();

      // If user chose to deploy now, go to deployments or overview
      if (deployNow) {
        navigate('/deployments');
      } else {
        navigate('/projects');
      }
    } catch (err) {
      setError(err.message || 'Failed to register project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewSubdomain = projectName
    ? projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    : 'your-project';

  return (
    <div className="modal-backdrop animate-fade-in" onClick={handleClose}>
      <div
        className="modal-content glass-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '640px', padding: '28px' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="flex-center gap-3">
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(0,112,243,0.2) 0%, rgba(168,85,247,0.2) 100%)',
              border: '1px solid rgba(0,112,243,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FolderPlus size={18} color="#00dfd8" />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '17px', margin: 0 }}>Create New Project</h3>
              <p style={{ fontSize: '12px', color: '#888', margin: '2px 0 0' }}>
                Register a Git repository and configure its deployment pipeline.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="deploy-error-banner" style={{ marginBottom: '16px' }}>
            <AlertCircle size={14} color="#ef4444" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Git URL */}
          <div className="form-group">
            <div className="flex-center justify-between" style={{ marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Git Repository URL</label>
              <div className="flex-center gap-1">
                <span style={{ fontSize: '11px', color: '#666' }}>Templates:</span>
                {PRESETS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      background: '#141414',
                      border: '1px solid #282828',
                      borderRadius: '4px',
                      color: '#aaa',
                      fontSize: '10px',
                      padding: '2px 6px',
                      cursor: 'pointer'
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="input-with-icon">
              <GitBranch size={16} className="input-icon" />
              <input
                type="url"
                value={gitUrl}
                onChange={e => setGitUrl(e.target.value)}
                placeholder="https://github.com/username/project-repo"
                className="modal-input"
                required
                style={{ paddingLeft: '36px' }}
              />
            </div>
            <span className="input-hint" style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'block' }}>
              Must be a public Git URL (e.g., GitHub, GitLab) supported by ShipStack Fargate container runner.
            </span>
          </div>

          {/* Project Name & Subdomain Preview */}
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. my-awesome-app"
              className="modal-input"
              required
            />
            <div className="flex-center gap-1" style={{ marginTop: '6px', fontSize: '11px', color: '#888' }}>
              <Globe size={12} color="#00dfd8" />
              <span>Assigned Wildcard Subdomain:</span>
              <strong className="mono" style={{ color: '#00dfd8' }}>
                https://{previewSubdomain}.localhost:8000
              </strong>
            </div>
          </div>

          {/* Framework Presets */}
          <div className="form-group">
            <label className="form-label">Framework Preset</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px'
            }}>
              {FRAMEWORKS.map(fw => {
                const isSelected = framework === fw.id;
                return (
                  <button
                    key={fw.id}
                    type="button"
                    onClick={() => handleSelectFramework(fw)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: isSelected ? 'rgba(0,112,243,0.12)' : '#0d0d0d',
                      border: `1px solid ${isSelected ? '#0070f3' : '#222'}`,
                      color: isSelected ? '#ffffff' : '#888888',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: isSelected ? 600 : 400,
                      textAlign: 'left'
                    }}
                  >
                    <span>{fw.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fw.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Build Settings Accordion */}
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Build and Output Settings</span>
            </button>

            {showAdvanced && (
              <div style={{
                marginTop: '10px',
                padding: '14px',
                background: '#070707',
                border: '1px solid #1a1a1a',
                borderRadius: '6px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                    Build Command
                  </label>
                  <input
                    type="text"
                    value={buildCmd}
                    onChange={e => setBuildCmd(e.target.value)}
                    className="modal-input mono"
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                    Output Directory
                  </label>
                  <input
                    type="text"
                    value={outDir}
                    onChange={e => setOutDir(e.target.value)}
                    className="modal-input mono"
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                    Root Directory
                  </label>
                  <input
                    type="text"
                    value={rootDir}
                    onChange={e => setRootDir(e.target.value)}
                    className="modal-input mono"
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Immediate Deployment Checkbox */}
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            background: 'rgba(0,223,216,0.04)',
            border: '1px solid rgba(0,223,216,0.15)',
            borderRadius: '6px'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px',
              color: '#ffffff',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={deployNow}
                onChange={e => setDeployNow(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#00dfd8' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>Deploy immediately to ECS Fargate container</span>
                <span style={{ fontSize: '11px', color: '#888' }}>
                  Automatically triggers POST /deploy and spins up container log ingestion via Kafka.
                </span>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex-center justify-between" style={{ paddingTop: '8px', borderTop: '1px solid #1a1a1a' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ padding: '8px 20px', fontSize: '13px' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="spin-icon" />
                  <span>Registering Project...</span>
                </>
              ) : (
                <>
                  <FolderPlus size={14} />
                  <span>{deployNow ? 'Create & Deploy Project' : 'Create Project'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
