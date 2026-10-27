import { serverEnv } from "@/lib/env.server";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import { applyFixtures, previewFixtures } from "@/server/services/admin-fixtures";
import { fetchRound } from "@/server/services/fixtures-source";

const deps = () => ({ fetchRound, apiKey: serverEnv.THESPORTSDB_API_KEY });

export const GET = withApi(endpoints.adminFixturesPreview, async ({ supabase, query }) => ({
  data: await previewFixtures(supabase, query, deps()),
}));

export const POST = withApi(endpoints.adminFixturesApply, async ({ supabase, body }) => {
  const data = await applyFixtures(supabase, body, deps());
  invalidateRating();
  return { data };
});
