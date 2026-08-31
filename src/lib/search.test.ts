import { describe, expect, it } from 'vitest';
import {
  cleanSearchSegment,
  reportSegments,
  searchItems,
  type SearchItem,
} from './search';

const makeReport = (
  date: string,
  segments: string[],
  options: Partial<SearchItem> = {},
): SearchItem => ({
  id: `report-${date}`,
  kind: 'report',
  title: `日本 IT / AI 日报｜${date}`,
  source: '日报',
  topic: '全文',
  why: '',
  date,
  href: `/daily/${date}/`,
  external: false,
  reportTitle: `日本 IT / AI 日报｜${date}`,
  reportDescription: '',
  reportTopics: [],
  segments,
  ...options,
});

const makeArticle = (
  id: string,
  date: string,
  title: string,
  options: Partial<SearchItem> = {},
): SearchItem => ({
  id,
  kind: 'article',
  title,
  source: 'CodeZine',
  topic: 'Agent Security / Sandbox',
  why: 'OS sandbox should enforce the runtime boundary.',
  date,
  href: 'https://example.com/article',
  external: true,
  reportTitle: `日本 IT / AI 日报｜${date}`,
  reportDescription: '',
  reportTopics: ['Agent Security'],
  segments: [],
  ...options,
});

describe('search text preparation', () => {
  it('cleans common Markdown syntax while preserving searchable prose', () => {
    expect(cleanSearchSegment('### 重点\n- 最小权限 + **Sandbox** [说明](https://example.com)'))
      .toBe('重点 最小权限 + Sandbox 说明');
  });

  it('splits a report into searchable text segments', () => {
    expect(reportSegments('## A\n\n第一段。\n\n- 第二段 Sandbox。'))
      .toEqual(['A', '第一段。', '第二段 Sandbox。']);
  });
});

describe('search ranking regressions', () => {
  it('keeps a dedicated Sandbox article highly ranked while ordering full-text report hits newest first', () => {
    const items: SearchItem[] = [
      makeReport(
        '2026-08-19',
        ['Zed Sandbox：OS Sandbox 强制限制 Agent。'],
        { reportDescription: 'AWS Continuum、Zed Sandbox、MCP vs Direct API。' },
      ),
      makeReport('2026-08-31', ['如果只会回答“最小权限 + Sandbox”，已经不够完整。']),
      makeReport('2026-08-29', ['Agent 应该在 Sandbox 中运行。']),
      makeArticle('2026-08-19-2', '2026-08-19', 'Zed Agent Panel：用 OS Sandbox 强制限制 Agent'),
    ];

    const results = searchItems(items, 'Sandbox');
    expect(results.map((item) => item.id)).toEqual([
      '2026-08-19-2',
      'report-2026-08-31',
      'report-2026-08-29',
      'report-2026-08-19',
    ]);
  });

  it('returns the matching report context used by the search candidate', () => {
    const result = searchItems([
      makeReport('2026-08-31', [
        '面试时如果只会回答“最小权限 + Sandbox”，已经不够完整；还要说明怎样发现 Agent 正在尝试突破边界。',
      ]),
    ], 'Sandbox')[0];

    expect(result?.id).toBe('report-2026-08-31');
    expect(result?.matchSnippet).toContain('最小权限 + Sandbox');
  });

  it('normalizes full-width and case differences', () => {
    const results = searchItems([
      makeReport('2026-08-31', ['ＳＡＮＤＢＯＸ と Sandbox の境界。']),
    ], 'sandbox');

    expect(results[0]?.id).toBe('report-2026-08-31');
  });
});
