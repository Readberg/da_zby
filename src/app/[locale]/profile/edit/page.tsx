import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarUploader } from "@/features/profile/components/avatar-uploader";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { countryOptions } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/server/services/current-user";
import { getOwnProfile } from "@/server/services/profiles";
import { getMessages, initLocale, messagesFor, getLocale } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/profile/edit">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.profile.editTitle, robots: { index: false } };
}

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
        countries={countryOptions(getLocale())}
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

export default async function EditProfilePage(props: PageProps<"/[locale]/profile/edit">) {
  await initLocale(props.params);
  const t = getMessages();
  return (
    <Container className="flex flex-col items-center py-8 sm:py-12">
      <div className="flex w-full max-w-xl flex-col gap-4">
        <Link
          href="/profile"
          className="inline-flex min-h-11 w-fit items-center text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          ← {t.profile.back}
        </Link>
        <h1 className="text-h3 sm:text-h1">{t.profile.editTitle}</h1>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <EditContent />
        </Suspense>
      </div>
    </Container>
  );
}
