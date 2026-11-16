import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionForm } from "@/features/admin/console/action-form";
import { cell } from "@/features/admin/console/format";
import { RecordForm } from "@/features/admin/console/record-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { ru } from "@/messages/ru";
import { ACTIONS, atLeast, canRun, type ActionKey } from "@/server/admin/permissions";
import { entityByKey } from "@/server/admin/registry";
import { getRecord, loose } from "@/server/services/admin-console";
import { getCurrentUser, requireStaff } from "@/server/services/current-user";

export const metadata: Metadata = { title: ru.admin.console.title, robots: { index: false } };

async function RecordCard({ props }: { props: PageProps<"/[locale]/admin/data/[entity]/[id]"> }) {
  const { entity: key, id } = await props.params;
  // The layout checks this too; pages render in parallel with it, so each data page checks for itself.
  if (!(await requireStaff("/admin/data"))) notFound();
  const entity = entityByKey(key);
  if (!entity || entity.noCard) notFound();
  const user = await getCurrentUser();
  const record = await getRecord(loose(createAdminClient()), key, id);
  if (!record) notFound();

  const editable = entity.fields.filter((f) => f.editMin && atLeast(user?.role, f.editMin));
  const actions = entity.actions
    .filter((a) => canRun(user?.role, a as ActionKey))
    .map((a) => ({ key: a, confirm: Boolean(ACTIONS[a].confirm) }));
  const confirmHint = String(record.name ?? record.nickname ?? id);

  return (
    <>
      <dl className="grid max-w-3xl gap-x-6 gap-y-2 sm:grid-cols-[14rem_1fr]">
        {entity.fields.map((f) => (
          <div key={f.name} className="contents">
            <dt className="text-muted">{f.label}</dt>
            <dd className="break-all">{cell(f, record[f.name]) || "—"}</dd>
          </div>
        ))}
      </dl>
      {editable.length > 0 ? (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-muted">{ru.admin.console.editable}</p>
          <RecordForm
            entity={key}
            id={id}
            fields={editable.map((f) => ({
              name: f.name,
              label: f.label,
              type: f.type,
              value: record[f.name],
            }))}
          />
        </section>
      ) : (
        <p className="text-sm text-muted">{ru.admin.console.readonly}</p>
      )}
      {actions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-h4">{ru.admin.console.actions}</h2>
          <ActionForm targets={[id]} actions={actions} confirmHint={confirmHint} />
        </section>
      )}
    </>
  );
}

export default async function AdminRecordPage(
  props: PageProps<"/[locale]/admin/data/[entity]/[id]">,
) {
  const { entity: key } = await props.params;
  const entity = entityByKey(key);
  if (!entity) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/admin/data/${key}`} className="w-fit text-sm underline">
        {ru.admin.console.back}
      </Link>
      <h1 className="text-h3 sm:text-h2">{entity.label}</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <RecordCard props={props} />
      </Suspense>
    </div>
  );
}
