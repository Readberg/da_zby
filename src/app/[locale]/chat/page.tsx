import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatView } from "@/features/chat/components/chat-view";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/server/services/current-user";
import { listChat } from "@/server/services/chat";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/chat">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.chat.title, description: t.chat.description, robots: { index: false } };
}

/** The common chat: a signed-in page, messages of the last 3 days, live through Realtime. */
async function ChatContent() {
  const user = await requireProfile("/chat");
  const supabase = await createClient();
  const [initial, profile] = await Promise.all([
    listChat(supabase, user.id),
    supabase.from("profiles").select("utc_offset_minutes").eq("id", user.id).maybeSingle(),
  ]);
  return (
    <ChatView
      initial={initial}
      currentUserId={user.id}
      isAdmin={user.role === "admin"}
      utcOffsetMinutes={profile.data?.utc_offset_minutes ?? 180}
    />
  );
}

export default async function ChatPage(props: PageProps<"/[locale]/chat">) {
  await initLocale(props.params);
  const t = getMessages();
  return (
    <Container className="flex flex-col gap-4 py-8 sm:py-12 lg:py-20">
      <h1 className="font-display text-4xl uppercase">{t.chat.title}</h1>
      <p className="max-w-prose text-muted">{t.chat.lead}</p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ChatContent />
      </Suspense>
    </Container>
  );
}
