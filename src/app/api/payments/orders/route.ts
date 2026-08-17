import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAppOrigin, getChannel, getStoreId } from "@/lib/payments/config";
import { newPaymentId } from "@/lib/payments/order-id";
import { createPendingPurchase } from "@/lib/payments/store";
import { handleCreateOrder } from "./_lib/handler";

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateOrder(raw, {
      userId: session?.userId ?? null,
      getStoreId: () => getStoreId(),
      getChannel: (id) => getChannel(id),
      getAppOrigin: () => getAppOrigin(),
      newPaymentId,
      createPending: (i) => createPendingPurchase(i),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/payments/orders]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
