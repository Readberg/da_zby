import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileView } from "@/features/profile/components/profile-view";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { requireProfile } from "@/server/services/current-user";
import { getPublicProfile } from "@/server/services/public-profiles";

export const metadata: Metadata = { title: ru.profile.title, robots: { index: false } };

/** Your own profile exactly as other people see it, with a way to edit it. */
async function ProfileContent() {
  const user = await requireProfile("/profile");
  const profile = await getPublicProfile(await createClient(), user.nickname);
  if (!profile) notFound();

  return (
    <ProfileView
      profile={profile}
      actions={
        <Link href="/profile/edit" className={buttonClasses("secondary", "px-5")}>
          {ru.profile.edit}
        </Link>
      }
    />
  );
}

export default function ProfilePage() {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-64 max-w-xl" />}>
        <ProfileContent />
      </Suspense>
    </Container>
  );
}
