import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { recalculateTournament } from "@/server/services/admin-tournaments";

export const POST = withApi(endpoints.adminTournamentRecalculate, async ({ supabase, body }) => ({
  data: await recalculateTournament(supabase, body.tournamentId),
}));
