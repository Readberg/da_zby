import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { ru } from "@/messages/ru";
import { getCurrentUser } from "@/server/services/current-user";

const itemClass =
  "inline-flex min-h-11 items-center rounded-full px-4 text-base font-medium text-ink transition-colors duration-200 hover:bg-surface";

/** Header slot: "Войти" for guests, nickname + sign-out for signed-in users. */
export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className={buttonClasses("primary")}>
        {ru.auth.login}
      </Link>
    );
  }

  return (
    <nav aria-label={ru.auth.userMenu} className="flex items-center gap-1">
      <Link href="/profile" className={itemClass}>
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
