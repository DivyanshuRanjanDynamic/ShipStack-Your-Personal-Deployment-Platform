/**
 * Sample data for demo mode (see api.js).
 *
 * The public deployment of this frontend has no ShipStack API behind it: the build pipeline
 * (ECS, Kafka, ClickHouse, the AI service) runs on a private AWS account. Demo mode answers the
 * read endpoints from here instead, in the exact response shapes the api-server returns, so every
 * page renders normally. Writes (create project, deploy, edit settings) are refused.
 *
 * The three projects tell the story the platform exists for: a Next.js deploy that failed, got an
 * AI diagnosis, and succeeded after the fix; a plain Vite deploy; and a failure caused by a
 * file-name casing mismatch that only shows up on Linux.
 */

// Builds ClickHouse-style log rows ({ event_id, log, timestamp }) one to two seconds apart.
function logRows(deploymentId, startIso, lines) {
  let t = new Date(startIso).getTime();
  return lines.map((log, i) => {
    t += 1000 + (i % 3) * 500;
    const timestamp = new Date(t).toISOString().replace('T', ' ').slice(0, 19);
    return { event_id: `${deploymentId}-${i + 1}`, log, timestamp };
  });
}

// Evidence entries ({ line, text }) for the log lines containing each snippet, 1-based like the API.
function evidence(rows, snippets) {
  return snippets
    .map((snippet) => {
      const index = rows.findIndex((row) => row.log.includes(snippet));
      return index === -1 ? null : { line: index + 1, text: rows[index].log };
    })
    .filter(Boolean);
}

function deployment(id, projectId, status, createdAt, minutes) {
  const created = new Date(createdAt).getTime();
  return {
    id,
    projectId,
    status,
    ecsTaskArn: `arn:aws:ecs:eu-north-1:000000000000:task/builder-cluster/${id.replace(/-/g, '').slice(0, 32)}`,
    startedAt: new Date(created + 20_000).toISOString(),
    deadlineAt: new Date(created + 20_000 + 15 * 60_000).toISOString(),
    timedOut: false,
    stopCode: 'EssentialContainerExited',
    stoppedReason: 'Essential container in task exited',
    createdAt,
    updatedAt: new Date(created + minutes * 60_000).toISOString(),
  };
}

const CLONE_AND_SETUP = (extra) => [
  'Starting the build process......',
  'Cloning repository...',
  '[clone:end] exit_code=0',
  ...extra,
  '[install:start]',
];

// ── Project 1: Next.js static export (failed, diagnosed, fixed) ─────────────

const QB_ID = '83a3ff1e-7d03-4748-bff0-cb42a6487a83';
const QB_FAILED = 'b3f7c2d1-5a4e-4f0b-9c61-2d8e7a9f1c03';
const QB_OK = '7d50a424-8066-47fa-ac22-aceb655c8e67';

const NEXT_BUILD_LINES = [
  '[build:start]',
  '[build] $ npx next build',
  '[build]   ▲ Next.js 14.2.35',
  '[build]    Creating an optimized production build ...',
  '[build]  ✓ Compiled successfully',
  '[build]    Collecting page data ...',
  '[build]  ✓ Generating static pages (26/26)',
  '[build]    Finalizing page optimization ...',
  '[build] Route (app)                              Size     First Load JS',
  '[build] ┌ ○ /                                    1.2 kB          275 kB',
  '[build] ├ ○ /about                               1.31 kB        98.2 kB',
  '[build] ├ ○ /guides                              1.31 kB        98.2 kB',
  '[build] ├ ● /guides/[slug]                       2.43 kB         101 kB',
  '[build] ├ ○ /invoice                             6.09 kB         280 kB',
  '[build] └ ○ /terms                               190 B          97.1 kB',
  '[build] ○  (Static)  prerendered as static content',
  '[build] ●  (SSG)     prerendered as static HTML (uses getStaticProps)',
  '[build:end] exit_code=0',
  'Build Process Done',
  '[upload:start]',
];

