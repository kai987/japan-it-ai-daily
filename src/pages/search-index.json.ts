import { getSearchIndex, searchJsonResponse } from '../lib/search-index-build';

export const GET = async () => searchJsonResponse((await getSearchIndex('zh')).manifest);
