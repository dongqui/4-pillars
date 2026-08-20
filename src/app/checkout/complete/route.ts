import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { approveDeps } from "@/lib/payments/deps";
import { CHECKOUT_NEXT_COOKIE } from "@/lib/payments/order";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { safeNextPath } from "@/lib/nav/next-param";

/** backTo 에 이미 쿼리가 있으면 &, 없으면 ? 로 이어 붙인다 — 실패 리다이렉트가 공유한다. */
function withErrorMarker(backTo: string): string {
  return `${backTo}${backTo.includes("?") ? "&" : "?"}error=1`;
}

/**
 * 토스 결제창이 돌아오는 자리. 성공이면 ?paymentKey·?orderId·?amount 가,
 * 실패·취소면 ?code·?message 가 붙어 온다. 복귀 경로는 쿠키에서 읽는다.
 *
 * 페이지가 아니라 라우트 핸들러인 이유:
 *  1. 이 자리는 화면을 그린 적이 없다 — 확정하고 곧장 옮긴다.
 *  2. 쓰고 버려야 할 쿠키(checkout_next)를 지워야 하는데, 서버 컴포넌트 렌더 중에는
 *     쿠키를 지울 수 없다(Next 문서: .delete 는 Server Function·Route Handler 에서만).
 *
 * ⚠️ 여기가 승인을 부르는 유일한 자리다. 토스 결제창은 인증까지만 하므로,
 * 이 요청이 성공해야 비로소 돈이 잡힌다.
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

  // 토스가 실패를 code 로 알려준다. 승인을 시도할 이유가 없다.
  if (q.get("code")) return go(withErrorMarker(backTo));

  const paymentKey = q.get("paymentKey");
  const orderId = q.get("orderId");
  const amount = q.get("amount");
  // 토스는 정상적으로 돌아올 때 code(실패) 아니면 셋 다(성공) 를 싣는다 — 아무것도
  // 없이 여기 닿는 건 결제를 시도한 적 없는 방문(주소 직접 입력·북마크)뿐이다.
  // 시도하지 않은 사용자에게 오류 배너를 띄우지 않는다.
  if (!paymentKey || !orderId || !amount) return go(backTo);

  const session = await getSession();
  if (session === null) return go(`/login?next=${encodeURIComponent(backTo)}`);

  // 남의 주문을 승인해 주지 않는다. 없는 주문과 남의 주문을 구분하지 않는다:
  // 구분하면 orderId 로 존재 여부를 훑을 수 있다.
  const order = await findOrderByPaymentId(orderId);
  if (order === null || order.userId !== session.userId) return go(withErrorMarker(backTo));

  // ⚠️ 승인 전에 금액을 대조한다. 토스가 "쿼리의 amount 와 결제 요청 금액이 같은지
  // 반드시 확인하라"고 못박은 자리다 — 주소창에서 amount 를 낮춰 다시 부르는 시도를
  // 여기서 끊는다. 기준은 쿼리가 아니라 주문 생성 때 서버가 박은 order.amount 다.
  if (Number(amount) !== order.amount) {
    console.error(
      `[/checkout/complete] 금액 불일치 orderId=${orderId} 주문=${order.amount} 쿼리=${amount}`,
    );
    return go(withErrorMarker(backTo));
  }

  let ok = false;
  try {
    const result = await confirmPayment(orderId, approveDeps({ paymentKey, amount: order.amount }));
    ok = result.ok;
  } catch (e) {
    // 승인이 실패해도 돈이 잡히지 않았을 뿐이라 사용자를 충전 화면으로 돌려보낸다.
    // 이미 승인된 뒤(ALREADY_PROCESSED_PAYMENT)라면 confirmPayment 가 앞에서
    // already 로 접었을 것이므로, 여기 오는 것은 진짜 실패다.
    console.error("[/checkout/complete] 승인 실패", e);
  }

  return go(ok ? next : withErrorMarker(backTo));
}
