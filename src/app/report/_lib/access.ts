// 리포트 접근 권한. 지금은 쿼리 토글 stub — 향후 세션/결제 조회로 교체하는 유일한 지점.

export interface ReportAccess {
  isLoggedIn: boolean;
  isPaid: boolean;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function getReportAccess(searchParams: SearchParams): ReportAccess {
  const paid = first(searchParams.paid) === "true";
  const login = first(searchParams.login) === "true";
  if (paid) return { isLoggedIn: true, isPaid: true };
  if (login) return { isLoggedIn: true, isPaid: false };
  return { isLoggedIn: false, isPaid: false };
}
