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

export const metadata: Metadata = { title: ru.profile.editTitle, robots: { index: false } };

async function EditContent() {
  const user = await requireProfile("/profile/edit");
  const supabase = await createClient();
  const profile = await getOwnProfile(supabase, { id: user.id, email: user.email });

  return (
    <>
      <AvatarUploader
        userId={user.id}
        nickname={user.nickname}
        currentUrl={profile.avatarUrl}
        currentPath={user.avatarPath}
      />
      <ProfileForm
        countries={countryOptions()}
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
    </>
  );
}

export default function EditProfilePage() {
  return (
    <Container className="flex flex-col gap-4 py-8 sm:py-12">
      <Link
        href="/profile"
        className="inline-flex min-h-11 w-fit items-center text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        ← {ru.profile.back}
      </Link>
      <h1 className="text-h3 sm:text-h1">{ru.profile.editTitle}</h1>
      <Suspense fallback={<Skeleton className="h-96 max-w-xl" />}>
        <EditContent />
      </Suspense>
    </Container>
  );
}
