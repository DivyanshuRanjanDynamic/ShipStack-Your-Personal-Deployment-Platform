/**
 * ShipStack Data Models & Shared Types
 * 
 * @typedef {Object} EnvVar
 * @property {string} key - Environment variable name (uppercase, alphanumeric + underscore)
 * @property {string} value - Environment variable value
 * 
 * @typedef {Object} BuildSettings
 * @property {string} [framework] - Framework identifier (React, Next.js, Vite, Vue, etc.)
 * @property {string} [rootDir] - Root directory of the repository (default: "./")
 * @property {string} [installCmd] - Custom dependency installation command
 * @property {string} [buildCmd] - Build command (e.g. "npm run build")
 * @property {string} [outDir] - Output export directory (e.g. "dist", ".next")
 * 
 * @typedef {'NOT_STARTED' | 'QUEUED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE'} DeploymentStatus
 * 
 * @typedef {Object} Deployment
 * @property {string} id - Deployment UUID
 * @property {string} projectId - Associated Project UUID
 * @property {DeploymentStatus} status - Current status
 * @property {string|null} [ecsTaskArn] - AWS ECS task ARN
 * @property {string|null} [startedAt] - ISO timestamp when container started
 * @property {string|null} [deadlineAt] - Watchdog deadline timestamp
 * @property {boolean} [timedOut] - Whether deployment exceeded execution timeout
 * @property {string|null} [stopCode] - ECS stop code (e.g. EssentialContainerExited)
 * @property {string|null} [stoppedReason] - Detailed reason for termination
 * @property {string} createdAt - ISO creation timestamp
 * @property {string} updatedAt - ISO update timestamp
 * @property {string} [url] - Computed preview URL
 * 
 * @typedef {Object} Project
 * @property {string} id - Project UUID
 * @property {string} name - Human-readable project name
 * @property {string} gitUrl - Git repository URL
 * @property {string} subDomain - Unique generated subdomain slug
 * @property {string|null} [customDomain] - Optional custom production domain
 * @property {BuildSettings|null} [buildSettings] - Build configurations
 * @property {EnvVar[]|null} [envVars] - Stored environment variables
 * @property {Deployment[]} [deployments] - Associated deployments
 * @property {Deployment|null} [latestDeployment] - Most recent deployment
 * @property {string} createdAt - ISO creation timestamp
 * @property {string} updatedAt - ISO update timestamp
 * 
 * @typedef {Object} FixStep
 * @property {string} step - Description of the remediation step
 * @property {'config' | 'code' | 'env' | 'none'} type - Category of fix
 * @property {string|null} [source_chunk_id] - Knowledge base citation chunk ID if grounded
 * 
 * @typedef {Object} SourceItem
 * @property {string} id - Knowledge base chunk ID
 * @property {string} title - Title or document name
 * @property {string|null} [url] - Documentation URL
 * 
 * @typedef {Object} LogEvidence
 * @property {number} line - Log line number
 * @property {string} text - Excerpt from build logs
 * 
 * @typedef {Object} Diagnosis
 * @property {string} [category] - Error classification (e.g. MISSING_DEPENDENCY, BUILD_SCRIPT_ERROR)
 * @property {number} [confidence] - Confidence score (0.0 - 1.0)
 * @property {string} [root_cause] - Human-readable cause of failure
 * @property {FixStep[]} [fix_steps] - Remediation actions
 * @property {LogEvidence[]} [evidence] - Pinpointed log lines
 * @property {'STUB' | 'RULES' | 'LLM' | 'LLM_FALLBACK' | 'CACHE'} [source] - Engine source
 * @property {boolean} [needs_human] - Whether human review is advised
 * @property {SourceItem[]} [sources] - Grounded knowledge base citations
 * 
 * @typedef {Object} DiagnosisResponse
 * @property {'NOT_APPLICABLE' | 'PENDING' | 'DONE' | 'FAILED'} status - Pipeline progress status
 * @property {Diagnosis} [diagnosis] - Available when status === 'DONE'
 * @property {string} [error] - Error message when status === 'FAILED'
 */

export const DEPLOYMENT_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  QUEUED: 'QUEUED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
};

export const TERMINAL_STATUSES = [
  DEPLOYMENT_STATUS.SUCCESS,
  DEPLOYMENT_STATUS.FAILURE,
];

/**
 * Returns proxy URL for a project based on its subdomain or custom domain.
 * @param {Project} project
 * @param {string} [proxyPort='8000']
 * @returns {string}
 */
export function getProjectUrl(project, proxyPort = '8000') {
  if (!project) return '#';
  if (project.customDomain) return `https://${project.customDomain}`;
  if (project.subDomain) {
    const host = window.location.hostname || 'localhost';
    return `http://${project.subDomain}.${host}:${proxyPort}`;
  }
  return '#';
}

/**
 * Returns unique preview URL for a specific deployment.
 * @param {Project} project
 * @param {Deployment} deployment
 * @param {string} [proxyPort='8000']
 * @returns {string}
 */
export function getDeploymentUrl(project, deployment, proxyPort = '8000') {
  if (!project) return '#';
  return getProjectUrl(project, proxyPort);
}
