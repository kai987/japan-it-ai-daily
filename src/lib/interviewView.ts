import { extractAnswers, extractReviewCards } from './interview';
import { structuredAnswers, structuredReviewCards } from './structuredInterview.mjs';
import type { StructuredInterview } from './structuredInterview.mjs';

/** Structured dates do not depend on headings or punctuation; legacy dates keep their existing parser. */
export function resolveInterviewView(body: string, structured: StructuredInterview | null, locale: 'zh' | 'ja') {
  return structured
    ? { answers: structuredAnswers(structured), reviewCards: structuredReviewCards(structured, locale) }
    : { answers: extractAnswers(body), reviewCards: extractReviewCards(body) };
}
