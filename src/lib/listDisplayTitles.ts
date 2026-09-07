const formatJapaneseLongDate = (date: Date) => date.toLocaleDateString('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export const getDailyListDisplayTitle = (date: Date) =>
  `日本 IT/AI 日報｜${formatJapaneseLongDate(date)}`;

export const getJapaneseLessonListDisplayTitle = (date: Date) =>
  `日本語学習｜${formatJapaneseLongDate(date)}`;
