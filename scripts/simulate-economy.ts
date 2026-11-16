// Simulates seasons of one league of 20 clubs with the rules of the game and the money of the brief,
// to see where the budgets go (docs/ECONOMY.md). Run: pnpm exec tsx scripts/simulate-economy.ts [seasons] [seed]
// Every club trains its main attributes and plays its best lineup; nobody trades (the market is
// the next part), so this is the money of leagues, wages and prizes only.
import {
  overallRating,
  realRating,
  attributesOf,
  weightOf,
  type Attribute,
} from "@/lib/manager/attributes";
import { autoLineup } from "@/lib/manager/formations";
import {
  nominalValue,
  roundMoney,
  seasonPrize,
  START_BUDGET,
  roundWages,
} from "@/lib/manager/economy";
import { buildSchedule } from "@/lib/manager/schedule";
import { computeTable } from "@/lib/manager/table";
import { computeEffects, outcomeOf, type PlayerState } from "@/server/services/manager/effects";
import { simulateMatch } from "@/server/services/manager/engine";
import { makeRandom } from "@/server/services/manager/random";
import { generateSquad } from "@/server/services/manager/squad";

const SEASONS = Number(process.argv[2] ?? 6);
const SEED = process.argv[3] ?? "economy";
const CLUBS = 20;

type Club = { id: string; name: string; budget: number; players: PlayerState[] };

function focusOf(player: PlayerState): Attribute | null {
  // The most important attribute of the position that is still the lowest: what a careful manager trains.
  const keys = attributesOf(player.position).filter((k) => weightOf(player.position, k) >= 2);
  return keys.sort((a, b) => (player.attributes[a] ?? 0) - (player.attributes[b] ?? 0))[0] ?? null;
}

function makeClubs(): Club[] {
  return Array.from({ length: CLUBS }, (_, c) => ({
    id: `c${String(c).padStart(2, "0")}`,
    name: `Club ${c}`,
    budget: START_BUDGET,
    players: generateSquad(`${SEED}-${c}`, "BY").map((p, i) => ({
      id: `c${c}-p${i}`,
      position: p.position,
      age: p.age,
      ovr: p.ovr,
      form: 80,
      fitness: 80,
      morale: 80,
      idleRounds: 0,
      injuredUntil: null,
      potential: p.potential,
      trainingFocus: null,
      attributes: p.attributes,
    })),
  }));
}

const clubs = makeClubs();
const byId = new Map(clubs.map((c) => [c.id, c]));
const fixtures = buildSchedule();
const day = 86_400_000;
const start = new Date("2026-12-01T07:00:00Z").getTime();

const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    min: sorted[0]!,
    median: sorted[Math.floor(sorted.length / 2)]!,
    mean,
    max: sorted.at(-1)!,
  };
};
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

