// 리포트 접근 권한. isLoggedIn은 실제 세션으로, isPaid는 결제 미구현이라 개발용 쿼리 토글 유지.
// 향후 결제 조회가 붙는 지점.

import type { SessionPayload } from "@/lib/auth/session";

export interface ReportAccess {
  isLoggedIn: boolean;
  isPaid: boolean;
}

export type SearchParams = Record<string, string | string[] | undefined>;

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

/**
 * ?profile 해석.
 *  - absent  : 파라미터 없음 → 픽스처 데모
 *  - invalid : 있지만 순번 id 형태가 아님 → notFound
 * 둘을 가르는 이유: 잘못된 값을 데모로 떨어뜨리면 사용자는 남의 리포트를 보고 있다고 오해한다.
 * 형식 검사를 여기서 하는 이유: URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다.
 */
export type ProfileParam =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "id"; id: string };

export function parseProfileParam(searchParams: SearchParams): ProfileParam {
  const raw = first(searchParams.profile);
  if (raw === undefined) return { kind: "absent" };
  return /^\d+$/.test(raw) ? { kind: "id", id: raw } : { kind: "invalid" };
}
