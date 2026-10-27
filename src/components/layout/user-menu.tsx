import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { UserIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/server/services/current-user";
import { getMessages } from "@/i18n/server";

const itemClass =
  "inline-flex min-h-11 items-center rounded-sm px-3 text-base font-semibold text-ink transition-colors duration-200 hover:bg-surface-hover sm:px-4";

/** Header slot: "Войти" for guests, nickname + sign-out for signed-in users. */
export async function UserMenu() {
  const t = getMessages();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/login"
        data-umami-event="cta-click"
        data-umami-event-where="header"
        className={buttonClasses("secondary", "gap-2 px-5")}
      >
        <UserIcon className="h-5 w-5" />
        {t.auth.login}
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
      <Link href="/profile" className={buttonClasses("secondary", "gap-2 px-5")}>
        <UserIcon className="h-5 w-5" />
        {t.auth.profile}
      </Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className={itemClass}>
          {t.auth.logout}
        </button>
      </form>
    </nav>
  );
}
