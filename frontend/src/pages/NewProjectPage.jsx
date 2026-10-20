import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  FolderPlus, 
  GitBranch, 
  Globe, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  FileText, 
  Loader2, 
  AlertCircle, 
  ArrowLeft,
  CheckCircle2,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { createProject, triggerDeploy } from '../services/api';

// Node majors available in the build image (keep in sync with the build-server Dockerfile).
const NODE_VERSIONS = ['16', '18', '20', '22'];

const FRAMEWORKS = [
  { id: 'React', name: 'React (Vite)', installCmd: 'npm install', buildCmd: 'npm run build', outDir: 'dist' },
  { id: 'Next.js', name: 'Next.js', installCmd: 'npm install', buildCmd: 'npm run build', outDir: '.next' },
  { id: 'Vue', name: 'Vue.js', installCmd: 'npm install', buildCmd: 'npm run build', outDir: 'dist' },
  { id: 'FastAPI', name: 'Python / FastAPI', installCmd: 'pip install -r requirements.txt', buildCmd: 'python -m build', outDir: 'app' },
  { id: 'Other', name: 'Other / Custom', installCmd: 'npm install', buildCmd: 'npm run build', outDir: 'dist' },
];

export default function NewProjectPage() {
  const navigate = useNavigate();

  // Basic Form
  const [gitUrl, setGitUrl] = useState('');
  const [projectName, setProjectName] = useState('');

  // Build Settings — all optional overrides; blank means auto-detect on the server.
  const [framework, setFramework] = useState('React');
  const [rootDir, setRootDir] = useState('');
  const [installCmd, setInstallCmd] = useState('');
  const [buildCmd, setBuildCmd] = useState('');
  const [outDir, setOutDir] = useState('');
  const [nodeVersion, setNodeVersion] = useState('');
  const [showBuildSettings, setShowBuildSettings] = useState(false);

  // Environment Variables
  const [envVars, setEnvVars] = useState([{ key: '', value: '' }]);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkEnvText, setBulkEnvText] = useState('');

  // Status & Validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill project name from Git repo URL
  useEffect(() => {
    if (gitUrl) {
      try {
        const parts = gitUrl.trim().replace(/\/$/, '').split('/');
        const repo = parts[parts.length - 1]?.replace('.git', '');
        if (repo && !projectName) {
          setProjectName(repo);
        }
      } catch {}
    }
  }, [gitUrl]);

  // Handle framework selection
  // Framework is a UI hint only; the server auto-detects it. Selecting one no longer forces
  // install/build/output overrides (that would defeat auto-detection, e.g. Next.js "out" vs ".next").
  const handleFrameworkChange = (fwId) => {
    setFramework(fwId);
  };

  // Add / Remove Env Row
  const handleAddEnvRow = () => {
    setEnvVars((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveEnvRow = (index) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index, field, val) => {
    setEnvVars((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const toggleReveal = (index) => {
    setRevealedKeys((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Parse bulk .env text
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
    }
    setBulkEnvText('');
    setShowBulkPaste(false);
  };

  // Submit Handler: Creates Project AND triggers first deployment
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    const trimmedGit = gitUrl.trim();
    const trimmedName = projectName.trim();

    if (!trimmedGit) {
      setError('Please provide a Git repository URL.');
      return;
    }
    try {
      const parsed = new URL(trimmedGit);
      if (!parsed.hostname.includes('github.com')) {
        setError('Only GitHub repository URLs are currently supported.');
        return;
      }
    } catch {
      setError('Invalid URL format. Example: https://github.com/user/repo');
      return;
    }

    if (!trimmedName) {
      setError('Project name is required.');
      return;
    }

    // Validate Env Vars: keys must be uppercase alphanumeric/underscore, no spaces, unique
    const cleanEnvs = envVars.filter((e) => e.key.trim() || e.value.trim());
    const seenKeys = new Set();
    for (const env of cleanEnvs) {
      const k = env.key.trim();
      if (!k) {
        setError('Environment variable key cannot be blank.');
        return;
      }
      if (/\s/.test(k)) {
        setError(`Environment variable key "${k}" contains spaces.`);
        return;
      }
      if (seenKeys.has(k)) {
        setError(`Duplicate environment variable key: "${k}".`);
        return;
      }
      seenKeys.add(k);
    }

    setIsSubmitting(true);

    try {
      // 1. Create Project. Only send overrides the user actually set; blanks mean auto-detect.
      const buildSettings = {};
      if (rootDir.trim()) buildSettings.rootDirectory = rootDir.trim();
      if (installCmd.trim()) buildSettings.installCommand = installCmd.trim();
      if (buildCmd.trim()) buildSettings.buildCommand = buildCmd.trim();
      if (outDir.trim()) buildSettings.outputDirectory = outDir.trim();
      if (nodeVersion) buildSettings.nodeVersion = nodeVersion;

      const projectPayload = {
        gitURL: trimmedGit,
        name: trimmedName,
        buildSettings,
        envVars: cleanEnvs.map((e) => ({ key: e.key.trim(), value: e.value })),
      };

      const projectRes = await createProject(projectPayload);
      const createdProject = projectRes.data.project;
      const projectId = createdProject.id;

      // 2. Trigger First Deployment in the same flow
      const deployRes = await triggerDeploy(projectId);
      const deploymentId = deployRes.data.deploymentID;

      // 3. Redirect to the newly created deployment page
      navigate(`/projects/${projectId}/deployments/${deploymentId}`);
    } catch (err) {
      setError(err.message || 'Failed to create project and initiate deployment.');
      setIsSubmitting(false);
    }
  };

  return (
    <ConsoleLayout title="New Project">
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '0 12px 64px' }}>
        {/* Breadcrumb / Back Link */}
        <Link
          to="/projects"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: '#71717a',
            textDecoration: 'none',
            marginBottom: '20px',
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Projects</span>
        </Link>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 6px', color: '#ffffff', letterSpacing: '-0.5px' }}>
            Create a New Project
          </h1>
          <p style={{ fontSize: '14px', color: '#71717a', margin: 0 }}>
            Configure your Git repository, build specifications, and environment variables.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#f87171',
              fontSize: '13px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Card 1: Repository & Project Name */}
          <div
            style={{
              background: '#09090b',
              border: '1px solid #1f1f23',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '20px',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 16px' }}>
              Project Information
            </h2>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                Git Repository URL *
              </label>
              <input
                type="url"
                required
                placeholder="https://github.com/username/repository"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                style={{
                  width: '100%',
                  background: '#030303',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '11px', color: '#71717a', marginTop: '4px', display: 'block' }}>
                GitHub public or private repository URL.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d4d4d8', marginBottom: '6px' }}>
                Project Name *
              </label>
              <input
                type="text"
                required
                placeholder="my-cool-app"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                style={{
                  width: '100%',
                  background: '#030303',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Card 2: Build Settings */}
          <div
            style={{
              background: '#09090b',
              border: '1px solid #1f1f23',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => setShowBuildSettings(!showBuildSettings)}
            >
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 2px' }}>
                  Build & Output Settings
                </h2>
                <p style={{ fontSize: '12px', color: '#71717a', margin: 0 }}>
                  Framework preset: <strong style={{ color: '#00dfd8' }}>{framework}</strong> (Output: {outDir})
                </p>
              </div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>
                {showBuildSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {showBuildSettings && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #18181b' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#d4d4d8', marginBottom: '6px' }}>
                    Framework Preset
                  </label>
                  <select
                    value={framework}
                    onChange={(e) => handleFrameworkChange(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#030303',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  >
                    {FRAMEWORKS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <p style={{ fontSize: '12px', color: '#71717a', margin: '0 0 16px' }}>
                  All fields below are optional. Leave blank to let ShipStack auto-detect.
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#d4d4d8', marginBottom: '6px' }}>
                    Node Version
                  </label>
                  <select
                    value={nodeVersion}
                    onChange={(e) => setNodeVersion(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#030303',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  >
                    <option value="">Auto-detect</option>
                    {NODE_VERSIONS.map((v) => (
                      <option key={v} value={v}>Node {v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#d4d4d8', marginBottom: '6px' }}>
                      Root Directory
                    </label>
                    <input
                      type="text"
                      value={rootDir}
                      onChange={(e) => setRootDir(e.target.value)}
                      placeholder="Auto-detect (e.g. frontend)"
                      style={{
                        width: '100%',
                        background: '#030303',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#d4d4d8', marginBottom: '6px' }}>
                      Output Directory
                    </label>
                    <input
                      type="text"
                      value={outDir}
                      onChange={(e) => setOutDir(e.target.value)}
                      placeholder="Auto-detect (e.g. dist, build, out)"
                      style={{
                        width: '100%',
                        background: '#030303',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#d4d4d8', marginBottom: '6px' }}>
                      Install Command
                    </label>
                    <input
                      type="text"
                      value={installCmd}
                      onChange={(e) => setInstallCmd(e.target.value)}
                      placeholder="Auto-detect"
                      style={{
                        width: '100%',
                        background: '#030303',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#d4d4d8', marginBottom: '6px' }}>
                      Build Command
                    </label>
                    <input
                      type="text"
                      value={buildCmd}
                      onChange={(e) => setBuildCmd(e.target.value)}
                      placeholder="Auto-detect"
                      style={{
                        width: '100%',
                        background: '#030303',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Environment Variables */}
          <div
            style={{
              background: '#09090b',
              border: '1px solid #1f1f23',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 2px' }}>
                  Environment Variables
                </h2>
                <p style={{ fontSize: '12px', color: '#71717a', margin: 0 }}>
                  Values are masked by default and injected securely during container builds.
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
                  <span>Add Row</span>
                </button>
              </div>
            </div>

            {/* Bulk Paste Drawer */}
            {showBulkPaste && (
              <div
                style={{
                  background: '#030303',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
                  Paste raw .env file contents:
                </label>
                <textarea
                  rows={4}
                  placeholder="DATABASE_URL=postgres://...&#10;API_KEY=xyz123&#10;PORT=3000"
                  value={bulkEnvText}
                  onChange={(e) => setBulkEnvText(e.target.value)}
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
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowBulkPaste(false)}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleApplyBulkEnv}
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    Add Variables
                  </button>
                </div>
              </div>
            )}

            {/* Key/Value Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {envVars.map((env, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="KEY (e.g. API_SECRET)"
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
                      title={revealedKeys[idx] ? 'Hide value' : 'Reveal value'}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#71717a',
                        display: 'flex',
                        alignItems: 'center',
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
                      title="Remove variable"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#71717a',
                        cursor: 'pointer',
                        padding: '6px',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <Link to="/projects" className="btn-secondary" style={{ padding: '10px 20px', fontSize: '14px', textDecoration: 'none' }}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ padding: '10px 28px', fontSize: '14px' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin-icon" />
                  <span>Creating & Deploying...</span>
                </>
              ) : (
                <>
                  <FolderPlus size={16} />
                  <span>Create & Deploy Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </ConsoleLayout>
  );
}
