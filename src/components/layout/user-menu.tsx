import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { UserIcon } from "@/components/ui/icons";
import { ru } from "@/messages/ru";
import { getCurrentUser } from "@/server/services/current-user";

const itemClass =
  "inline-flex min-h-11 items-center rounded-full px-3 text-base sm:px-4 font-medium text-ink transition-colors duration-200 hover:bg-surface";

/** Header slot: "Войти" for guests, nickname + sign-out for signed-in users. */
export async function UserMenu() {
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
        {ru.auth.login}
      </Link>
    );
  }

  return (
    <nav aria-label={ru.auth.userMenu} className="flex items-center gap-1">
      {user.role === "admin" && (
        <Link href="/admin" className={itemClass}>
          {ru.admin.title}
        </Link>
      )}
      <Link href="/profile" className={buttonClasses("secondary", "gap-2 px-5")}>
        <UserIcon className="h-5 w-5" />
        {ru.auth.profile}
      </Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className={itemClass}>
          {ru.auth.logout}
        </button>
      </form>
    </nav>
  );
}
