// 리포트 접근 권한. isLoggedIn은 실제 세션으로 정해진다. isPaid는 여기서는 여전히
// ?paid=true 개발용 쿼리 토글이고(프로덕션에서는 무시, 아래 참고) — 실제 결제 여부는
// page.tsx 가 이 값에 profile.isPaid(purchases 조인, src/lib/profiles/store.ts)를
// OR 해서 최종 판단한다.
//
// ?profile 해석은 /checkout 과 공유하므로 @/lib/profiles/param 에 있다.
// 기존 import 경로를 살려 두려고 여기서 다시 내보낸다.

import type { SessionPayload } from "@/lib/auth/session";
import { first, type SearchParams } from "@/lib/profiles/param";

export { parseProfileParam, type ProfileParam, type SearchParams } from "@/lib/profiles/param";

export interface ReportAccess {
  isLoggedIn: boolean;
  isPaid: boolean;
}

export function getReportAccess(
  searchParams: SearchParams,
  session: SessionPayload | null,
): ReportAccess {
  // ?paid=true는 개발용 토글이다. 프로덕션에서 열어 두면 로그인한 아무나 이걸 붙여
  // 유료 8섹션을 실제로 생성시킬 수 있고, 그 결과가 원국 단위 공유 캐시에 영구
  // 저장돼 결제 없이도 유료 리포트가 공짜가 된다 — 프로덕션에서는 무시한다.
  const isPaid = process.env.NODE_ENV !== "production" && first(searchParams.paid) === "true";
  const isLoggedIn = session !== null || isPaid;
  return { isLoggedIn, isPaid };
}
