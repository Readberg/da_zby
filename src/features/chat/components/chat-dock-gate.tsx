import { getCurrentUser } from "@/server/services/current-user";
import { ChatDock } from "./chat-dock";

/** The chat window is for signed-in members with a nickname; guests never get it. */
export async function ChatDockGate() {
  const user = await getCurrentUser();
  if (!user?.nickname) return null;
  return <ChatDock userId={user.id} isAdmin={user.role === "admin"} />;
}
