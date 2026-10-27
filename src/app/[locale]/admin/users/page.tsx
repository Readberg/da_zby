import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { RoleButton } from "@/features/admin/components/role-button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { ru } from "@/messages/ru";
import { listUsers } from "@/server/services/admin-users";

export const metadata: Metadata = { title: ru.admin.nav.users, robots: { index: false } };

const PAGE_SIZE = 50;

async function UsersContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/admin/users">["searchParams"];
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const { items, total } = await listUsers(await createClient(), {
    search,
    page,
    pageSize: PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (target: number) =>
    `/admin/users?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(target) })}`;

  return (
    <>
      <form action="/admin/users" className="flex max-w-md flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor="users-search">{ru.admin.users.searchLabel}</Label>
          <Input
            id="users-search"
            name="q"
            defaultValue={search}
            placeholder={ru.admin.users.searchPlaceholder}
          />
        </div>
        <Button type="submit">{ru.admin.users.search}</Button>
      </form>

      <p className="text-sm text-muted">{ru.admin.users.count.replace("{n}", String(total))}</p>

      {items.length === 0 ? (
        <p className="text-muted">{ru.admin.users.empty}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{ru.admin.users.nickname}</TH>
              <TH>{ru.admin.users.name}</TH>
              <TH>{ru.admin.users.registered}</TH>
              <TH>{ru.admin.users.lastLogin}</TH>
              <TH>{ru.admin.users.role}</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((user) => (
              <TR key={user.id}>
                <TD className="font-semibold">
                  {user.nickname ? (
                    <Link href={`/u/${encodeURIComponent(user.nickname)}`} className="underline">
                      {user.nickname}
                    </Link>
                  ) : (
                    <span className="text-muted">{ru.admin.users.noNickname}</span>
                  )}
                </TD>
                <TD>{user.fullName ?? "—"}</TD>
                <TD>{formatDate(user.createdAt)}</TD>
                <TD>{user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}</TD>
                <TD>
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      {user.role === "admin" ? ru.admin.users.admin : ru.admin.users.user}
                    </span>
                    <RoleButton
                      userId={user.id}
                      role={user.role}
                      nickname={user.nickname ?? ru.admin.users.noNickname}
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {pages > 1 && (
        <nav aria-label={ru.admin.users.pages} className="flex items-center gap-3">
          {page > 1 && (
            <Link href={link(page - 1)} className="underline">
              {ru.admin.users.prev}
            </Link>
          )}
          <span className="text-sm text-muted">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link href={link(page + 1)} className="underline">
              {ru.admin.users.next}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

export default function AdminUsersPage(props: PageProps<"/[locale]/admin/users">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h3 sm:text-h2">{ru.admin.nav.users}</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <UsersContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
