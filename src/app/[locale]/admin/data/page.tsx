import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ru } from "@/messages/ru";
import { ENTITIES, LEGACY_SECTIONS } from "@/server/admin/registry";
import { getCurrentUser } from "@/server/services/current-user";

export const metadata: Metadata = { title: ru.admin.console.title, robots: { index: false } };

export default async function AdminDataPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h3 sm:text-h2">{ru.admin.console.title}</h1>
      <p className="max-w-prose text-muted">{ru.admin.console.hint}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {ENTITIES.map((entity) => (
          <Link key={entity.key} href={`/admin/data/${entity.key}`}>
            <Card title={entity.label} interactive>
              <p className="text-muted">{entity.table}</p>
            </Card>
          </Link>
        ))}
      </div>
      {user?.role === "admin" && (
        <>
          <h2 className="text-h4">{ru.admin.console.legacy}</h2>
          <ul className="flex flex-col gap-1">
            {LEGACY_SECTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="underline">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
