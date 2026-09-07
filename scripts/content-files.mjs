import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const contentDirs = ['daily', 'daily-ja', 'japanese', 'japanese-ja'];
export const readContent = (root, dir, date) => {
  const source = readFileSync(join(root, 'src/content', dir, `${date}.md`), 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) throw new Error(`${dir}/${date}: missing frontmatter`);
  return { data: parse(frontmatter[1]), body: source.slice(frontmatter[0].length) };
};
export const contentDates = (root) => [...new Set(contentDirs.flatMap((dir) => readdirSync(join(root, 'src/content', dir))))]
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).map((name) => name.slice(0, 10)).sort();
