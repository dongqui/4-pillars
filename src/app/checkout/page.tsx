import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { availableMethods } from "@/lib/payments/config";
import { listPackages } from "@/lib/payments/pricing";
import { safeNextPath } from "@/lib/nav/next-param";
import { first, type SearchParams } from "@/lib/profiles/param";
import { getBalance } from "@/lib/tickets/wallet";
import { CheckoutHeader } from "./_components/CheckoutHeader";
import { CheckoutView } from "./_components/CheckoutView";

/**
 * 이용권 충전 화면.
 *
 * 프로필을 읽지 않는다 — 충전에는 대상이 없다. 단건 결제 시절의 소유 확인·중복
 * 결제 가드가 사라진 것은 누락이 아니라 상품이 바뀐 결과다.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next));

  const session = await getSession();
  if (session === null) {
    redirect(`/login?next=${encodeURIComponent(`/checkout?next=${encodeURIComponent(next)}`)}`);
  }

  const balance = await getBalance(session.userId);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <CheckoutHeader />
      <CheckoutView
        next={next}
        balance={balance}
        packages={listPackages()}
        available={availableMethods()}
      />
    </div>
  );
}
