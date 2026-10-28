import Link from "next/link";
import { UserIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/server/services/current-user";
import { getMessages } from "@/i18n/server";

const itemClass =
  "inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-semibold uppercase tracking-wide text-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink";

/** The person icon: the way to the sign-in page or to the profile. */
const iconClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink";

/** Header slot: the person icon for guests; for signed-in users the profile icon and sign-out. */
export async function UserMenu() {
  const t = getMessages();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/login"
        data-umami-event="cta-click"
        data-umami-event-where="header"
        aria-label={t.auth.login}
        className={iconClass}
      >
        <UserIcon className="h-6 w-6" />
      </Link>
    );
  }

  return (
    <nav aria-label={t.auth.userMenu} className="flex items-center gap-1">
      {user.role === "admin" && (
        <Link href="/admin" className={itemClass}>
          {t.auth.adminPanel}
        </Link>
      )}
      <Link href="/profile" aria-label={t.auth.profile} className={iconClass}>
        <UserIcon className="h-6 w-6" />
      </Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className={itemClass}>
          {t.auth.logout}
        </button>
      </form>
    </nav>
  );
}
