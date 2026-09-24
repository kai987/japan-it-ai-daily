import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PUBLISHER_TRAILER = 'Daily-Publisher: .github/workflows/publish-daily.yml';
export const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

const publicationPatterns = [
  /^src\/content\/(?:daily|daily-ja|japanese|japanese-ja)\/\d{4}-\d{2}-\d{2}\.md$/,
  /^src\/content\/evidence\/\d{4}-\d{2}-\d{2}\.json$/,
  /^src\/data\/interviews\/\d{4}-\d{2}-\d{2}\.json$/,
];

export function isDailyPublicationPath(path) {
  return publicationPatterns.some((pattern) => pattern.test(path));
}

export function verifyPublisherOrigin({ changedPaths, message, authorEmail }) {
  if (!Array.isArray(changedPaths) || changedPaths.some((path) => typeof path !== 'string')) {
    throw new Error('changedPaths must be a string array');
  }
  const publicationPaths = changedPaths.filter(isDailyPublicationPath);
  if (!publicationPaths.length) return { publicationPaths: [], enforced: false };
  if (authorEmail !== BOT_EMAIL) throw new Error('Daily publication paths may only be committed by github-actions[bot]');
  const lines = String(message || '').split(/\r?\n/).map((line) => line.trim());
  if (!lines.includes(PUBLISHER_TRAILER)) throw new Error('Daily publication commit is missing the publisher trailer');
  const requestLines = lines.filter((line) => line.startsWith('Publication-Request: '));
  if (requestLines.length !== 1 || requestLines[0].slice('Publication-Request: '.length).trim().length < 8) {
    throw new Error('Daily publication commit must contain exactly one Publication-Request trailer');
  }
  return { publicationPaths, enforced: true };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/);
    if (parents.length < 2) throw new Error('Cannot verify publisher origin for a commit without a parent');
    const changedPaths = git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD^', 'HEAD')
      .split(/\r?\n/).filter(Boolean);
    const result = verifyPublisherOrigin({
      changedPaths,
      message: git('log', '-1', '--format=%B'),
      authorEmail: git('log', '-1', '--format=%ae'),
    });
    console.log(result.enforced
      ? `Verified unique daily publisher for ${result.publicationPaths.length} publication path(s).`
      : 'No daily publication paths changed in this main commit.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
