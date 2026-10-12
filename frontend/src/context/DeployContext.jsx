import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  createProject, 
  triggerDeploy, 
  getDeployment, 
  getDeploymentLogs, 
  getDiagnosis,
  pollDeploymentStatus,
  pollDiagnosisStatus,
  checkApiHealth as checkApiHealthFromApi,
  API_CONFIG 
} from '../services/api';

const DeployContext = createContext(null);

const DEFAULT_PROJECTS = [];

/**
 * Provides shared deployment state and API methods to the entire app.
 * Manages: multiple projects, active project, deployment flow, logs, diagnosis.
 */
export function DeployProvider({ children }) {
  // ── Multi-project state ──
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('shipstack_projects_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy mock projects
          const filtered = parsed.filter(p => !p.id?.startsWith('prj_'));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch {
      // Fallback to defaults
    }
    return [];
  });

  const [activeProject, setActiveProjectState] = useState(() => {
    try {
      const activeId = localStorage.getItem('shipstack_active_project_id');
      if (activeId && !activeId.startsWith('prj_')) {
        const found = projects.find(p => p.id === activeId);
        if (found) return found;
      }
    } catch {
      // Fallback
    }
    return null;
  });

  // Modal visibility for Create Project
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);

  // Sync projects to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('shipstack_projects_v1', JSON.stringify(projects));
    } catch (err) {
      console.warn('Failed to save projects to localStorage', err);
    }
  }, [projects]);

  // Set active project helper
  const setActiveProject = useCallback((projectOrId) => {
    if (!projectOrId) return;
    if (typeof projectOrId === 'object' && projectOrId.id) {
      setActiveProjectState(projectOrId);
      try {
        localStorage.setItem('shipstack_active_project_id', projectOrId.id);
      } catch {}
    } else if (typeof projectOrId === 'string') {
      setActiveProjectState(prev => (prev?.id === projectOrId ? prev : { id: projectOrId, name: projectOrId }));
      try {
        localStorage.setItem('shipstack_active_project_id', projectOrId);
      } catch {}
    }
  }, []);

  const openCreateProjectModal = useCallback(() => {
    setIsCreateProjectModalOpen(true);
  }, []);

  const closeCreateProjectModal = useCallback(() => {
    setIsCreateProjectModalOpen(false);
  }, []);

  // API connection state
  const [apiStatus, setApiStatus] = useState('unknown'); // 'unknown' | 'connected' | 'error'
  const [apiError, setApiError] = useState(null);

  // Deployment flow state
  const [deployState, setDeployState] = useState('idle'); 
  // 'idle' | 'creating' | 'queued' | 'building' | 'ready' | 'failed' | 'error'
  const [activeDeployment, setActiveDeployment] = useState(null);
  const [deployError, setDeployError] = useState(null);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [isStreamingLogs, setIsStreamingLogs] = useState(false);

  // Diagnosis state
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagnosisStatus, setDiagnosisStatus] = useState('idle');
  // 'idle' | 'pending' | 'done' | 'failed' | 'not_applicable'

  // Abort controllers for cleanup
  const deployPollRef = useRef(null);
  const logPollRef = useRef(null);
  const diagPollRef = useRef(null);

  // ── Check API health ──
  const checkApiHealth = useCallback(async () => {
    try {
      const result = await checkApiHealthFromApi();
      if (result.ok) {
        setApiStatus('connected');
        setApiError(null);
        return true;
      }
      setApiStatus('error');
      setApiError(result.error || 'Cannot reach ShipStack API server');
      return false;
    } catch (err) {
      setApiStatus('error');
      setApiError('Cannot reach ShipStack API server');
      return false;
    }
  }, []);

  // ── Abort all active polling ──
  const abortAllPolling = useCallback(() => {
    deployPollRef.current?.abort();
    logPollRef.current?.abort();
    diagPollRef.current?.abort();
  }, []);

  // ── Register / Create a Project ──
  const createNewProject = useCallback(async ({
    name,
    gitUrl,
    framework = 'React',
    rootDir = './',
    buildCmd = 'npm run build',
    outDir = 'dist',
    deployNow = true
  }) => {
    let projectResult = null;
    let registeredProject = null;

    try {
      // Step 1: Call API POST /project
      projectResult = await createProject(gitUrl.trim(), name.trim());
      registeredProject = projectResult?.data?.project;
    } catch (err) {
      console.warn('API /project call failed or offline, creating local representation:', err.message);
    }

    // Fallback if API returned null or server was offline
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newProject = {
      id: registeredProject?.id || `prj_${Date.now()}_${randomSuffix}`,
      name: registeredProject?.name || name.trim(),
      gitUrl: registeredProject?.gitUrl || gitUrl.trim(),
      subDomain: registeredProject?.subDomain || `${slug}-${randomSuffix}`,
      framework,
      rootDir,
      buildCmd,
      outDir,
      status: deployNow ? 'BUILDING' : 'READY',
      deploymentsCount: deployNow ? 1 : 0,
      branch: 'main',
      commit: 'init',
      createdAt: registeredProject?.createdAt || new Date().toISOString(),
      updatedAt: registeredProject?.updatedAt || new Date().toISOString(),
    };

    // Add to project list
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectState(newProject);
    try {
      localStorage.setItem('shipstack_active_project_id', newProject.id);
    } catch {}

    // If deployNow, trigger deployment flow
    if (deployNow) {
      startFullDeployFlow(newProject.gitUrl, newProject.name, newProject.id).catch(() => {});
    }

    return newProject;
  }, []);

  // ── Delete a project ──
  const deleteProject = useCallback((projectId) => {
    setProjects(prev => {
      const remaining = prev.filter(p => p.id !== projectId);
      if (activeProject?.id === projectId) {
        const nextActive = remaining[0] || null;
        setActiveProjectState(nextActive);
        if (nextActive) {
          try {
            localStorage.setItem('shipstack_active_project_id', nextActive.id);
          } catch {}
        }
      }
      return remaining;
    });
  }, [activeProject?.id]);

  // In-flight guard to prevent double-submit
  const isDeployingRef = useRef(false);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      abortAllPolling();
    };
  }, [abortAllPolling]);

  // ── Full Deploy Flow: create project (if needed) → deploy → poll ──
  const startFullDeployFlow = useCallback(async (gitURL, projectName, existingProjectId = null) => {
    if (isDeployingRef.current) {
      throw new Error('A deployment is already in progress');
    }
    isDeployingRef.current = true;

    // Reset state
    abortAllPolling();
    setDeployState('creating');
    setDeployError(null);
    setLogs([]);
    setDiagnosis(null);
    setDiagnosisStatus('idle');
    setActiveDeployment(null);

    let logPollInterval = null;
    let logAbort = null;

    try {
      let projectId = existingProjectId;
      let project = null;

      if (!projectId) {
        // Step 1: Register project on backend
        const projectResult = await createProject(gitURL, projectName);
        project = projectResult?.data?.project;
        
        if (!project?.id) {
          throw new Error('Invalid project response: missing project ID');
        }
        
        projectId = project.id;
        setActiveProjectState(project);
        setProjects(prev => {
          if (prev.some(p => p.id === project.id)) return prev;
          return [project, ...prev];
        });
      } else {
        project = projects.find(p => p.id === projectId) || activeProject;
      }

      // Step 2: Trigger deployment
      setDeployState('queued');
      const deployResult = await triggerDeploy(projectId);
      const deploymentId = deployResult?.data?.deploymentID;
      
      if (!deploymentId) {
        throw new Error('Invalid deploy response: missing deployment ID');
      }
      
      setActiveDeployment({ id: deploymentId, status: 'QUEUED', projectId });
      setDeployState('building');

      // Update project deployment count
      setProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            status: 'BUILDING',
            deploymentsCount: (p.deploymentsCount || 0) + 1,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      }));

      // Step 3: Start log polling
      logAbort = new AbortController();
      logPollRef.current = logAbort;
      setIsStreamingLogs(true);

      // Non-blocking: initial logs fetch
      getDeploymentLogs(deploymentId, logAbort.signal)
        .then(result => setLogs(result?.data?.logs || []))
        .catch(() => {});

      // Continuous log polling with interval  
      logPollInterval = setInterval(async () => {
        if (logAbort.signal.aborted || (typeof document !== 'undefined' && document.hidden)) {
          return;
        }
        try {
          const result = await getDeploymentLogs(deploymentId, logAbort.signal);
          setLogs(result?.data?.logs || []);
        } catch {
          // Transient error
        }
      }, 2500);

      // Step 4: Poll deployment status
      const deployAbort = new AbortController();
      deployPollRef.current = deployAbort;

      const finalDeployment = await pollDeploymentStatus(
        deploymentId,
        (deployment) => {
          setActiveDeployment(deployment);
          if (deployment.status === 'IN_PROGRESS') {
            setDeployState('building');
          }
        },
        { signal: deployAbort.signal }
      );

      // Stop log polling
      if (logPollInterval) clearInterval(logPollInterval);
      logAbort.abort();
      setIsStreamingLogs(false);

      // Final log fetch
      try {
        const finalLogs = await getDeploymentLogs(deploymentId);
        setLogs(finalLogs?.data?.logs || []);
      } catch {}

      // Update final state
      setActiveDeployment(finalDeployment);

      if (finalDeployment.status === 'READY' || finalDeployment.status === 'SUCCESS') {
        setDeployState('ready');
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'READY' } : p));
      } else if (finalDeployment.status === 'FAILURE' || finalDeployment.status === 'FAIL') {
        setDeployState('failed');
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'FAILURE' } : p));
        
        // Step 5: Auto-trigger diagnosis polling for failures
        setDiagnosisStatus('pending');
        const diagAbort = new AbortController();
        diagPollRef.current = diagAbort;

        try {
          const finalDiag = await pollDiagnosisStatus(
            deploymentId,
            (diagData) => {
              setDiagnosis(diagData);
              setDiagnosisStatus(diagData?.status?.toLowerCase() || 'pending');
            },
            { signal: diagAbort.signal }
          );
          setDiagnosis(finalDiag);
          setDiagnosisStatus(finalDiag?.status?.toLowerCase() || 'failed');
        } catch {
          setDiagnosisStatus('failed');
        }
      }

      return { project, deploymentId, status: finalDeployment.status };

    } catch (err) {
      setDeployState('error');
      setDeployError(err.message || 'Deployment failed');
      throw err;
    } finally {
      if (logPollInterval) clearInterval(logPollInterval);
      if (logAbort) logAbort.abort();
      setIsStreamingLogs(false);
      isDeployingRef.current = false;
    }
  }, [projects, activeProject, abortAllPolling]);

  // ── Fetch deployment by ID (for direct navigation) ──
  const fetchDeploymentById = useCallback(async (deploymentId) => {
    try {
      const result = await getDeployment(deploymentId);
      setActiveDeployment(result?.data?.deployment);
      return result?.data?.deployment;
    } catch (err) {
      setDeployError(err.message);
      return null;
    }
  }, []);

  // ── Fetch logs by deployment ID ──
  const fetchLogsByDeploymentId = useCallback(async (deploymentId) => {
    try {
      const result = await getDeploymentLogs(deploymentId);
      setLogs(result?.data?.logs || []);
      return result?.data?.logs || [];
    } catch {
      return [];
    }
  }, []);

  // ── Fetch diagnosis by deployment ID ──
  const fetchDiagnosisByDeploymentId = useCallback(async (deploymentId) => {
    try {
      setDiagnosisStatus('pending');
      const result = await getDiagnosis(deploymentId);
      setDiagnosis(result);
      setDiagnosisStatus(result?.status?.toLowerCase() || 'idle');
      return result;
    } catch {
      setDiagnosisStatus('failed');
      return null;
    }
  }, []);

  // ── Reset state ──
  const resetDeployState = useCallback(() => {
    abortAllPolling();
    setDeployState('idle');
    setDeployError(null);
    setActiveDeployment(null);
    setLogs([]);
    setDiagnosis(null);
    setDiagnosisStatus('idle');
    setIsStreamingLogs(false);
  }, [abortAllPolling]);

  const value = {
    // API health
    apiStatus,
    apiError,
    apiBaseUrl: API_CONFIG.baseUrl,
    checkApiHealth,

    // Multiple Projects Management
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    createNewProject,
    deleteProject,
    isCreateProjectModalOpen,
    openCreateProjectModal,
    closeCreateProjectModal,

    // Deploy flow
    deployState,
    activeDeployment,
    deployError,
    startFullDeployFlow,
    fetchDeploymentById,
    resetDeployState,

    // Logs
    logs,
    isStreamingLogs,
    fetchLogsByDeploymentId,

    // Diagnosis
    diagnosis,
    diagnosisStatus,
    fetchDiagnosisByDeploymentId,

    // Utilities
    abortAllPolling,
  };

  return (
    <DeployContext.Provider value={value}>
      {children}
    </DeployContext.Provider>
  );
}

/**
 * Hook to access deployment context.
 * @returns {object} Deploy context value
 */
export function useDeploy() {
  const context = useContext(DeployContext);
  if (!context) {
    throw new Error('useDeploy must be used within a DeployProvider');
  }
  return context;
}

export default DeployContext;
