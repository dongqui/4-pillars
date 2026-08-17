import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/deps";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { safeNextPath } from "@/lib/nav/next-param";
import { first, type SearchParams } from "@/lib/profiles/param";

/** backTo 에 이미 쿼리가 있으면 &, 없으면 ? 로 이어 붙인다 — 실패 리다이렉트가 공유한다. */
function withErrorMarker(backTo: string): string {
  return `${backTo}${backTo.includes("?") ? "&" : "?"}error=1`;
}

/**
 * 모바일 결제창이 돌아오는 자리. 포트원이 ?paymentId·?code·?message 를 붙여 보낸다.
 * ?next 는 우리가 redirectUrl 에 실어 보낸 복귀 경로다.
 *
 * 서버 컴포넌트인 이유: 확정과 이동을 한 번에 끝낼 수 있다. 클라이언트로 만들면
 * 빈 화면을 그린 뒤 fetch 하고 다시 이동해서, 사용자가 흰 화면을 두 번 본다.
 *
 * ⚠️ next 를 여기서 다시 safeNextPath 에 통과시킨다. 주소창으로 이 페이지에 직접
 * 닿을 수 있으므로, 주문 생성에서 한 번 걸렀다는 사실을 믿을 수 없다.
 */
export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  // 실패하면 충전 화면으로 되돌린다 — 복귀 경로는 그대로 들고 간다.
  const backTo = `/checkout?next=${encodeURIComponent(next)}`;

  // 포트원이 실패를 code 로 알려준다. 확정을 시도할 이유가 없다.
  const code = first(params.code);
  if (code) redirect(withErrorMarker(backTo));

  const paymentId = first(params.paymentId);
  // 포트원은 정상적으로 돌아올 때 code(실패) 아니면 paymentId(진행) 를 반드시
  // 싣는다 — 둘 다 없이 여기 닿는 건 결제를 시도한 적 없는 방문(주소 직접 입력·
  // 북마크)뿐이다. 시도하지 않은 사용자에게 오류 배너를 띄우지 않는다.
  if (!paymentId) redirect(backTo);

  const session = await getSession();
  if (session === null) redirect(`/login?next=${encodeURIComponent(backTo)}`);

  // 남의 주문을 확정해 주지 않는다. 완료 API 핸들러와 같은 판단이다.
  const order = await findOrderByPaymentId(paymentId);
  if (order === null || order.userId !== session.userId) redirect(withErrorMarker(backTo));

  let ok = false;
  // ⚠️ redirect() 는 예외를 던져서 동작한다. try 안에는 confirmPayment 만 두고
  // redirect 는 반드시 밖에서 부른다 — 안에 두면 이 catch 가 그 예외를 삼켜서,
  // 결제가 성공해도 사용자가 빈 화면에 남는다.
  try {
    const result = await confirmPayment(paymentId, confirmDeps);
    ok = result.ok;
  } catch (e) {
    // 여기서 실패해도 웹훅이 뒤이어 확정한다. 사용자를 충전 화면으로 돌려보내면
    // 잔액이 이미 올라가 있는 경우 화면이 그 값을 보여준다.
    console.error("[/checkout/complete] 확정 실패", e);
  }

  redirect(ok ? next : withErrorMarker(backTo));
}
