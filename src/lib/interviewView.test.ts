import { describe, it, expect } from 'vitest';
import { resolveInterviewView } from './interviewView';
import { extractAnswers, extractReviewCards } from './interview';
import { readStructuredInterview } from '../../scripts/structured-interview.mjs';
import { readContent } from '../../scripts/content-files.mjs';

describe('structured interview view adapter', () => {
  const record = readStructuredInterview('2026-09-18');
  for (const locale of ['zh', 'ja'] as const) {
    it(`${locale}: preserves the actual report's answers and localized review points`, () => {
      const { body } = readContent(process.cwd(), locale === 'ja' ? 'daily-ja' : 'daily', '2026-09-18');
      expect(resolveInterviewView(body, record, locale)).toEqual({ answers: extractAnswers(body), reviewCards: extractReviewCards(body) });
      expect(resolveInterviewView('Presentation headings can now change freely.', record, locale))
        .toEqual(resolveInterviewView(body, record, locale));
    });
  }
  it('preserves the legacy view when there is no structured record', () => {
    const { body } = readContent(process.cwd(), 'daily', '2026-09-17');
    expect(resolveInterviewView(body, null, 'zh')).toEqual({ answers: extractAnswers(body), reviewCards: extractReviewCards(body) });
  });
});
