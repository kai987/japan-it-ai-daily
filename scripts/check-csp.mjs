import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../dist/', import.meta.url);
const configuredAudioBase = process.env.PUBLIC_AUDIO_BASE_URL?.trim() || '';
let expectedAudioOrigin = '';

if (configuredAudioBase) {
  const audioUrl = new URL(configuredAudioBase);
  if (audioUrl.protocol !== 'https:') {
    throw new Error('PUBLIC_AUDIO_BASE_URL must use HTTPS');
  }
  expectedAudioOrigin = audioUrl.origin;
}

const collectHtml = async (dirUrl) => {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dirUrl);
    if (entry.isDirectory()) files.push(...await collectHtml(child));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(child);
  }
  return files;
};

const sha256Source = (value) => {
  const digest = createHash('sha256').update(value, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
};

const directiveValue = (csp, name) =>
  csp.match(new RegExp(`(?:^|;)\\s*${name}\\s+([^;]+)`, 'i'))?.[1] ?? '';

const isExecutableInlineScript = (attrs) => {
  if (/\bsrc\s*=/.test(attrs)) return false;
  const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
  const type = typeMatch?.[1]?.toLowerCase() ?? '';
  return type !== 'application/json' && type !== 'application/ld+json';
};

const failures = [];
const htmlFiles = await collectHtml(root);

for (const fileUrl of htmlFiles) {
  const html = await readFile(fileUrl, 'utf8');
  const cspMatch = html.match(/<meta\s+http-equiv=["']content-security-policy["']\s+content=(["'])([\s\S]*?)\1[^>]*>/i);
  if (!cspMatch) {
    failures.push(`${fileUrl.pathname}: missing Content-Security-Policy meta tag`);
    continue;
  }

  const csp = cspMatch[2];
  const scriptElements = directiveValue(csp, 'script-src-elem') || directiveValue(csp, 'script-src');
  if (!scriptElements) {
    failures.push(`${fileUrl.pathname}: missing script-src-elem/script-src directive`);
    continue;
  }
  if (scriptElements.includes("'unsafe-inline'")) {
    failures.push(`${fileUrl.pathname}: script element policy must not contain 'unsafe-inline'`);
  }

  const scriptAttributes = directiveValue(csp, 'script-src-attr');
  if (!scriptAttributes.includes("'none'")) {
    failures.push(`${fileUrl.pathname}: script-src-attr must contain 'none'`);
  }

  const mediaSources = directiveValue(csp, 'media-src');
  if (!mediaSources.includes("'self'")) {
    failures.push(`${fileUrl.pathname}: media-src must contain 'self'`);
  }
  if (expectedAudioOrigin && !mediaSources.split(/\s+/).includes(expectedAudioOrigin)) {
    failures.push(`${fileUrl.pathname}: media-src must allow configured audio origin ${expectedAudioOrigin}`);
  }

  const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const attrs = match[1] ?? '';
    const source = match[2] ?? '';
    if (!isExecutableInlineScript(attrs)) continue;
    const hash = sha256Source(source);
    if (!scriptElements.includes(hash)) {
      failures.push(`${fileUrl.pathname}: CSP does not allow inline script ${hash}`);
    }
  }
}

if (failures.length) {
  console.error(`CSP verification failed with ${failures.length} issue(s):`);
  failures.slice(0, 30).forEach((failure) => console.error(`- ${failure}`));
  if (failures.length > 30) console.error(`- ... ${failures.length - 30} more`);
  process.exit(1);
}

console.log(`CSP verification passed for ${htmlFiles.length} HTML files.`);
if (expectedAudioOrigin) console.log(`Configured audio CDN allowed by media-src: ${expectedAudioOrigin}`);
