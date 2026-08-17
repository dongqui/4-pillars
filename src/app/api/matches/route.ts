import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canCreateMatch } from "@/lib/matches/access";
import { findOrCreateMatch } from "@/lib/matches/store";
import { createProfile, getProfile } from "@/lib/profiles/store";
import { handleCreateMatch } from "./_lib/handler";

export async function POST(request: Request) {
  const session = await getSession();
  const raw = await request.json().catch(() => null);

  const result = await handleCreateMatch(raw, {
    userId: session?.userId ?? null,
    checkAccess: canCreateMatch,
    getProfile,
    createProfile,
    findOrCreate: findOrCreateMatch,
  });

  return NextResponse.json(result.body, { status: result.status });
}
