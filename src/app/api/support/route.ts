import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { createSupportMailer } from "@/lib/support/mailer";
import { checkSupportLimit } from "@/lib/support/rate-limit";
import { insertSupportTicket, listPurchaseOptions, listServiceOptions } from "@/lib/support/store";
import { handleCreateSupportTicket } from "./_lib/handler";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateSupportTicket(raw, {
      userId: session?.userId ?? null,
      checkLimit: checkSupportLimit,
      getUser,
      listServiceOptions,
      listPurchaseOptions,
      insertTicket: insertSupportTicket,
      mailer: createSupportMailer(),
      defer: after,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/support]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
