import { birthInstant, flowYearAt, type SajuAnalysis } from "@/lib/saju-core";

/**
 * 이 사람의 명리 출생 연도 — 달력 연도가 아니다.
 *
 * 세운은 입춘(2월 4일경)에 바뀐다. 입춘 전에 태어난 사람은 명리 출생 연도가 달력
 * 연도보다 하나 작다(예: 1990-01-15생은 명리로 1989년생). 생성 핸들러
 * (api/flows/_lib/handler.ts)와 선택 화면(app/flow/page.tsx)이 각자 이 계산을 다시
 * 하면 언젠가 갈린다 — 화면이 달력 연도로 칸을 거르면 서버가 파는 해를 화면이
 * 감추고, 반대로 화면이 보여준 해를 서버가 400 으로 막는다. 한 곳에 모아 둘 다
 * 같은 자로 잰다.
 *
 * SajuAnalysis 를 받는다(BirthInput 을 받아 안에서 analyze 를 다시 부르지 않는다) —
 * 호출부(handler.ts)가 같은 프로필의 analyze 결과를 대운·월별 흐름 계산에도
 * 재사용하므로, 여기서 또 analyze 를 돌리면 같은 원국을 두 번 계산하게 된다.
 */
export function sajuBirthYearOf(analysis: SajuAnalysis): number {
  return flowYearAt(birthInstant(analysis)).year;
}
