import type { CreateProfileBody } from "@/lib/profiles/input";
import type { ProfileRow } from "@/lib/profiles/store";

/**
 * 리포트 한 장을 만드는 데 필요한 값. 저장된 프로필과 아직 계정이 없는 익명 드래프트가
 * 이 모양을 공유한다 — 무료 리포트는 로그인 전에도 실데이터로 보여줘야 하기 때문이다.
 *
 * id·결제 여부는 없다. 그 둘은 "무엇을 보여줄지"가 아니라 "어디로 보낼지"의 문제라
 * 페이지가 따로 들고 있는다.
 */
export type ReportSubject = Pick<
  ProfileRow,
  "name" | "gender" | "calendar" | "isLeapMonth" | "birth" | "time" | "birthPlace" | "trueSolar"
>;

/**
 * 드래프트를 리포트 주체로 옮긴다.
 *
 * `timeKnown` 이 false 면 시각을 버린다 — toProfileRow 가 DB 행에 하는 것과 같은 처리다.
 * 두 곳이 어긋나면 로그인 전후로 시주가 달라진 리포트가 나온다.
 */
export function draftToSubject(draft: CreateProfileBody): ReportSubject {
  return {
    name: draft.name,
    gender: draft.gender,
    calendar: draft.calendar,
    isLeapMonth: draft.isLeapMonth,
    birth: draft.birth,
    time: draft.timeKnown ? draft.time : null,
    birthPlace: draft.birthPlace,
    trueSolar: draft.trueSolar,
  };
}
