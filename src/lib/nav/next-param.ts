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
