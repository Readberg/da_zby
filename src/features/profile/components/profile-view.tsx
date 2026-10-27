import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ProfileStats } from "@/features/rating/components/profile-stats";
import { countryName } from "@/lib/countries";
import { formatDate } from "@/lib/time";
import type { PublicProfile } from "@/server/services/public-profiles";
import type { StatsRow } from "@/server/services/rating";
import { getMessages, getLocale } from "@/i18n/server";

/** What everybody sees on a profile; the owner gets the same view plus an action slot. */
export function ProfileView({
  profile,
  stats,
  actions,
}: {
  profile: PublicProfile;
  stats: StatsRow[];
  actions?: ReactNode;
}) {
  const locale = getLocale();
  const t = getMessages();
  const place = [
    profile.countryCode ? countryName(profile.countryCode, locale) : null,
    profile.city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
        <Avatar src={profile.avatarUrl} name={profile.nickname} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="text-h3 normal-case sm:text-h2">{profile.nickname}</h1>
          {profile.fullName && <p className="text-lg">{profile.fullName}</p>}
          {place && <p className="text-muted">{place}</p>}
        </div>
        {actions && <div className="sm:ml-auto">{actions}</div>}
      </header>

      {profile.about && <p className="max-w-prose whitespace-pre-line">{profile.about}</p>}

      <dl className="grid max-w-md gap-1 text-sm">
        {profile.contact && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted">{t.publicProfile.contact}:</dt>
            <dd>{profile.contact}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted">{t.publicProfile.registered}:</dt>
          <dd>{formatDate(profile.createdAt, undefined, locale)}</dd>
        </div>
        {profile.lastLoginAt && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted">{t.publicProfile.lastLogin}:</dt>
            <dd>{formatDate(profile.lastLoginAt, undefined, locale)}</dd>
          </div>
        )}
      </dl>

      <Card title={t.publicProfile.statsTitle}>
        <ProfileStats rows={stats} />
      </Card>
    </div>
  );
}
