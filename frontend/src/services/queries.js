import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProjects,
  getProject,
  createProject,
  getProjectDeployments,
  triggerDeploy,
  getDeployment,
  getDeploymentLogs,
  getDiagnosis,
  getProjectEnvVars,
  updateProjectEnvVars,
  updateProjectBuildSettings,
  TERMINAL_BUILD_STATES,
} from './api';

// ── Query Keys ──
export const QUERY_KEYS = {
  projects: ['projects'],
  project: (id) => ['project', id],
  projectDeployments: (id) => ['project-deployments', id],
  projectEnvVars: (id) => ['project-env', id],
  deployment: (id) => ['deployment', id],
  deploymentLogs: (id) => ['deployment-logs', id],
  diagnosis: (id) => ['diagnosis', id],
};

/**
 * Hook to fetch all projects.
 */
export function useProjects(options = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: ({ signal }) => getProjects(signal).then((res) => res.data.projects),
    staleTime: 10000,
    ...options,
  });
}

/**
 * Hook to fetch a single project by ID.
 */
export function useProject(projectId, options = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.project(projectId),
    queryFn: ({ signal }) => getProject(projectId, signal).then((res) => res.data.project),
    enabled: Boolean(projectId),
    staleTime: 10000,
    ...options,
  });
}

/**
 * Hook to fetch all deployments for a project with auto-polling for in-progress builds.
 */
export function useProjectDeployments(projectId, options = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.projectDeployments(projectId),
    queryFn: ({ signal }) => getProjectDeployments(projectId, signal).then((res) => res.data.deployments),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const deployments = query.state.data;
      if (!Array.isArray(deployments)) return false;
      const hasActive = deployments.some(
        (d) => d.status === 'QUEUED' || d.status === 'IN_PROGRESS'
      );
      return hasActive ? 3000 : false;
    },
    ...options,
  });
}

/**
 * Hook to fetch environment variables for a project.
 */
export function useProjectEnvVars(projectId, options = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.projectEnvVars(projectId),
    queryFn: ({ signal }) => getProjectEnvVars(projectId, signal).then((res) => res.data.envVars),
    enabled: Boolean(projectId),
    staleTime: 30000,
    ...options,
  });
}

/**
 * Hook to fetch a deployment by ID with automatic polling until terminal state.
 */
export function useDeployment(deploymentId, options = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.deployment(deploymentId),
    queryFn: ({ signal }) => getDeployment(deploymentId, signal).then((res) => res.data.deployment),
    enabled: Boolean(deploymentId),
    refetchInterval: (query) => {
      const dep = query.state.data;
      if (!dep) return 2000;
      const isTerminal = TERMINAL_BUILD_STATES.includes(dep.status) || dep.timedOut;
      return isTerminal ? false : 2500;
    },
    ...options,
  });
}

/**
 * Hook to fetch and stream deployment logs from ClickHouse.
 */
export function useDeploymentLogs(deploymentId, { live = false, ...options } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.deploymentLogs(deploymentId),
    queryFn: ({ signal }) => getDeploymentLogs(deploymentId, signal).then((res) => res.data.logs),
    enabled: Boolean(deploymentId),
    refetchInterval: live ? 2500 : false,
    ...options,
  });
}

/**
 * Hook to fetch AI diagnosis for a failed deployment.
 */
export function useDiagnosis(deploymentId, options = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.diagnosis(deploymentId),
    queryFn: ({ signal }) => getDiagnosis(deploymentId, signal),
    enabled: Boolean(deploymentId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.status === 'PENDING' ? 2500 : false;
    },
    ...options,
  });
}

/**
 * Mutation to create a new project.
 */
export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => createProject(variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    },
  });
}

/**
 * Mutation to trigger a deployment (or redeploy).
 */
export function useDeployMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId }) => triggerDeploy(projectId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectDeployments(variables.projectId) });
    },
  });
}

/**
 * Mutation to update environment variables.
 */
export function useUpdateEnvVarsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, envVars }) => updateProjectEnvVars(projectId, envVars),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectEnvVars(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(variables.projectId) });
    },
  });
}

/**
 * Mutation to update a project's build settings (PATCH /project/:id/build-settings).
 */
export function useUpdateBuildSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, settings }) => updateProjectBuildSettings(projectId, settings),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(variables.projectId) });
    },
  });
}
