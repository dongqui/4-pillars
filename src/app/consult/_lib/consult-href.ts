/**
 * 상담 목록으로 돌아가는 링크.
 *
 * 목록이 프로필로 걸러지므로(listConsultations) 돌아갈 때 그 프로필을 실어야 한다.
 * 프로필 없이 /consult 로 가면 계정의 "나" 목록이 열려, 다른 사람으로 연 상담에서
 * 돌아온 사용자는 방금 나온 상담이 없는 목록을 본다.
 *
 * profileId 가 null 이면(profile_id 가 NULL 인 옛 상담) 돌아갈 사람이 없다 — "나" 로 간다.
 */
export function consultListHref(profileId: string | null): string {
  return profileId === null ? "/consult" : `/consult?profile=${encodeURIComponent(profileId)}`;
}

/**
 * 이용권을 사러 갔다가 상담 목록으로 돌아오는 링크.
 *
 * next 를 통째로 인코딩한다 — 안 하면 next 안의 ? 와 = 가 /checkout 자신의 쿼리로 새어
 * profile 이 checkout 의 파라미터가 되어 버린다. /checkout 은 next 를 safeNextPath 로
 * 거르는데, "/" 로 시작하는 같은 사이트 경로라 쿼리가 붙어 있어도 통과한다.
 */
export function consultCheckoutHref(profileId: string | null): string {
  return `/checkout?next=${encodeURIComponent(consultListHref(profileId))}`;
}
