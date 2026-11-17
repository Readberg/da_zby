import { CLUB_COLORS } from "@/lib/manager/palette";
import { fetchAll } from "@/server/services/paginate";
import { createClub } from "@/server/services/manager/club";
import { getLineup, saveLineup } from "@/server/services/manager/lineup";
import {
  TEST_EMAIL_DOMAIN,
  createTestUser,
  serviceClient,
  signedInClient,
  type Db,
} from "../db/helpers";

export const DAY = 86_400_000;
export const START_BUDGET = 10_000;

export const admin = serviceClient();

export type Member = {
  index: number;
  userId: string;
  clubId: string;
  name: string;
  saved: boolean;
};
export type World = {
  members: Member[];
  leagueIds: string[];
  realClubIds: string[];
  squadSize: Map<string, number>;
  initialAge: Map<string, number>;
};

/** Throw-away local database: wipe what earlier runs left. */
export async function reset() {
  await admin.from("mgr_leagues").delete().not("id", "is", null);
  await admin.from("mgr_clubs").delete().not("id", "is", null);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) {
    if (user.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`)) await admin.auth.admin.deleteUser(user.id);
  }
}

/**
 * Real clubs in leagues of 20 (the first league is filled first, the rest of a league is bots).
 * With `saveLineups`, the clubs with an even number save their lineup, the others stay on the
 * automatic one: the two ways a manager can play.
 */
export async function seedWorld(users: number, saveLineups: boolean): Promise<World> {
  await reset();
  const { data: cities } = await admin.from("mgr_cities").select("id").limit(1);
  const cityId = cities![0]!.id;
  const members: Member[] = [];
  for (let i = 0; i < users; i += 1) {
    const user = await createTestUser(`sim${i}`);
    const client: Db = await signedInClient(user);
    const name = `Sim Club ${i + 1}`;
    const club = await createClub(admin, client, user.id, {
      name,
      cityId,
      primaryColor: CLUB_COLORS[0],
      secondaryColor: CLUB_COLORS[1],
    });
    let saved = false;
    if (saveLineups && i % 2 === 0) {
      const view = await getLineup(client, user.id);
      await saveLineup(admin, user.id, {
        formation: view.formation,
        mentality: view.mentality,
        playerIds: view.playerIds,
      });
      saved = true;
    }
    members.push({ index: i, userId: user.id, clubId: club.id, name, saved });
  }
  const clubs = await fetchAll((from, to) =>
    admin.from("mgr_clubs").select("id, league_id").order("id").range(from, to),
  );
  const leagueIds = [...new Set(clubs.map((c) => c.league_id).filter((id): id is string => !!id))];
  const players = await fetchAll((from, to) =>
    admin
      .from("mgr_players")
      .select("id, club_id, age")
      .not("club_id", "is", null)
      .order("id")
      .range(from, to),
  );
  const squadSize = new Map<string, number>();
  const initialAge = new Map<string, number>();
  for (const p of players) {
    squadSize.set(p.club_id!, (squadSize.get(p.club_id!) ?? 0) + 1);
    initialAge.set(p.id, p.age);
  }
  return { members, leagueIds, realClubIds: members.map((m) => m.clubId), squadSize, initialAge };
}
