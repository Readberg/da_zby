/** The nav with its texts and links, for a server component. */
export function marketNavItems(t: {
  free: string;
  auction: string;
  squad: string;
  trades: string;
}) {
  return [
    { href: "/manager/market", label: t.free },
    { href: "/manager/market/auction", label: t.auction },
    { href: "/manager/market/squad", label: t.squad },
    { href: "/manager/market/trades", label: t.trades },
  ];
}
