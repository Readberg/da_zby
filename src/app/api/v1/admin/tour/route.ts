import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getTour } from "@/server/services/admin-matches";

export const GET = withApi(endpoints.adminTourGet, async ({ supabase, query }) => ({
  data: await getTour(supabase, query.tourId),
}));