const QB_SETUP = CLONE_AND_SETUP([
  '[setup] applied install command setting: npm install',
  '[setup] applied build command setting: npx next build',
  '[setup] root directory: . (reason: build script + next)',
  '[setup] package manager: npm (package-lock.json)',
  '[setup] node 20.18.1 selected (source: default)',
]);
const QB_INSTALL = ['[install] added 412 packages, and audited 413 packages in 21s', '[install:end] exit_code=0'];

const qbFailedLogs = logRows(QB_FAILED, '2026-10-19T15:49:04Z', [
  ...QB_SETUP,
  ...QB_INSTALL,
  ...NEXT_BUILD_LINES,
  "[upload] the Next.js build finished but produced no out/ directory, because output: 'export' is not set in the Next.js config",
  "[upload] add output: 'export' to next.config.js and redeploy; Next will write the static site to out/",
  '[upload] leave the Output Directory setting blank (auto-detected) or set it to out; redirects, rewrites, headers and the default next/image loader are not available in a static export',
  '[upload:end] exit_code=1',
  'Build process failed! Cannot proceed to upload.',
]);

const qbOkLogs = logRows(QB_OK, '2026-10-20T03:48:10Z', [
  ...QB_SETUP,
  ...QB_INSTALL,
  ...NEXT_BUILD_LINES,
  '[upload] output directory: out',
  'Starting to upload to S3...',
  '[upload] 91 file(s) uploaded, 4345484 bytes, 470 ms',
  '[upload:end] exit_code=0',
  'Uploading to S3 Done!!!!!!',
]);

// ── Project 2: Vite + React (success) ────────────────────────────────────────

const VITE_ID = 'e2717ed6-154e-423f-9afc-22f8f2f464c8';
const VITE_OK = 'c41d9e7a-2b6f-4a8e-b0d3-5f1e9a7c2b84';

const viteOkLogs = logRows(VITE_OK, '2026-10-19T14:54:58Z', [
  ...CLONE_AND_SETUP([
    '[setup] root directory: . (reason: build script + vite)',
    '[setup] package manager: npm (package-lock.json)',
    '[setup] node 20.18.1 selected (source: default)',
  ]),
  '[install] added 214 packages, and audited 215 packages in 9s',
  '[install:end] exit_code=0',
  '[build:start]',
  '[build] $ vite build',
  '[build] vite v5.4.10 building for production...',
  '[build] ✓ 1532 modules transformed.',
  '[build] dist/index.html                   0.46 kB │ gzip:  0.30 kB',
  '[build] dist/assets/index-DiwrgTda.css    1.39 kB │ gzip:  0.72 kB',
  '[build] dist/assets/index-C7v2Jg1Q.js   143.36 kB │ gzip: 46.10 kB',
  '[build] ✓ built in 2.41s',
  '[build:end] exit_code=0',
  'Build Process Done',
  '[upload:start]',
  '[upload] output directory: dist',
  'Starting to upload to S3...',
  '[upload] 6 file(s) uploaded, 151230 bytes, 179 ms',
  '[upload:end] exit_code=0',
  'Uploading to S3 Done!!!!!!',
]);

// ── Project 3: casing mismatch that only fails on Linux (failure) ────────────

const CASE_ID = '5c8a1f3e-9d2b-4e7a-8f6c-1b3d5e7a9c20';
const CASE_FAILED = 'f19b2e8d-7c4a-4d3f-a6e5-9b1c3d5f7a92';

const caseFailedLogs = logRows(CASE_FAILED, '2026-10-19T18:17:36Z', [
  ...CLONE_AND_SETUP([
    '[setup] root directory: . (reason: build script + vite)',
    '[setup] package manager: npm (package-lock.json)',
    '[setup] node 20.18.1 selected (source: default)',
  ]),
  '[install] added 198 packages, and audited 199 packages in 8s',
  '[install:end] exit_code=0',
  '[build:start]',
  '[build] $ vite build',
  '[build] vite v5.4.10 building for production...',
  '[build] ✓ 41 modules transformed.',
  '[build] x Build failed in 812ms',
  '[build] error during build:',
  '[build] [vite]: Rollup failed to resolve import "./components/Navbar" from "/home/app/output/src/App.jsx".',
  '[build] This is most likely unintended because it can break your application at runtime.',
  '[build:end] exit_code=1',
  'Build process failed! Cannot proceed to upload.',
]);

