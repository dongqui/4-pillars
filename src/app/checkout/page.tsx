import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/profiles/store";
import { parseProfileParam, type SearchParams } from "@/lib/profiles/param";
import { availableMethods } from "@/lib/payments/config";
import { CheckoutHeader } from "./_components/CheckoutHeader";
import { CheckoutView } from "./_components/CheckoutView";
import { toOrderTarget } from "./_lib/to-order";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const param = parseProfileParam(await searchParams);
  // /report 는 ?profile 없음을 픽스처 데모로 떨어뜨리지만 여기서는 아니다 —
  // 결제 대상이 없는 결제 화면은 보여줄 것이 없고, 데모를 띄우면 사용자는
  // 자기가 무엇을 사는지 오해한다.
  if (param.kind !== "id") notFound();

  const session = await getSession();
  if (session === null) {
    redirect(`/login?next=${encodeURIComponent(`/checkout?profile=${param.id}`)}`);
  }

  const profile = await getProfile(session.userId, param.id);
  // 없는 프로필과 남의 프로필을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
  if (profile === null) notFound();

  // 이미 산 리포트를 다시 팔지 않는다. confirmPayment 가 purchases 를 paid 로
  // 올리므로 이 가드가 이중 결제를 막는다.
  if (profile.isPaid) redirect(`/report?profile=${profile.id}`);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <CheckoutHeader />
      <CheckoutView
        profileId={profile.id}
        target={toOrderTarget(profile)}
        available={availableMethods()}
      />
    </div>
  );
}
