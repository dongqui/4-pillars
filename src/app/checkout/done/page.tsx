import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/nav/next-param";
import { findReceiptByPaymentId } from "@/lib/payments/store";
import { first, type SearchParams } from "@/lib/profiles/param";
import { getBalance } from "@/lib/tickets/wallet";
import { PaymentComplete } from "../_components/PaymentComplete";

/**
 * 결제 완료 연출이 머무는 자리. /checkout/complete 가 승인을 끝낸 뒤 여기로 보낸다.
 *
 * 승인을 여기서 하지 않는 이유: 이 화면은 새로고침·뒤로가기로 다시 그려질 수 있다.
 * 돈을 잡는 일은 한 번만 지나가는 라우트 핸들러에 두고, 여기는 이미 확정된 결과를
 * 읽어 보여 주기만 한다.
 *
 * 장수를 쿼리로 받지 않는 것도 같은 이유다 — 주소창에서 고칠 수 있는 숫자를
 * "충전되었어요" 옆에 띄우지 않는다. 적립 장수는 주문 행에서, 잔액은 지갑에서 읽는다.
 */
export default async function CheckoutDonePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next));
  const orderId = first(sp.orderId);

  const session = await getSession();
  if (session === null) redirect(next);

  // 없는 주문·남의 주문·아직 확정되지 않은 주문을 구분하지 않는다. 어느 쪽이든
  // 보여 줄 완료가 없고, 구분하면 orderId 로 존재 여부를 훑을 수 있다.
  const receipt = orderId ? await findReceiptByPaymentId(orderId) : null;
  if (receipt === null || receipt.userId !== session.userId || receipt.status !== "paid") {
    redirect(next);
  }

  const balance = await getBalance(session.userId);

  return <PaymentComplete added={receipt.tickets} after={balance} next={next} />;
}