// ── Assembled records ────────────────────────────────────────────────────────

const DEPLOYMENTS = {
  [QB_OK]: deployment(QB_OK, QB_ID, 'SUCCESS', '2026-10-20T03:47:58Z', 4),
  [QB_FAILED]: deployment(QB_FAILED, QB_ID, 'FAILURE', '2026-10-19T15:49:04Z', 2),
  [VITE_OK]: deployment(VITE_OK, VITE_ID, 'SUCCESS', '2026-10-19T14:54:58Z', 2),
  [CASE_FAILED]: deployment(CASE_FAILED, CASE_ID, 'FAILURE', '2026-10-19T18:17:36Z', 1),
};

const LOGS = {
  [QB_OK]: qbOkLogs,
  [QB_FAILED]: qbFailedLogs,
  [VITE_OK]: viteOkLogs,
  [CASE_FAILED]: caseFailedLogs,
};

const DIAGNOSES = {
  [QB_FAILED]: {
    status: 'DONE',
    diagnosis: {
      category: 'WRONG_OUTPUT_DIR',
      confidence: 0.9,
      root_cause:
        "The Next.js build succeeded and all 26 routes are static, but next.config.js does not set output: 'export', so Next wrote a server bundle to .next/ and no out/ directory for ShipStack to upload.",
      fix_steps: [
        { step: "Add output: 'export' to next.config.js so `next build` writes the static site to out/.", type: 'config', source_chunk_id: 'shipstack-ssr-or-missing-static-export' },
        { step: 'Leave the Output Directory setting blank (auto-detected) or set it to out, then redeploy.', type: 'config', source_chunk_id: 'shipstack-output-directory-mismatch' },
        { step: 'Move the /invoice-generator redirect out of next.config.js: redirects do not run on a static host.', type: 'code', source_chunk_id: null },
      ],
      evidence: evidence(qbFailedLogs, ['Generating static pages (26/26)', 'produced no out/ directory', '[upload:end] exit_code=1']),
      sources: [
        { id: 'shipstack-ssr-or-missing-static-export', title: 'Next.js: server rendering or missing static export', url: null },
        { id: 'shipstack-output-directory-mismatch', title: 'Output directory mismatch', url: null },
      ],
      source: 'LLM',
      needs_human: false,
    },
  },
  [CASE_FAILED]: {
    status: 'DONE',
    diagnosis: {
      category: 'MODULE_NOT_FOUND',
      confidence: 0.95,
      root_cause:
        'src/App.jsx imports ./components/Navbar, but the file in the repository is components/NavBar.jsx. macOS and Windows ignore letter case in file names, so the app builds locally; the Linux build container does not.',
      fix_steps: [
        { step: 'Change the import in src/App.jsx to "./components/NavBar" so it matches the file name exactly.', type: 'code', source_chunk_id: 'shipstack-linux-case-sensitivity' },
        { step: 'If the file should be Navbar.jsx instead, rename it with `git mv` (a plain rename is invisible to git on case-insensitive disks).', type: 'code', source_chunk_id: 'shipstack-linux-case-sensitivity' },
        { step: 'Enable a case-sensitive import check (eslint-plugin-import no-unresolved with caseSensitive) to catch this before pushing.', type: 'config', source_chunk_id: null },
      ],
      evidence: evidence(caseFailedLogs, ['Rollup failed to resolve import', 'x Build failed', '[build:end] exit_code=1']),
      sources: [{ id: 'shipstack-linux-case-sensitivity', title: 'Linux filesystem casing', url: null }],
      source: 'LLM',
      needs_human: false,
    },
  },
};

