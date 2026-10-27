import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RemovePhotoButton } from "@/features/admin/components/remove-photo-button";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { countryOptions } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { getUserProfile } from "@/server/services/admin-users";

export const metadata: Metadata = { title: ru.admin.users.editTitle, robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditUser({ params }: { params: PageProps<"/[locale]/admin/users/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const profile = await getUserProfile(await createClient(), id);
  if (!profile) notFound();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Link href="/admin/users" className="inline-flex min-h-11 w-fit items-center underline">
        ← {ru.admin.users.backToList}
      </Link>
      <h1 className="text-h3 sm:text-h2">
        {ru.admin.users.editTitle}: {profile.nickname ?? ru.admin.users.noNickname}
      </h1>
      <p className="text-sm text-muted">{ru.admin.users.editNote}</p>
      {profile.avatarUrl && (
        <div className="flex items-center gap-4">
          <Image
            src={profile.avatarUrl}
            alt=""
            width={72}
            height={72}
            className="h-18 w-18 rounded-full object-cover"
          />
          <RemovePhotoButton userId={profile.userId} />
        </div>
      )}
      <ProfileForm
        adminTarget={profile.userId}
        countries={countryOptions("ru")}
        initial={{
          nickname: profile.nickname ?? "",
          fullName: profile.fullName ?? "",
          contact: profile.contact ?? "",
          about: profile.about ?? "",
          countryCode: profile.countryCode ?? "",
          city: profile.city ?? "",
          utcOffsetMinutes: profile.utcOffsetMinutes,
        }}
      />
    </div>
  );
}

export default function AdminEditUserPage(props: PageProps<"/[locale]/admin/users/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <EditUser params={props.params} />
    </Suspense>
  );
}