console.log(`Seasons: ${SEASONS}, seed: ${SEED}, clubs: ${CLUBS}`);
for (let season = 1; season <= SEASONS; season += 1) {
  const results: {
    homeClubId: string;
    awayClubId: string;
    homeGoals: number;
    awayGoals: number;
  }[] = [];
  const earned = new Map(clubs.map((c) => [c.id, 0]));
  const wagePaid = new Map(clubs.map((c) => [c.id, 0]));
  const seasonStart = start + (season - 1) * 44 * day;

  for (const club of clubs) for (const p of club.players) p.trainingFocus = focusOf(p);

  for (let round = 1; round <= 38; round += 1) {
    const kickoff = new Date(seasonStart + (round - 1) * day);
    for (const f of fixtures.filter((x) => x.round === round)) {
      const home = clubs[f.home]!;
      const away = clubs[f.away]!;
      const side = (club: Club) => {
        const healthy = club.players.filter(
          (p) => !p.injuredUntil || p.injuredUntil.getTime() <= kickoff.getTime(),
        );
        const rated = (list: PlayerState[]) =>
          list.map((p) => ({ id: p.id, position: p.position, real: realRating(p.ovr, p) }));
        const lineup = autoLineup(rated(healthy)) ?? autoLineup(rated(club.players))!;
        const chosen = new Set(lineup.playerIds);
        return {
          chosen,
          side: {
            mentality: "balanced" as const,
            players: club.players
              .filter((p) => chosen.has(p.id))
              .map((p) => ({
                id: p.id,
                name: `X ${p.id}`,
                position: p.position,
                real: realRating(p.ovr, p),
              })),
          },
        };
      };
      const h = side(home);
      const a = side(away);
      const match = simulateMatch(`${season}-${round}-${home.id}-${away.id}`, h.side, a.side);
      results.push({
        homeClubId: home.id,
        awayClubId: away.id,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
      });

      for (const [club, own, other, chosen, isHome, key] of [
        [home, match.homeGoals, match.awayGoals, h.chosen, true, "home"],
        [away, match.awayGoals, match.homeGoals, a.chosen, false, "away"],
      ] as const) {
        const money = roundMoney({
          home: isHome,
          outcome: outcomeOf(own, other),
          squad: club.players,
        });
        for (const entry of money) {
          club.budget += entry.amount;
          earned.set(club.id, earned.get(club.id)! + entry.amount);
          if (entry.reason === "wages")
            wagePaid.set(club.id, wagePaid.get(club.id)! - entry.amount);
        }
        const effects = computeEffects({
          seed: `${season}-${round}-${club.id}`,
          kickoff,
          players: club.players,
          played: chosen,
          outcome: outcomeOf(own, other),
          injuries: new Map(
            match.injuries.filter((i) => i.side === key).map((i) => [i.playerId, i.days]),
          ),
        });
        for (const e of effects) {
          const p = club.players.find((x) => x.id === e.id)!;
          p.form = e.form;
          p.fitness = e.fitness;
          p.morale = e.morale;
          p.idleRounds = e.idle_rounds;
          if (e.injured_until) p.injuredUntil = new Date(e.injured_until);
          if (e.attributes) {
            Object.assign(p.attributes, e.attributes);
            p.ovr = overallRating(p.position, p.attributes);
          }
        }
      }
    }
  }

  const table = computeTable(
    clubs.map((c) => ({ id: c.id, name: c.name })),
    results,
  );
  table.forEach((row, index) => {
    byId.get(row.clubId)!.budget += seasonPrize(index + 1);
    earned.set(row.clubId, earned.get(row.clubId)! + seasonPrize(index + 1));
  });

  const budgets = stats(clubs.map((c) => c.budget));
  const nominal = stats(
    clubs.map((c) => c.players.reduce((s, p) => s + nominalValue(p.ovr, p.age), 0)),
  );
  const net = stats([...earned.values()]);
  const wages = stats([...wagePaid.values()].map((w) => w / 38));
  const best = byId.get(table[0]!.clubId)!;
  const worst = byId.get(table[19]!.clubId)!;
  console.log(
    `\nSeason ${season}\n` +
      `  budget  min ${fmt(budgets.min)}  median ${fmt(budgets.median)}  mean ${fmt(budgets.mean)}  max ${fmt(budgets.max)}  below zero: ${clubs.filter((c) => c.budget < 0).length}\n` +
      `  net of the season (all income minus wages, with the prize)  min ${fmt(net.min)}  mean ${fmt(net.mean)}  max ${fmt(net.max)}\n` +
      `  squad nominal value  min ${fmt(nominal.min)}  mean ${fmt(nominal.mean)}  max ${fmt(nominal.max)}   wage of a round  mean ${wages.mean.toFixed(0)}  max ${fmt(wages.max)}\n` +
      `  champion: net ${fmt(earned.get(best.id)!)}, budget ${fmt(best.budget)}   last: net ${fmt(earned.get(worst.id)!)}, budget ${fmt(worst.budget)}\n` +
      `  one round of wages for the average club: ${roundWages(clubs[0]!.players)}`,
  );

  // The next season: everybody a year older, the state back to 80.
  const random = makeRandom(`${SEED}-age-${season}`);
  for (const club of clubs) {
    for (const p of club.players) {
      p.age += 1;
      p.form = p.fitness = p.morale = 80;
      p.idleRounds = 0;
      p.injuredUntil = null;
      if (p.age > 33 && random() < 0.5 + 0.05 * (p.age - 34)) {
        // Retired: a young player of the same position takes the place (as in the game).
        p.age = 18;
        p.ovr = 48;
        p.potential = 75;
        p.attributes = Object.fromEntries(attributesOf(p.position).map((k) => [k, 48]));
      }
    }
  }
}
