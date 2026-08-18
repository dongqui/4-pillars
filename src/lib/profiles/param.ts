// URL 의 ?profile 해석. /report 와 /checkout 이 같은 파라미터를 읽으므로 여기 둔다 —
// 한쪽 라우트의 _lib 에 두면 다른 라우트가 남의 폴더 안을 import 하게 된다.

export type SearchParams = Record<string, string | string[] | undefined>;

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * ?profile 해석.
 *  - absent  : 파라미터 없음
 *  - invalid : 있지만 순번 id 형태가 아님
 * 둘을 가르는 이유: 호출자가 다르게 다뤄야 한다. /report 는 absent 를 픽스처 데모로,
 * /checkout 은 둘 다 notFound 로 보낸다. 잘못된 값을 데모로 떨어뜨리면 사용자는
 * 남의 리포트를 보고 있다고 오해한다.
 * 형식 검사를 여기서 하는 이유: URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다.
 */
export type ProfileParam =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "id"; id: string };

// bigint 상한(signed 64bit, 2^63-1). tsconfig target(ES2017)이 BigInt 리터럴 표기
// (예: 123n)를 지원하지 않아 문자열로 생성한다.
const MAX_BIGINT_ID = BigInt("9223372036854775807");

/**
 * 순번 id 로 쓸 수 있는 문자열인지. 선행 0 을 배제하고 bigint 상한을 넘지 않는지 본다.
 *
 * 자릿수만 세는 정규식은 19자리 안에서도 상한을 넘는 값(예: "9999999999999999999")을
 * 못 거른다. 값 자체를 BigInt 로 비교해 ::bigint 캐스팅이 절대 넘치지 않게 한다 —
 * 넘치면 Postgres 에러가 그대로 올라가 500 이 된다.
 *
 * ?profile 뿐 아니라 다른 라우트의 순번 id 파라미터(예: /api/consultations/[id])도
 * 같은 규칙을 쓴다 — 규칙을 두 번 손으로 베끼면 한쪽만 고쳐질 때 이 클래스의 버그가
 * 되돌아온다.
 */
export function isSequentialId(raw: string): boolean {
  // 선행 0("007")은 배제한다 — 순번 id에 선행 0은 없고, 허용하면 같은 대상이
  // "12"와 "007…" 두 URL을 갖게 돼 캐시·공유 링크가 갈린다.
  if (!/^[1-9]\d*$/.test(raw)) return false;
  return BigInt(raw) <= MAX_BIGINT_ID;
}

export function parseProfileParam(searchParams: SearchParams): ProfileParam {
  const raw = first(searchParams.profile);
  if (raw === undefined) return { kind: "absent" };
  return isSequentialId(raw) ? { kind: "id", id: raw } : { kind: "invalid" };
}
