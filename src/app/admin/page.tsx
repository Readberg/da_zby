import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ru } from "@/messages/ru";

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h3 sm:text-h2">{ru.admin.overview}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/tournaments" className="group relative">
          <Card title={ru.admin.nav.tournaments} interactive>
            <p className="text-muted">{ru.admin.home.tournamentsHint}</p>
          </Card>
        </Link>
        <Link href="/admin/clubs" className="group">
          <Card title={ru.admin.nav.clubs} interactive>
            <p className="text-muted">{ru.admin.home.clubsHint}</p>
          </Card>
        </Link>
        <Link href="/admin/seasons" className="group">
          <Card title={ru.admin.nav.seasons} interactive>
            <p className="text-muted">{ru.admin.home.seasonsHint}</p>
          </Card>
        </Link>
        <Link href="/admin/users" className="group">
          <Card title={ru.admin.nav.users} interactive>
            <p className="text-muted">{ru.admin.home.usersHint}</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
