import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/deps";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { first, parseProfileParam, type SearchParams } from "@/lib/profiles/param";

/**
 * 모바일 결제창이 돌아오는 자리. 포트원이 ?paymentId·?code·?message 를 붙여 보낸다.
 *
 * 서버 컴포넌트인 이유: 확정과 이동을 한 번에 끝낼 수 있다. 클라이언트로 만들면
 * 빈 화면을 그린 뒤 fetch 하고 다시 이동해서, 사용자가 흰 화면을 두 번 본다.
 */
export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const param = parseProfileParam(params);
  // 결제 화면으로 돌아갈 때 필요한 값이다. 없으면 홈으로 보낼 수밖에 없다.
  const backTo = param.kind === "id" ? `/checkout?profile=${param.id}` : "/home";

  // 포트원이 실패를 code 로 알려준다. 확정을 시도할 이유가 없다.
  const code = first(params.code);
  if (code) redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}error=1`);

  const paymentId = first(params.paymentId);
  if (!paymentId) redirect(backTo);

  const session = await getSession();
  if (session === null) redirect(`/login?next=${encodeURIComponent(backTo)}`);

  // 남의 주문을 확정해 주지 않는다. 완료 API 핸들러와 같은 판단이다.
  const order = await findOrderByPaymentId(paymentId);
  if (order === null || order.userId !== session.userId) redirect(backTo);

  let ok = false;
  try {
    const result = await confirmPayment(paymentId, confirmDeps);
    ok = result.ok;
  } catch (e) {
    // 여기서 실패해도 웹훅이 뒤이어 확정한다. 사용자를 결제 화면으로 돌려보내면
    // /checkout 가드가 isPaid 를 다시 읽어 이미 확정됐다면 리포트로 보낸다.
    console.error("[/checkout/complete] 확정 실패", e);
  }

  redirect(ok ? `/report?profile=${order.profileId}` : backTo);
}
