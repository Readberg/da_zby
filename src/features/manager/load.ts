import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/server/api/v1/problem";
import { requireProfile } from "@/server/services/current-user";

/** A signed-in visitor of the section with the client for their queries and their time zone. */
export async function loadMember(returnTo: string) {
  const user = await requireProfile(returnTo);
  const supabase = await createClient();
  return { user, supabase, offsetMinutes: user.utcOffsetMinutes ?? 180 };
}

/** Runs a query of the section; a visitor with no club yet is sent to the page that makes one. */
export async function orMakeClub<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) redirect("/manager");
    throw cause;
  }
}
