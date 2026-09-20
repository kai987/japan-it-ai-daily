import type { APIRoute, GetStaticPaths } from 'astro';
import { getSearchIndex, searchJsonResponse } from '../../../lib/search-index-build';

export const getStaticPaths: GetStaticPaths = async () => [...(await getSearchIndex('ja')).shards]
  .map(([month, shard]) => ({ params: { month }, props: { shard } }));

export const GET: APIRoute = ({ props }) => searchJsonResponse(props.shard);
