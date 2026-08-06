import type { UserProfile } from "./users";

/** 소셜 제공자가 이름을 안 주거나 공백만 주는 경우가 있다. */
const FALLBACK = "회원";

/** 헤더·내비에 찍을 표시 이름. 어떤 입력이 와도 빈 문자열을 돌려주지 않는다. */
export function resolveDisplayName(user: Pick<UserProfile, "displayName"> | null): string {
  return user?.displayName?.trim() || FALLBACK;
}

/** 아바타에 넣을 첫 글자. 서로게이트 페어(이모지)를 반 토막 내지 않으려고 전개한다. */
export function displayInitial(displayName: string): string {
  return [...displayName][0] ?? "?";
}
