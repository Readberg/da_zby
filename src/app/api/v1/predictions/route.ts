import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { savePredictions } from "@/server/services/predictions";

export const PUT = withApi(endpoints.predictionsSave, async ({ supabase, user, body }) => ({
  data: await savePredictions(supabase, user!.id, body),
}));
