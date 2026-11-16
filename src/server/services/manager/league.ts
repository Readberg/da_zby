// The league of the football manager, split by meaning (DAZBY-153); this file keeps the public
// exports in one place so the importers did not have to change.
export {
  toMatchSummary,
  getNextMatch,
  listMyMatches,
  getMatch,
  getLeagueView,
} from "./league-view";
export { resolveLineup, getLineup, saveLineup, saveTraining } from "./lineup";
export { placeClub } from "./league-setup";
export { playDueMatches, playAllDue, toState, type PlayerRow } from "./play-rounds";
