import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validDate, requiredFiles, requiredSidecars, POLICY } from './daily-publication.mjs';

export const REQUEST_BRANCH = 'automation/daily-publish-request';
export const REQUEST_PATH = '.github/daily-publication-request.json';
export const PUBLISHER_WORKFLOW_PATH = '.github/workflows/publish-daily.yml';
export const PLATFORM_REPAIR_ALLOWLIST = Object.freeze([
  'src/components/ReportSpeechEnhancer.astro',
  'src/components/pages/ReportPage.astro',
]);

const SHA = /^[a-f0-9]{40}$/;
const BRANCH = /^draft\/daily-(\d{4}-\d{2}-\d{2})$/;

const zonedInstant = (value) => {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value)) throw new Error('requestedAt must include a timezone');
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Invalid requestedAt');
  return value;
};
const strings = (value, name) => {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item)) throw new Error(`${name} must be a string array`);
  if (new Set(value).size !== value.length) throw new Error(`${name} contains duplicates`);
  return value;
};
const sameSet = (a, b) => a.length === b.length && a.every(value => b.includes(value));

export const requiredPublishPaths = (date) => [...requiredFiles(validDate(date)), ...requiredSidecars(date)];

export function validatePublicationRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Publication request must be an object');
  if (request.schemaVersion !== 1) throw new Error('Unsupported publication request schema');
  const targetDate = validDate(request.targetDate);
  if (!SHA.test(request.baseCommit || '') || !SHA.test(request.draftCommit || '')) throw new Error('baseCommit and draftCommit must be full Git SHAs');
  if (!Number.isSafeInteger(request.preflightRunId) || request.preflightRunId <= 0) throw new Error('preflightRunId must be a positive integer');
  if (request.preflightWorkflowPath !== POLICY.workflowPath) throw new Error('Unexpected preflight workflow');
  zonedInstant(request.requestedAt);
  if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9._:-]{8,160}$/.test(request.requestId)) throw new Error('Invalid requestId');

  const branchMatch = typeof request.draftBranch === 'string' ? request.draftBranch.match(BRANCH) : null;
  if (!branchMatch || branchMatch[1] !== targetDate) throw new Error('draftBranch must be draft/daily-targetDate');

  const files = strings(request.files, 'files');
  const required = requiredPublishPaths(targetDate);
  if (!sameSet(files, required)) throw new Error('files must contain exactly the six target publication paths');

  const repairPaths = strings(request.platformRepairPaths ?? [], 'platformRepairPaths');
  if (request.platformRepair === true) {
    if (!repairPaths.length) throw new Error('platformRepair=true requires at least one repair path');
    for (const path of repairPaths) {
      if (!PLATFORM_REPAIR_ALLOWLIST.includes(path)) throw new Error(`Platform repair path is not allowed: ${path}`);
    }
  } else if (request.platformRepair === false || request.platformRepair === undefined) {
    if (repairPaths.length) throw new Error('platformRepairPaths require platformRepair=true');
  } else {
    throw new Error('platformRepair must be boolean when provided');
  }

  const overlap = repairPaths.filter(path => files.includes(path));
  if (overlap.length) throw new Error('Publication and repair paths must not overlap');

  return {
    ...request,
    targetDate,
    files,
    platformRepair: request.platformRepair === true,
    platformRepairPaths: repairPaths,
  };
}

export const requestedPaths = (request) => {
  const valid = validatePublicationRequest(request);
  return [...valid.files, ...valid.platformRepairPaths];
};

export function assertCandidateWorktree(request, root = process.cwd()) {
  const valid = validatePublicationRequest(request);
  for (const path of requestedPaths(valid)) {
    if (!existsSync(resolve(root, path))) throw new Error(`Requested path is missing from candidate worktree: ${path}`);
  }
  return valid;
}

function load(filename) {
  return JSON.parse(readFileSync(filename, 'utf8'));
}
function envLine(name, value) {
  if (/\r|\n/.test(String(value))) throw new Error(`Unsafe environment value: ${name}`);
  return `${name}=${value}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, filename] = process.argv.slice(2);
    if (!command || !filename) throw new Error('Usage: node scripts/daily-publisher.mjs <validate|env|paths|candidate> request.json');
    const request = validatePublicationRequest(load(filename));
    if (command === 'validate') {
      console.log(JSON.stringify(request, null, 2));
    } else if (command === 'paths') {
      console.log(requestedPaths(request).join('\n'));
    } else if (command === 'candidate') {
      assertCandidateWorktree(request);
      console.log(`Candidate contains ${requestedPaths(request).length} requested path(s).`);
    } else if (command === 'env') {
      console.log([
        envLine('TARGET_DATE', request.targetDate),
        envLine('BASE_COMMIT', request.baseCommit),
        envLine('DRAFT_BRANCH', request.draftBranch),
        envLine('DRAFT_COMMIT', request.draftCommit),
        envLine('PREFLIGHT_RUN_ID', request.preflightRunId),
        envLine('PREFLIGHT_WORKFLOW_PATH', request.preflightWorkflowPath),
        envLine('REQUEST_ID', request.requestId),
      ].join('\n'));
    } else {
      throw new Error('Unknown command');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
