import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";

type Rule = [status: 404 | 409 | 422, code: string, detail: string];

/** What the database says (manager.*) and what the API answers. */
const RULES: Record<string, Rule> = {
  "manager.club_unknown": [404, ERROR_CODES.notFound, "You have no club yet."],
  "manager.auction_unknown": [
    404,
    ERROR_CODES.managerAuctionUnknown,
    "No such lot in your league.",
  ],
  "manager.trade_unknown": [404, ERROR_CODES.managerTradeUnknown, "No such offer for your club."],
  "manager.market_closed": [
    409,
    ERROR_CODES.managerMarketClosed,
    "The market opens after 10 played matches.",
  ],
  "manager.player_unavailable": [
    409,
    ERROR_CODES.managerPlayerUnavailable,
    "The player is not available for this.",
  ],
  "manager.player_locked": [
    409,
    ERROR_CODES.managerPlayerLocked,
    "A bought or exchanged player cannot be put up for a week.",
  ],
  "manager.contract_ending": [
    409,
    ERROR_CODES.managerContractEnding,
    "A player whose contract ends in under half a season, or who retires, cannot be sold or exchanged.",
  ],
  "manager.squad_min": [409, ERROR_CODES.managerSquadMin, "A squad keeps 17 players at least."],
  "manager.squad_full": [409, ERROR_CODES.managerSquadFull, "A squad has 23 players at most."],
  "manager.squad_size": [
    409,
    ERROR_CODES.managerSquadSize,
    "After the deal both squads must have 17 to 23 players.",
  ],
  "manager.lots_limit": [
    409,
    ERROR_CODES.managerLotsLimit,
    "At most 5 open lots or offers at once.",
  ],
  "manager.auction_closed": [409, ERROR_CODES.managerAuctionClosed, "The lot is closed."],
  "manager.bid_too_low": [409, ERROR_CODES.managerBidTooLow, "The bid is below the least allowed."],
  "manager.own_auction": [409, ERROR_CODES.managerOwnAuction, "You cannot bid on your own lot."],
  "manager.bid_leading": [
    409,
    ERROR_CODES.managerBidLeading,
    "Your club already has the best bid.",
  ],
  "manager.has_bids": [409, ERROR_CODES.managerHasBids, "A lot with a bid cannot be taken off."],
  "manager.pool_by_bids": [
    409,
    ERROR_CODES.managerPoolByBids,
    "Free players of the pool are bought by bids on the auction.",
  ],
  "manager.no_money": [
    409,
    ERROR_CODES.managerNoMoney,
    "Not enough money (or the club is in debt).",
  ],
  "manager.deal_limit": [409, ERROR_CODES.managerDealLimit, "One deal with one club a season."],
  "manager.trade_closed": [409, ERROR_CODES.managerTradeClosed, "The offer is no longer open."],
  "manager.offer_used": [409, ERROR_CODES.managerOfferUsed, "One offer a season for a player."],
  "manager.price_invalid": [
    422,
    ERROR_CODES.managerPriceInvalid,
    "The price must be from half to twice the nominal value.",
  ],
  "manager.step_invalid": [
    422,
    ERROR_CODES.managerStepInvalid,
    "The step is 10, 20 or 30 percent.",
  ],
  "manager.cash_invalid": [422, ERROR_CODES.managerCashInvalid, "The money on top is too much."],
  "manager.trade_invalid": [422, ERROR_CODES.managerTradeInvalid, "The offer is not valid."],
  "manager.contract_invalid": [
    422,
    ERROR_CODES.managerContractInvalid,
    "A new contract can be offered with from half a season to 2 seasons left.",
  ],
};

const TITLES = { 404: "Not Found", 409: "Conflict", 422: "Unprocessable Entity" } as const;

/** Turns an error of a market function of the database into an API error; anything else is thrown as it is. */
export function marketError(error: { message: string }): never {
  for (const [key, [status, code, detail]] of Object.entries(RULES)) {
    if (error.message.includes(key)) throw new ApiError(status, code, TITLES[status], detail);
  }
  throw error;
}