const PROJECTS = [
  {
    id: QB_ID,
    name: 'quickbills',
    gitUrl: 'https://github.com/DivyanshuRanjanDynamic/quickbills',
    subDomain: 'proud-sweet-coffeeshop',
    customDomain: null,
    buildSettings: null,
    rootDirectory: null,
    installCommand: 'npm install',
    buildCommand: 'npx next build',
    outputDirectory: 'out',
    nodeVersion: null,
    envVars: [],
    deploymentIds: [QB_OK, QB_FAILED],
    createdAt: '2026-10-19T15:40:12Z',
    updatedAt: '2026-10-20T03:51:58Z',
  },
  {
    id: CASE_ID,
    name: 'react-case-sensitivity',
    gitUrl: 'https://github.com/example/react-case-sensitivity',
    subDomain: 'quiet-amber-falcon',
    customDomain: null,
    buildSettings: null,
    rootDirectory: null,
    installCommand: null,
    buildCommand: null,
    outputDirectory: null,
    nodeVersion: null,
    envVars: [],
    deploymentIds: [CASE_FAILED],
    createdAt: '2026-10-19T18:15:02Z',
    updatedAt: '2026-10-19T18:18:36Z',
  },
  {
    id: VITE_ID,
    name: 'vite-test-project',
    gitUrl: 'https://github.com/DivyanshuRanjanDynamic/vite-test-project',
    subDomain: 'scarce-uninterested-alligator',
    customDomain: null,
    buildSettings: null,
    rootDirectory: null,
    installCommand: null,
    buildCommand: null,
    outputDirectory: null,
    nodeVersion: null,
    envVars: [{ key: 'VITE_APP_TITLE', value: 'Vite Test Project' }],
    deploymentIds: [VITE_OK],
    createdAt: '2026-10-19T14:52:31Z',
    updatedAt: '2026-10-19T14:56:58Z',
  },
];

// API shape: the project with its deployments, newest first.
function projectRecord({ deploymentIds, ...project }) {
  return { ...project, deployments: deploymentIds.map((id) => DEPLOYMENTS[id]) };
}

function findProject(id) {
  return PROJECTS.find((p) => p.id === id) || null;
}

const ok = (body) => ({ status: 200, body });
const notFound = (error) => ({ status: 404, body: { error } });

/**
 * Answers one API request from the sample data.
 * Returns { status, body }: 200 with the api-server's response body, 404 for unknown ids or paths,
 * or 405 for any write, which demo mode does not allow.
 */
export function resolveDemoRequest(method, endpoint) {
  if (method !== 'GET') return { status: 405, body: null };

  const path = endpoint.split('?')[0];
  let m;

  if (path === '/projects') {
    return ok({ status: 'success', data: { projects: PROJECTS.map(projectRecord) } });
  }
  if ((m = path.match(/^\/project\/([^/]+)$/))) {
    const project = findProject(decodeURIComponent(m[1]));
    return project ? ok({ status: 'success', data: { project: projectRecord(project) } }) : notFound('Project not found');
  }
  if ((m = path.match(/^\/project\/([^/]+)\/deployments$/))) {
    const project = findProject(decodeURIComponent(m[1]));
    return project
      ? ok({ status: 'success', data: { deployments: project.deploymentIds.map((id) => DEPLOYMENTS[id]) } })
      : notFound('Project not found');
  }
  if ((m = path.match(/^\/project\/([^/]+)\/env$/))) {
    const project = findProject(decodeURIComponent(m[1]));
    return project ? ok({ status: 'success', data: { envVars: project.envVars } }) : notFound('Project not found');
  }
  if ((m = path.match(/^\/deployment\/([^/]+)$/))) {
    const dep = DEPLOYMENTS[decodeURIComponent(m[1])];
    return dep ? ok({ status: 'success', data: { deployment: dep } }) : notFound('Deployment not found');
  }
  if ((m = path.match(/^\/logs\/([^/]+)$/))) {
    return ok({ status: 'success', data: { logs: LOGS[decodeURIComponent(m[1])] || [] } });
  }
  if ((m = path.match(/^\/deployments\/([^/]+)\/diagnosis$/))) {
    const id = decodeURIComponent(m[1]);
    if (DIAGNOSES[id]) return ok(DIAGNOSES[id]);
    return DEPLOYMENTS[id] ? ok({ status: 'NOT_APPLICABLE' }) : notFound('Deployment not found');
  }
  return notFound('Not available in demo mode');
}
