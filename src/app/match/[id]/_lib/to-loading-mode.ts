import type { StoredMatchSections } from "@/app/api/matches/_lib/store";

/**
 * 저장 상태가 화면을 어떻게 가르는가.
 *
 * - complete : 전부 있다. <Suspense> 를 세우지 않아 스피너가 한 프레임도 스치지 않는다.
 * - partial  : 일부만 있다. 있는 것을 먼저 그리고 나머지를 기다린다.
 * - empty    : 하나도 없다. 순수 스피너만 — 히어로(이름·아바타)도 감춘다.
 */
export type MatchLoadingMode = "complete" | "partial" | "empty";

/**
 * JSX 안의 조건문이 아니라 여기서 정한다.
 *
 * 이 규칙이 이번 수정의 전부라서 테스트가 닿는 자리에 두었다. 예전에는 빠진 섹션이
 * 하나라도 있으면 화면 전체가 스피너였다 — 나머지가 DB 에 멀쩡히 있어도 한 섹션의
 * LLM 왕복이 끝날 때까지 아무것도 보이지 않았다. partial 이 그 볼모 잡힘을 푼다.
 */
export function matchLoadingMode(stored: StoredMatchSections): MatchLoadingMode {
  if (stored.missing.length === 0) return "complete";
  return Object.keys(stored.have).length > 0 ? "partial" : "empty";
}
