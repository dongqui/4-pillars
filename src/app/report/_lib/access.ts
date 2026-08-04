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
  // ?paid=true는 개발용 토글이다. 프로덕션에서 열어 두면 로그인한 아무나 이걸 붙여
  // 유료 8섹션을 실제로 생성시킬 수 있고, 그 결과가 원국 단위 공유 캐시에 영구
  // 저장돼 결제 없이도 유료 리포트가 공짜가 된다 — 프로덕션에서는 무시한다.
  const isPaid = process.env.NODE_ENV !== "production" && first(searchParams.paid) === "true";
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

// bigint 상한(signed 64bit, 2^63-1). tsconfig target(ES2017)이 BigInt 리터럴 표기
// (예: 123n)를 지원하지 않아 문자열로 생성한다.
const MAX_BIGINT_ID = BigInt("9223372036854775807");

export function parseProfileParam(searchParams: SearchParams): ProfileParam {
  const raw = first(searchParams.profile);
  if (raw === undefined) return { kind: "absent" };
  // 선행 0("007")은 배제한다 — 순번 id에 선행 0은 없고, 허용하면 같은 프로필이
  // "12"와 "007…" 두 URL을 갖게 돼 캐시·공유 링크가 갈린다.
  // 자릿수만 세는 정규식(예: 19자리 이하)은 19자리 안에서도 bigint 상한을 넘는
  // 값(예: "9999999999999999999")을 걸러내지 못하므로, 자릿수 대신 값 자체를
  // BigInt로 비교해 ::bigint 캐스팅이 절대 넘치지 않게 한다.
  if (!/^[1-9]\d*$/.test(raw)) return { kind: "invalid" };
  return BigInt(raw) <= MAX_BIGINT_ID ? { kind: "id", id: raw } : { kind: "invalid" };
}
