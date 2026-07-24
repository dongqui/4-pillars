// 리포트 접근 권한. isLoggedIn은 실제 세션으로, isPaid는 결제 미구현이라 개발용 쿼리 토글 유지.
// 향후 결제 조회가 붙는 지점.

import type { SessionPayload } from "@/lib/auth/session";

export interface ReportAccess {
  isLoggedIn: boolean;
  isPaid: boolean;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function getReportAccess(
  searchParams: SearchParams,
  session: SessionPayload | null,
): ReportAccess {
  const isPaid = first(searchParams.paid) === "true";
  const isLoggedIn = session !== null || isPaid;
  return { isLoggedIn, isPaid };
}
