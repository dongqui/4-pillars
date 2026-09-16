import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  findLatestRevision,
  findPendingRevision,
  getActiveRevision,
  upsertPendingRevision,
} from "@/lib/flows/revisions";
import { getFlow } from "@/lib/flows/store";
import { handleRetryRevision } from "./_lib/handler";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  try {
    const result = await handleRetryRevision(
      { userId: session.userId, flowId: id, raw },
      {
        getFlow,
        getActiveRevision,
        findPendingRevision,
        findLatestRevision,
        upsertPendingRevision,
        randomUUID: () => randomUUID(),
      },
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/flows/:id/revisions]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
