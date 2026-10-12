/**
 * ShipStack API Service Layer
 * 
 * Centralized, typed, resilient client for all ShipStack backend REST endpoints.
 * Base URL is configurable via VITE_API_BASE_URL environment variable,
 * defaults to http://localhost:9000 for local development.
 * 
 * Includes:
 *   - Normalized error hierarchy (NetworkError, HttpError, ValidationError, TimeoutError)
 *   - Request timeouts and AbortController integration
 *   - Idempotent request retries with exponential backoff
 *   - Runtime response shape validation (discriminated union for diagnosis, etc.)
 *   - Robust polling with terminal stop conditions, backoff, and tab visibility pausing
 *   - Safe ANSI code stripping for log streams
 */

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE_URL) || 'http://localhost:9000';
const DEFAULT_TIMEOUT_MS = 15000;

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZED ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message, type = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.type = type;
  }
}

export class NetworkError extends ApiError {
  constructor(message, originalError = null, url = '') {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    this.originalError = originalError;
    this.url = url;
    this.isNetworkError = true;
  }
}

export class HttpError extends ApiError {
  constructor(status, statusText, data = null, url = '') {
    const detailMsg = data?.message || data?.error || `HTTP ${status}: ${statusText}`;
    super(detailMsg, 'HTTP_ERROR');
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.url = url;
  }
}

export class ValidationError extends ApiError {
  constructor(message, validationErrors = [], rawData = null) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
    this.rawData = rawData;
  }
}

export class TimeoutError extends ApiError {
  constructor(message = 'Request timed out', timeoutMs = DEFAULT_TIMEOUT_MS) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANSI CODE STRIPPER (UNTRUSTED LOGS SANITIZATION)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips ANSI color / formatting escape sequences from log text.
 * Prevents rendering artifacts and terminal escape glitches.
 * @param {string} str
 * @returns {string}
 */
export function stripAnsi(str) {
  if (typeof str !== 'string') return '';
  // Match ANSI escape codes (CSI / OSC sequences)
  return str.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME RESPONSE VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

function assertObject(val, context) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    throw new ValidationError(`Expected ${context} to be an object`, [{ field: context, issue: 'expected_object' }], val);
  }
}

function normalizeDeployment(dep) {
  if (!dep || typeof dep.id !== 'string') return null;
  return {
    id: String(dep.id),
    projectId: String(dep.projectId || ''),
    status: String(dep.status || 'NOT_STARTED'),
    ecsTaskArn: dep.ecsTaskArn ? String(dep.ecsTaskArn) : null,
    startedAt: dep.startedAt ? String(dep.startedAt) : null,
    deadlineAt: dep.deadlineAt ? String(dep.deadlineAt) : null,
    timedOut: Boolean(dep.timedOut),
    stopCode: dep.stopCode ? String(dep.stopCode) : null,
    stoppedReason: dep.stoppedReason ? String(dep.stoppedReason) : null,
    createdAt: String(dep.createdAt || new Date().toISOString()),
    updatedAt: String(dep.updatedAt || new Date().toISOString()),
  };
}

function normalizeProject(project) {
  if (!project || typeof project.id !== 'string') return null;
  const deployments = Array.isArray(project.deployments)
    ? project.deployments.map(normalizeDeployment).filter(Boolean)
    : [];
  const latestDeployment = deployments.length > 0 ? deployments[0] : null;

  return {
    id: String(project.id),
    name: String(project.name || ''),
    gitUrl: String(project.gitUrl || ''),
    subDomain: String(project.subDomain || ''),
    customDomain: project.customDomain ? String(project.customDomain) : null,
    buildSettings: project.buildSettings && typeof project.buildSettings === 'object' ? project.buildSettings : null,
    envVars: Array.isArray(project.envVars) ? project.envVars : [],
    deployments,
    latestDeployment,
    createdAt: String(project.createdAt || new Date().toISOString()),
    updatedAt: String(project.updatedAt || new Date().toISOString()),
  };
}

