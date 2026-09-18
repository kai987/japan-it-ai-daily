import { titleWithIssue } from '../../scripts/learning-review.mjs';
const formatJapaneseLongDate = (date: Date) => date.toLocaleDateString('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export const getDailyListDisplayTitle = (date: Date) =>
  titleWithIssue(`日本 IT/AI 日報｜${formatJapaneseLongDate(date)}`, date);

export const getJapaneseLessonListDisplayTitle = (date: Date) =>
  titleWithIssue(`日本語学習｜${formatJapaneseLongDate(date)}`, date);
