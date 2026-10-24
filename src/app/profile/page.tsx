import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarUploader } from "@/features/profile/components/avatar-uploader";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { countryOptions } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { requireProfile } from "@/server/services/current-user";
import { getOwnProfile } from "@/server/services/profiles";

export const metadata: Metadata = { title: ru.profile.title, robots: { index: false } };

async function ProfileContent() {
  const user = await requireProfile("/profile");
  const supabase = await createClient();
  const profile = await getOwnProfile(supabase, { id: user.id, email: user.email });

  return (
    <>
      <dl className="grid max-w-xl gap-1 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted">{ru.profile.nickname}:</dt>
          <dd className="font-semibold">
            {profile.nickname}{" "}
            <span className="font-normal text-muted">{ru.profile.nicknameNote}</span>
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted">{ru.profile.email}:</dt>
          <dd>{profile.email}</dd>
        </div>
      </dl>
      <Link
        href={`/u/${encodeURIComponent(profile.nickname ?? "")}`}
        className="inline-flex min-h-11 items-center underline underline-offset-4"
      >
        {ru.profile.publicLink}
      </Link>
      <AvatarUploader
        userId={user.id}
        nickname={user.nickname}
        currentUrl={profile.avatarUrl}
        currentPath={user.avatarPath}
      />
      <ProfileForm
        countries={countryOptions()}
        initial={{
          fullName: profile.fullName ?? "",
          contact: profile.contact ?? "",
          about: profile.about ?? "",
          countryCode: profile.countryCode ?? "",
          city: profile.city ?? "",
          utcOffsetMinutes: profile.utcOffsetMinutes,
        }}
      />
    </>
  );
}

export default function ProfilePage() {
  return (
    <Container className="flex flex-col gap-4 py-8 sm:py-12">
      <h1 className="text-h3 sm:text-h1">{ru.profile.title}</h1>
      <Suspense fallback={<Skeleton className="h-96 max-w-xl" />}>
        <ProfileContent />
      </Suspense>
    </Container>
  );
}