export function validateProjectResponse(data) {
  assertObject(data, 'response');
  const project = normalizeProject(data?.data?.project);
  if (!project) {
    throw new ValidationError('Malformed project response: missing data.project.id', [{ field: 'data.project.id', issue: 'missing_id' }], data);
  }
  return {
    status: String(data.status || 'success'),
    data: { project }
  };
}

export function validateProjectsResponse(data) {
  assertObject(data, 'response');
  const projects = data?.data?.projects;
  if (!Array.isArray(projects)) {
    throw new ValidationError('Malformed projects response: expected data.projects array', [{ field: 'data.projects', issue: 'expected_array' }], data);
  }
  return {
    status: String(data.status || 'success'),
    data: {
      projects: projects.map(normalizeProject).filter(Boolean)
    }
  };
}

export function validateDeploymentsResponse(data) {
  assertObject(data, 'response');
  const deployments = data?.data?.deployments;
  if (!Array.isArray(deployments)) {
    throw new ValidationError('Malformed deployments response: expected data.deployments array', [{ field: 'data.deployments', issue: 'expected_array' }], data);
  }
  return {
    status: String(data.status || 'success'),
    data: {
      deployments: deployments.map(normalizeDeployment).filter(Boolean)
    }
  };
}

export function validateEnvVarsResponse(data) {
  assertObject(data, 'response');
  const envVars = data?.data?.envVars;
  if (!Array.isArray(envVars)) {
    return { status: 'success', data: { envVars: [] } };
  }
  return {
    status: String(data.status || 'success'),
    data: {
      envVars: envVars
        .filter(v => v && typeof v.key === 'string')
        .map(v => ({
          key: String(v.key),
          value: String(v.value ?? '')
        }))
    }
  };
}

export function validateDeployResponse(data) {
  assertObject(data, 'response');
  const deploymentId = data?.data?.deploymentID || data?.data?.deploymentId;
  if (!deploymentId || typeof deploymentId !== 'string') {
    throw new ValidationError('Malformed deploy response: missing data.deploymentID', [{ field: 'data.deploymentID', issue: 'missing_id' }], data);
  }
  return {
    status: String(data.status || 'queued'),
    data: {
      deploymentID: String(deploymentId)
    }
  };
}

export function validateDeploymentResponse(data) {
  assertObject(data, 'response');
  const dep = normalizeDeployment(data?.data?.deployment);
  if (!dep) {
    throw new ValidationError('Malformed deployment response: missing data.deployment.id', [{ field: 'data.deployment.id', issue: 'missing_id' }], data);
  }
  return {
    status: String(data.status || 'success'),
    data: {
      deployment: dep
    }
  };
}

export function validateLogsResponse(data) {
  assertObject(data, 'response');
  const logs = data?.data?.logs;
  if (!Array.isArray(logs)) {
    throw new ValidationError('Malformed logs response: expected data.logs array', [{ field: 'data.logs', issue: 'expected_array' }], data);
  }
  return {
    status: String(data.status || 'success'),
    data: {
      logs: logs.map((l, idx) => ({
        event_id: String(l.event_id || `log-${idx}`),
        log: stripAnsi(String(l.log || '')),
        timestamp: String(l.timestamp || '')
      }))
    }
  };
}

