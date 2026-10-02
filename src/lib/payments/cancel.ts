/** KCP 가 "사용자가 결제를 취소하였습니다" 에 붙이는 PG 코드. */
const KCP_USER_CANCEL = "3001";

/**
 * 사용자가 결제창을 스스로 닫았는가. 취소는 오류가 아니므로 화면에 오류 문구를 띄우지 않는다.
 *
 * 포트원 V2 는 사용자 취소에 따로 코드를 두지 않고 PG 의 코드를 pgCode 로 넘긴다 —
 * 채널이 KCP 하나뿐이라(간편결제도 KCP 허브) 3001 만 보면 된다. pgCode 가 빠지는
 * 경우를 위해 포트원이 메시지 앞에 붙이는 "[3001]" 도 본다.
 *
 * PC 결제창 응답(PaymentResponse)과 모바일 복귀 쿼리(값이 null) 둘 다 받는다.
 */
export function isUserCancel(res: {
  code?: string | null;
  pgCode?: string | null;
  message?: string | null;
}): boolean {
  if (res.code == null) return false;
  if (res.pgCode === KCP_USER_CANCEL) return true;
  return res.message?.startsWith(`[${KCP_USER_CANCEL}]`) ?? false;
}
