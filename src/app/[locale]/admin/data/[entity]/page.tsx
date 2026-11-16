import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { BulkTable } from "@/features/admin/console/bulk-table";
import { cell } from "@/features/admin/console/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { ru } from "@/messages/ru";
import { ACTIONS, canRun, type ActionKey } from "@/server/admin/permissions";
import { entityByKey } from "@/server/admin/registry";
import { consoleListQuerySchema } from "@/server/api/v1/schemas/admin-console";
import { listRecords, loose } from "@/server/services/admin-console";
import { getCurrentUser, requireStaff } from "@/server/services/current-user";

export const metadata: Metadata = { title: ru.admin.console.title, robots: { index: false } };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function ListContent({ props }: { props: PageProps<"/[locale]/admin/data/[entity]"> }) {
  const { entity: key } = await props.params;
  // The layout checks this too; pages render in parallel with it, so each data page checks for itself.
  if (!(await requireStaff("/admin/data"))) notFound();
  const entity = entityByKey(key);
  if (!entity) notFound();
  const sp = await props.searchParams;
  const user = await getCurrentUser();

  const filterPairs = entity.fields
    .filter((f) => f.filter)
    .map((f) => [f.name, one(sp[f.name])] as const)
    .filter(([, v]) => v);
  const parsed = consoleListQuerySchema.safeParse({
    entity: key,
    q: one(sp.q),
    sort: one(sp.sort),
    dir: one(sp.dir),
    page: one(sp.page),
    filters: filterPairs.map(([n, v]) => `${n}:${v}`).join(";") || undefined,
  });
  if (!parsed.success) notFound();
  const { items, total, page, pageSize } = await listRecords(
    loose(createAdminClient()),
    parsed.data,
  );
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const columns = entity.fields.filter((f) => f.list);
  const rows = items.map((row) =>
    Object.fromEntries(entity.fields.map((f) => [f.name, cell(f, row[f.name])])),
  );
  const bulkActions = entity.actions
    .filter((a) => ACTIONS[a].bulk && canRun(user?.role, a as ActionKey))
    .map((a) => ({ key: a, confirm: false }));

  const base = new URLSearchParams();
  if (parsed.data.q) base.set("q", parsed.data.q);
  for (const [n, v] of filterPairs) if (v) base.set(n, v);
  if (parsed.data.sort) base.set("sort", parsed.data.sort);
  if (parsed.data.dir) base.set("dir", parsed.data.dir);
  const link = (extra: Record<string, string>) =>
    `/admin/data/${key}?${new URLSearchParams({ ...Object.fromEntries(base), ...extra })}`;
  const select = "min-h-11 rounded-sm border border-line bg-surface px-3 text-base text-ink";

  return (
    <>
      <form action={`/admin/data/${key}`} className="flex flex-wrap items-end gap-3">
        {entity.fields.some((f) => f.search) && (
          <div className="flex min-w-48 flex-col gap-1">
            <Label htmlFor="c-q">{ru.admin.console.searchPlaceholder}</Label>
            <Input id="c-q" name="q" defaultValue={parsed.data.q ?? ""} />
          </div>
        )}
        {entity.fields
          .filter((f) => f.filter)
          .map((f) => (
            <div key={f.name} className="flex flex-col gap-1">
              <Label htmlFor={`c-${f.name}`}>{f.label}</Label>
              <select
                id={`c-${f.name}`}
                name={f.name}
                defaultValue={one(sp[f.name]) ?? ""}
                className={select}
              >
                <option value="">{ru.admin.console.all}</option>
                {(f.type === "bool" ? ["true", "false"] : (f.options ?? [])).map((o) => (
                  <option key={o} value={o}>
                    {f.type === "bool"
                      ? o === "true"
                        ? ru.admin.console.yes
                        : ru.admin.console.no
                      : o}
                  </option>
                ))}
              </select>
            </div>
          ))}
        <Button type="submit">{ru.admin.console.search}</Button>
      </form>
      <p className="text-sm text-muted">
        {ru.admin.console.found.replace("{n}", String(total))}
        {" · "}
        {entity.fields
          .filter((f) => f.sortable)
          .map((f) => (
            <Link
              key={f.name}
              href={link({
                sort: f.name,
                dir: parsed.data.sort === f.name && parsed.data.dir === "asc" ? "desc" : "asc",
              })}
              className="mr-2 underline"
            >
              {f.label}
            </Link>
          ))}
      </p>
      {rows.length === 0 ? (
        <p className="text-muted">{ru.admin.console.empty}</p>
      ) : (
        <BulkTable
          entity={key}
          idColumn={entity.idColumn}
          columns={columns.map((c) => ({ name: c.name, label: c.label }))}
          rows={rows}
          bulkActions={bulkActions}
          hasCard={!entity.noCard}
        />
      )}
      {pages > 1 && (
        <nav className="flex items-center gap-3">
          {page > 1 && (
            <Link href={link({ page: String(page - 1) })} className="underline">
              {ru.admin.console.prev}
            </Link>
          )}
          <span className="text-sm text-muted">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link href={link({ page: String(page + 1) })} className="underline">
              {ru.admin.console.next}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

export default async function AdminEntityPage(props: PageProps<"/[locale]/admin/data/[entity]">) {
  const { entity: key } = await props.params;
  const entity = entityByKey(key);
  if (!entity) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/data" className="w-fit text-sm underline">
        {ru.admin.console.back}
      </Link>
      <h1 className="text-h3 sm:text-h2">{entity.label}</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ListContent props={props} />
      </Suspense>
    </div>
  );
}
