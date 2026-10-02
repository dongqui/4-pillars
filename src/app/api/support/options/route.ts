import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listPurchaseOptions, listServiceOptions } from "@/lib/support/store";
import { getBalance } from "@/lib/tickets/wallet";
import { handleSupportOptions } from "../_lib/handler";

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  const session = await getSession();

  try {
    const result = await handleSupportOptions(kind, {
      userId: session?.userId ?? null,
      listServiceOptions,
      listPurchaseOptions,
      getBalance,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[GET /api/support/options]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
