import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import {
  createTournament,
  listTournaments,
  updateTournament,
} from "@/server/services/admin-tournaments";

export const GET = withApi(endpoints.adminTournamentsList, async ({ supabase }) => ({
  data: await listTournaments(supabase),
}));

export const POST = withApi(endpoints.adminTournamentCreate, async ({ supabase, body }) => {
  const data = await createTournament(supabase, body);
  invalidateRating();
  return { data };
});

export const PATCH = withApi(endpoints.adminTournamentUpdate, async ({ supabase, body }) => {
  const data = await updateTournament(supabase, body);
  invalidateRating();
  return { data };
});
