import { allowRequest, clientIp } from "@/lib/rate-limit";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";

const MINUTE = 60_000;

/**
 * Generous limits on what changes the game (D-138): an honest player never meets them, a script
 * that hammers an endpoint does. [calls, window in ms] per user and address.
 */
export const MANAGER_LIMITS = {
  bid: [30, MINUTE],
  buy: [20, MINUTE],
  list: [20, MINUTE],
  cancelLot: [30, MINUTE],
  proposeTrade: [20, MINUTE],
  answerTrade: [30, MINUTE],
  extendContract: [30, MINUTE],
  terminateContract: [20, MINUTE],
  logo: [10, 10 * MINUTE],
  lineup: [30, MINUTE],
  training: [30, MINUTE],
  friendly: [10, MINUTE],
  confirmReturn: [10, MINUTE],
} as const satisfies Record<string, readonly [number, number]>;

export type ManagerAction = keyof typeof MANAGER_LIMITS;

/** Throws 429 when the user (from this address) calls the action too often. */
export function enforceLimit(
  request: { headers: Pick<Headers, "get"> },
  userId: string,
  action: ManagerAction,
  now = Date.now(),
): void {
  const [limit, windowMs] = MANAGER_LIMITS[action];
  if (
    !allowRequest(`manager-${action}:${userId}:${clientIp(request.headers)}`, limit, windowMs, now)
  ) {
    throw new ApiError(
      429,
      ERROR_CODES.tooManyRequests,
      "Too Many Requests",
      "Too many requests. Wait a moment and try again.",
    );
  }
}
