import { exportStudySnapshot } from '../../scripts/export-study-snapshot.mjs';
export const prerender = true;
export function GET() {
  return new Response(JSON.stringify(exportStudySnapshot()), { headers: {'Content-Type':'application/json; charset=utf-8'} });
}
