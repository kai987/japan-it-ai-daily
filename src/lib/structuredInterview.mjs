/**
 * @typedef {{id:string, articleIds:string[], question:string, answer:string}} InterviewItem
 * @typedef {{id:string, articleIds:string[], question:string, points:{zh:string,ja:string}}} ReviewItem
 * @typedef {{schemaVersion:1, date:string, interview:InterviewItem[], review:ReviewItem[]}} StructuredInterview
 */
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const idPattern = /^[a-z][a-z0-9-]*$/;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.length > 0 && value === value.trim() && !/[\r\n]/.test(value);
const keys = (value, allowed, label) => {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`${label}: unknown field or invalid object`);
};

/** @param {unknown} input @param {string} date @returns {StructuredInterview} */
export function validateStructuredInterview(input, date) {
  keys(input, ['schemaVersion', 'date', 'interview', 'review'], 'interview document');
  const record = /** @type {StructuredInterview} */ (input);
  if (record.schemaVersion !== 1 || !datePattern.test(date) || record.date !== date
    || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error(`${date}: unsupported schema or mismatched/invalid date`);
  }
  const ids = new Set();
  for (const kind of ['interview', 'review']) {
    const items = record[kind];
    const expectedCount = kind === 'interview' ? 5 : 3;
    if (!Array.isArray(items) || items.length !== expectedCount) throw new Error(`${date}: ${kind} requires ${expectedCount} items`);
    for (const item of items) {
      keys(item, kind === 'interview' ? ['id','articleIds','question','answer'] : ['id','articleIds','question','points'], kind);
      if (!text(item.id) || !idPattern.test(item.id) || ids.has(item.id)) throw new Error(`${date}: invalid or duplicate item id`);
      ids.add(item.id);
      if (!Array.isArray(item.articleIds) || !item.articleIds.length
        || item.articleIds.some(id => !text(id)) || new Set(item.articleIds).size !== item.articleIds.length) {
        throw new Error(`${date}/${item.id}: invalid articleIds`);
      }
      if (!text(item.question)) throw new Error(`${date}/${item.id}: missing question`);
      if (kind === 'interview') {
        if (!text(item.answer)) throw new Error(`${date}/${item.id}: missing answer`);
      } else {
        keys(item.points, ['zh','ja'], 'review points');
        if (!text(item.points.zh) || !text(item.points.ja)) throw new Error(`${date}/${item.id}: both review-point locales are required`);
      }
    }
  }
  return record;
}

/** @param {StructuredInterview} record @returns {string[]} */
export const structuredAnswers = (record) => record.interview.map(item => item.answer);
/** @param {StructuredInterview} record @param {'zh'|'ja'} locale */
export const structuredReviewCards = (record, locale) => record.review.map(item => ({ question: item.question, points: item.points[locale] }));
/** Preserve the legacy question/answer order so audio filenames and hashes do not shift. @param {StructuredInterview} record */
export const structuredAudioItems = (record) => record.interview.flatMap(item => [
  { type: 'question', text: item.question }, { type: 'answer', text: item.answer },
]);
