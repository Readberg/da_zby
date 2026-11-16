import { ClubLogo } from "@/components/ui/club-logo";
import { ClubColors } from "./club-colors";

/** The sign of a club: its own logo when it has one, otherwise the two colours of the club. */
export function ClubBadge({
  logoUrl,
  primary,
  secondary,
  name,
  size = "sm",
}: {
  logoUrl?: string | null;
  primary: string;
  secondary: string;
  name: string;
  size?: "sm" | "md";
}) {
  if (logoUrl) return <ClubLogo src={logoUrl} name={name} size={size === "sm" ? 20 : 40} />;
  return <ClubColors primary={primary} secondary={secondary} size={size} />;
}