export function validateDiagnosisResponse(data) {
  assertObject(data, 'response');
  const status = String(data.status || '').toUpperCase();
  const validStatuses = ['NOT_APPLICABLE', 'PENDING', 'DONE', 'FAILED'];

  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Unknown diagnosis status "${data.status}"`, [{ field: 'status', issue: 'invalid_status' }], data);
  }

  if (status === 'DONE') {
    const diag = data.diagnosis;
    if (!diag || typeof diag !== 'object') {
      throw new ValidationError('Diagnosis status is DONE but diagnosis payload is missing', [{ field: 'diagnosis', issue: 'missing_payload' }], data);
    }
    return {
      status: 'DONE',
      diagnosis: {
        category: String(diag.category || 'UNKNOWN'),
        confidence: typeof diag.confidence === 'number' ? Math.min(1, Math.max(0, diag.confidence)) : 0,
        root_cause: String(diag.root_cause || 'No root cause identified'),
        fix_steps: Array.isArray(diag.fix_steps) ? diag.fix_steps.map(s => ({
          step: String(s.step || ''),
          type: String(s.type || 'none')
        })) : [],
        evidence: Array.isArray(diag.evidence) ? diag.evidence.map(e => ({
          line: typeof e.line === 'number' ? e.line : 1,
          text: stripAnsi(String(e.text || ''))
        })) : [],
        source: String(diag.source || 'STUB')
      }
    };
  }

  if (status === 'FAILED') {
    return {
      status: 'FAILED',
      error: String(data.error || 'Diagnosis generation failed. Please inspect build logs manually.')
    };
  }

  return {
    status
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC REQUEST WRAPPER (TIMEOUT, RETRIES, NORMALIZED ERRORS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch wrapper with timeout, signal linking, and normalized error throwing.
 * @param {string} endpoint - API path (e.g. '/project')
 * @param {object} options  - fetch options
 * @param {number} [options.timeoutMs=15000]
 * @returns {Promise<any>} Parsed JSON
 */
async function request(endpoint, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...fetchOptions } = options;
  const url = `${BASE_URL}${endpoint}`;

  // Configure AbortController timeout combined with caller's signal
  const timeoutController = new AbortController();
  const timeoutTimer = setTimeout(() => {
    timeoutController.abort(new TimeoutError(`Request to ${endpoint} timed out after ${timeoutMs}ms`, timeoutMs));
  }, timeoutMs);

  const abortListener = () => timeoutController.abort(callerSignal?.reason);
  if (callerSignal) {
    callerSignal.addEventListener('abort', abortListener, { once: true });
  }

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    signal: timeoutController.signal,
    ...fetchOptions,
  };

  try {
    const response = await fetch(url, config);

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, data, url);
    }

    return data;
  } catch (err) {
    if (callerSignal?.aborted) {
      throw err;
    }
    if (timeoutController.signal.aborted && timeoutController.signal.reason instanceof TimeoutError) {
      throw timeoutController.signal.reason;
    }
    if (err instanceof HttpError || err instanceof ApiError) {
      throw err;
    }
    // Network errors (DNS failure, CORS rejection, connection refused)
    throw new NetworkError(
      `Unable to reach ShipStack API at ${url}. Ensure the api-server is running.`,
      err,
      url
    );
  } finally {
    clearTimeout(timeoutTimer);
    if (callerSignal) {
      callerSignal.removeEventListener('abort', abortListener);
    }
  }
}

/**
 * Executes an idempotent request with exponential backoff on transient errors.
 * Never used for POST /deploy.
 */
async function requestWithRetry(endpoint, options = {}, maxRetries = 2, baseDelayMs = 500) {
  let attempt = 0;
  while (true) {
    try {
      return await request(endpoint, options);
    } catch (err) {
      attempt++;
      const isTransient = err instanceof NetworkError || (err instanceof HttpError && err.status >= 500);
      if (attempt > maxRetries || !isTransient || options.signal?.aborted) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED API METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Health check endpoint (probes API server).
 */
export async function checkApiHealth(signal) {
  try {
    // Probe a read-only endpoint (dummy deployment 404 proves server is reachable)
    await request('/deployment/probe-health-check', { signal, timeoutMs: 5000 });
    return { ok: true };
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      // 404 means the api-server is up and actively responding!
      return { ok: true };
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch all projects registered in ShipStack.
 */
export async function getProjects(signal) {
  const raw = await requestWithRetry('/projects', { signal });
  return validateProjectsResponse(raw);
}

/**
 * Fetch a single project by ID.
 */
export async function getProject(projectId, signal) {
  const raw = await requestWithRetry(`/project/${encodeURIComponent(projectId)}`, { signal });
  return validateProjectResponse(raw);
}

/**
 * Register a new project repository.
 * Accepts either (gitURL, name) or { gitURL, name, buildSettings, envVars }.
 */
export async function createProject(payloadOrGitUrl, maybeName, signal) {
  const body = typeof payloadOrGitUrl === 'object' && payloadOrGitUrl !== null
    ? payloadOrGitUrl
    : { gitURL: payloadOrGitUrl, name: maybeName };

  const raw = await request('/project', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
  return validateProjectResponse(raw);
}

/**
 * Fetch all deployments for a project.
 */
export async function getProjectDeployments(projectId, signal) {
  const raw = await requestWithRetry(`/project/${encodeURIComponent(projectId)}/deployments`, { signal });
  return validateDeploymentsResponse(raw);
}

/**
 * Fetch environment variables for a project.
 */
export async function getProjectEnvVars(projectId, signal) {
  const raw = await requestWithRetry(`/project/${encodeURIComponent(projectId)}/env`, { signal });
  return validateEnvVarsResponse(raw);
}

/**
 * Save/update environment variables for a project.
 */
export async function updateProjectEnvVars(projectId, envVars, signal) {
  const raw = await request(`/project/${encodeURIComponent(projectId)}/env`, {
    method: 'PUT',
    body: JSON.stringify({ envVars }),
    signal,
  });
  return validateEnvVarsResponse(raw);
}

/**
 * Initiate a build & deployment task on AWS ECS Fargate.
 * NOTE: Never automatically retried (non-idempotent operation).
 */
export async function triggerDeploy(projectId, signal) {
  const raw = await request('/deploy', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
    signal,
  });
  return validateDeployResponse(raw);
}

/**
 * Get deployment metadata and status.
 */
export async function getDeployment(deploymentId, signal) {
  const raw = await requestWithRetry(`/deployment/${encodeURIComponent(deploymentId)}`, { signal });
  return validateDeploymentResponse(raw);
}

/**
 * Fetch logs for a deployment from ClickHouse.
 */
export async function getDeploymentLogs(deploymentId, signal) {
  const raw = await requestWithRetry(`/logs/${encodeURIComponent(deploymentId)}`, { signal });
  return validateLogsResponse(raw);
}

/**
 * Fetch AI diagnosis for a failed deployment.
 */
export async function getDiagnosis(deploymentId, signal) {
  const raw = await requestWithRetry(`/deployments/${encodeURIComponent(deploymentId)}/diagnosis`, { signal });
  return validateDiagnosisResponse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLING UTILITIES (TERMINAL STATUS, BACKOFF, VISIBILITY PAUSE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Terminal states for deployment builds in ShipStack.
 * Matches Prisma enum: SUCCESS, FAILURE, NOT_STARTED (plus backward-compatible READY, FAIL).
 */
export const TERMINAL_BUILD_STATES = ['SUCCESS', 'READY', 'FAILURE', 'FAIL', 'NOT_STARTED'];

/**
 * Poll deployment status until terminal state or deadline.
 * Pauses when document is hidden to conserve bandwidth.
 */
export async function pollDeploymentStatus(deploymentId, onUpdate, options = {}) {
  const { intervalMs = 2500, maxAttempts = 120, signal } = options;
  let attempts = 0;
  let currentDelay = intervalMs;

  return new Promise((resolve, reject) => {
    let timerId = null;

    const cleanup = () => {
      if (timerId) clearTimeout(timerId);
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Polling aborted'));
      }, { once: true });
    }

    const poll = async () => {
      if (signal?.aborted) return;

      // Pause/skip poll when tab is not active in browser
      if (typeof document !== 'undefined' && document.hidden) {
        timerId = setTimeout(poll, currentDelay);
        return;
      }

      attempts++;

      try {
        const result = await getDeployment(deploymentId, signal);
        const deployment = result?.data?.deployment;

        if (deployment) {
          onUpdate(deployment);

          const isTerminal = TERMINAL_BUILD_STATES.includes(deployment.status) || deployment.timedOut;
          if (isTerminal) {
            cleanup();
            resolve(deployment);
            return;
          }
        }

        if (attempts >= maxAttempts) {
          cleanup();
          reject(new Error(`Deployment polling reached max attempts (${maxAttempts})`));
          return;
        }

        currentDelay = intervalMs; // Reset backoff on success
        timerId = setTimeout(poll, currentDelay);
      } catch (err) {
        if (signal?.aborted) return;

        // Exponential backoff on transient errors (capped at 15s)
        currentDelay = Math.min(currentDelay * 1.5, 15000);

        if (attempts < maxAttempts) {
          timerId = setTimeout(poll, currentDelay);
        } else {
          cleanup();
          reject(err);
        }
      }
    };

    poll();
  });
}

/**
 * Poll diagnosis status until DONE, FAILED, or NOT_APPLICABLE.
 */
export async function pollDiagnosisStatus(deploymentId, onUpdate, options = {}) {
  const { intervalMs = 2000, maxAttempts = 60, signal } = options;
  let attempts = 0;
  let currentDelay = intervalMs;
  const TERMINAL_DIAG_STATES = ['DONE', 'FAILED', 'NOT_APPLICABLE'];

  return new Promise((resolve, reject) => {
    let timerId = null;

    const cleanup = () => {
      if (timerId) clearTimeout(timerId);
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Diagnosis polling aborted'));
      }, { once: true });
    }

    const poll = async () => {
      if (signal?.aborted) return;

      if (typeof document !== 'undefined' && document.hidden) {
        timerId = setTimeout(poll, currentDelay);
        return;
      }

      attempts++;

      try {
        const result = await getDiagnosis(deploymentId, signal);
        onUpdate(result);

        if (TERMINAL_DIAG_STATES.includes(result?.status)) {
          cleanup();
          resolve(result);
          return;
        }

        if (attempts >= maxAttempts) {
          cleanup();
          reject(new Error(`Diagnosis polling reached max attempts (${maxAttempts})`));
          return;
        }

        currentDelay = intervalMs;
        timerId = setTimeout(poll, currentDelay);
      } catch (err) {
        if (signal?.aborted) return;
        currentDelay = Math.min(currentDelay * 1.5, 12000);

        if (attempts < maxAttempts) {
          timerId = setTimeout(poll, currentDelay);
        } else {
          cleanup();
          reject(err);
        }
      }
    };

    poll();
  });
}

/**
 * Poll logs with capped updates and pause on hidden tab.
 */
export async function pollLogs(deploymentId, onLogs, options = {}) {
  const { intervalMs = 2500, maxAttempts = 150, signal } = options;
  let attempts = 0;
  let prevCount = 0;

  return new Promise((resolve) => {
    let timerId = null;

    const cleanup = () => {
      if (timerId) clearTimeout(timerId);
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        resolve();
      }, { once: true });
    }

    const poll = async () => {
      if (signal?.aborted) return;

      if (typeof document !== 'undefined' && document.hidden) {
        timerId = setTimeout(poll, intervalMs);
        return;
      }

      attempts++;

      try {
        const result = await getDeploymentLogs(deploymentId, signal);
        const logs = result?.data?.logs || [];
        onLogs(logs);

        if (logs.length > prevCount) {
          prevCount = logs.length;
          attempts = 0; // Fresh logs received, reset attempt limit
        }

        if (attempts >= maxAttempts) {
          cleanup();
          resolve();
          return;
        }

        timerId = setTimeout(poll, intervalMs);
      } catch {
        if (signal?.aborted) return;
        if (attempts < maxAttempts) {
          timerId = setTimeout(poll, intervalMs * 1.5);
        } else {
          cleanup();
          resolve();
        }
      }
    };

    poll();
  });
}

export const API_CONFIG = {
  baseUrl: BASE_URL,
  isConfigured: !!(typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE_URL),
};
