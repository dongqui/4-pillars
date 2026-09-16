/**
 * ?next 로 받은 복귀 경로를 안전한 값으로 접는다.
 *
 * ⚠️ 검사 없이 redirect() 나 router.replace() 에 넘기면 오픈 리다이렉트다.
 * /checkout?next=https://evil.example 한 줄로, 우리 도메인에서 출발해 결제까지
 * 마친 사용자를 남의 사이트에 떨어뜨릴 수 있다.
 *
 * 거절이 아니라 기본값으로 접는 이유: 이 값은 사용자가 적은 것이 아니라 우리 화면이
 * 붙인 것이다. 이상한 값이 왔다면 버그거나 공격인데, 어느 쪽이든 사용자에게
 * 오류 화면을 보여줄 이유는 없다 — 홈으로 보낸다.
 */
export const DEFAULT_NEXT = "/home";

export function safeNextPath(raw: string | undefined | null): string {
  if (typeof raw !== "string") return DEFAULT_NEXT;
  // C0 제어문자(0x00–0x1F), DEL(0x7F), C1 제어문자(0x80–0x9F)는 이후 검사를 우회하거나
  // Location 헤더를 오염시킬 수 있다.
  if ([...raw].some((c) => {
    const code = c.charCodeAt(0);
    return code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
  })) return DEFAULT_NEXT;
  if (!raw.startsWith("/")) return DEFAULT_NEXT;
  // "//evil.example" 는 스킴 상대 URL, "/\evil.example" 는 그 브라우저별 변형이다.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_NEXT;
  return raw;
}

/**
 * "지금 이 화면으로 돌아오는" 로그인 링크.
 *
 * 로그인을 요구하는 서버 컴포넌트는 자기가 어디인지 알아서 `?next=` 를 손으로 붙일 수
 * 있지만(`/map`, `/flow`, …), 화면 위에 얹혀 있는 조각(헤더 메뉴)은 현재 경로를
 * 런타임에 읽어 넘긴다 — 그 계산을 각자 하면 인코딩을 빼먹는 자리가 생긴다.
 *
 * path 를 safeNextPath 에 통과시키는 이유는 방어가 아니라 기본값이다: usePathname 이
 * 아직 아무것도 주지 않는 순간에도 링크가 /home 으로는 간다.
 */
export function loginHref(path: string | undefined | null): string {
  return `/login?next=${encodeURIComponent(safeNextPath(path))}`;
}
