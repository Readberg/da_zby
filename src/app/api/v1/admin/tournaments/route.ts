import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import {
  createTournament,
  listTournaments,
  updateTournament,
} from "@/server/services/admin-tournaments";

export const GET = withApi(endpoints.adminTournamentsList, async ({ supabase }) => ({
  data: await listTournaments(supabase),
}));

export const POST = withApi(endpoints.adminTournamentCreate, async ({ supabase, body }) => ({
  data: await createTournament(supabase, body),
}));

export const PATCH = withApi(endpoints.adminTournamentUpdate, async ({ supabase, body }) => ({
  data: await updateTournament(supabase, body),
}));
