import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/deps";
import { CHECKOUT_NEXT_COOKIE } from "@/lib/payments/order";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { safeNextPath } from "@/lib/nav/next-param";

/** backTo 에 이미 쿼리가 있으면 &, 없으면 ? 로 이어 붙인다 — 실패 리다이렉트가 공유한다. */
function withErrorMarker(backTo: string): string {
  return `${backTo}${backTo.includes("?") ? "&" : "?"}error=1`;
}

/**
 * 모바일 결제창이 돌아오는 자리. 포트원이 ?paymentId(진행) 또는 ?code·?message(실패)를
 * 붙여 보낸다. 복귀 경로는 쿠키에서 읽는다. 확정이 끝나면 완료 화면(/checkout/done)으로,
 * 실패하면 충전 화면으로 되돌린다.
 *
 * 페이지가 아니라 라우트 핸들러인 이유:
 *  1. 이 자리는 화면을 그린 적이 없다 — 확정하고 곧장 옮긴다.
 *  2. 쓰고 버려야 할 쿠키(checkout_next)를 지워야 하는데, 서버 컴포넌트 렌더 중에는
 *     쿠키를 지울 수 없다(Next 문서: .delete 는 Server Function·Route Handler 에서만).
 *
 * 승인을 부르지 않는다 — 포트원 결제창이 이미 승인까지 끝냈다. 여기서는 조회로
 * "정말 PAID 인지, 금액이 맞는지"만 확인한다. PC 는 이 자리를 지나지 않고
 * /api/payments/complete 로 같은 확인을 한다.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams;

  // ⚠️ 쿠키 값도 다시 safeNextPath 에 통과시킨다. 주소창으로 이 자리에 직접 닿을 수
  // 있고, 쿠키는 우리가 심었다는 보장이 브라우저 쪽에 없다.
  const next = safeNextPath(req.cookies.get(CHECKOUT_NEXT_COOKIE)?.value);
  // 실패하면 충전 화면으로 되돌린다 — 복귀 경로는 그대로 들고 간다.
  const backTo = `/checkout?next=${encodeURIComponent(next)}`;

  /** 어디로 가든 쓰고 버릴 쿠키는 여기서 지운다. */
  const go = (path: string): NextResponse => {
    const res = NextResponse.redirect(new URL(path, req.nextUrl.origin));
    res.cookies.delete(CHECKOUT_NEXT_COOKIE);
    return res;
  };

  // 포트원이 실패를 code 로 알려준다. 확정을 시도할 이유가 없다.
  if (q.get("code")) return go(withErrorMarker(backTo));

  const paymentId = q.get("paymentId");
  // 포트원은 정상적으로 돌아올 때 code(실패) 아니면 paymentId(진행) 를 반드시
  // 싣는다 — 둘 다 없이 여기 닿는 건 결제를 시도한 적 없는 방문(주소 직접 입력·
  // 북마크)뿐이다. 시도하지 않은 사용자에게 오류 배너를 띄우지 않는다.
  if (!paymentId) return go(backTo);

  const session = await getSession();
  if (session === null) return go(`/login?next=${encodeURIComponent(backTo)}`);

  // 남의 주문을 확정해 주지 않는다. 없는 주문과 남의 주문을 구분하지 않는다:
  // 구분하면 paymentId 로 존재 여부를 훑을 수 있다.
  const order = await findOrderByPaymentId(paymentId);
  if (order === null || order.userId !== session.userId) return go(withErrorMarker(backTo));

  let ok = false;
  try {
    const result = await confirmPayment(paymentId, confirmDeps);
    ok = result.ok;
  } catch (e) {
    // 조회 장애면 웹훅이 뒤이어 확정한다. 사용자를 충전 화면으로 돌려보내면
    // 잔액이 이미 올라가 있는 경우 화면이 그 값을 보여준다.
    console.error("[/checkout/complete] 확정 실패", e);
  }

  if (!ok) return go(withErrorMarker(backTo));

  // 곧장 next 로 보내지 않고 완료 화면을 한 번 거친다 — 결제창에서 튕겨 나오자마자
  // 원래 화면이 뜨면 무엇이 늘었는지 알 자리가 없다. 그 화면이 2.6초 뒤 next 로 옮긴다.
  // orderId 만 넘기고 장수는 넘기지 않는다: 화면이 DB 에서 직접 읽는다.
  const q2 = new URLSearchParams({ orderId: paymentId, next });
  return go(`/checkout/done?${q2}`);
}
