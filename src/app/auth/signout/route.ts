import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST only: signing out must not be triggerable by a plain link or an image tag. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 turns the POST into a GET of the home page.
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
