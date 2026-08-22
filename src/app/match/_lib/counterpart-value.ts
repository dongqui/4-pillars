import type { CreateProfileBody } from "@/lib/profiles/input";
import { personOptionFromInput, type PersonOption } from "./to-person-option";

/**
 * 상대 선택값. "saved" 는 이미 있는 프로필 id 하나, "new" 는 즉석 입력 —
 * MatchForm 이 이 kind 로 submit 본문의 두 필드(counterpartProfileId | counterpart) 중
 * 정확히 하나만 채운다. name 은 두 갈래 모두에 둬서 RelationPicker 가 프로필을
 * 다시 조회하지 않고 라벨에 바로 쓸 수 있게 한다.
 */
export type CounterpartValue =
  | { kind: "saved"; profileId: string; name: string }
  /** save: 이 사람을 다음에도 목록에 둘 것인가 — 그대로 saveCounterpart 로 나간다 */
  | { kind: "new"; input: CreateProfileBody; name: string; save: boolean };

/**
 * 즉석 입력한 상대가 목록에서 차지하는 id.
 *
 * profiles.id 는 순번 bigint 라 숫자 문자열이다 — 숫자가 아닌 값을 쓰면 저장된
 * 사람의 id 와 절대 겹치지 않는다.
 */
export const NEW_COUNTERPART_ID = "new";

/**
 * 즉석 입력한 상대를 목록의 한 줄로 만든다.
 *
 * 시안은 입력을 마치면 그 사람이 드롭다운 목록에 들어가 선택된 채로 보인다 —
 * 저장된 사람과 같은 줄 모양을 쓴다. 아직 프로필 행이 없으므로(만드는 건 제출
 * 시점의 /api/matches 다) 여기서 표시용 줄만 만들어 끼운다.
 */
export function newCounterpartOption(input: CreateProfileBody, save: boolean): PersonOption {
  return personOptionFromInput(NEW_COUNTERPART_ID, input, save);
}

/**
 * "나" 가 바뀐 뒤에도 유효한 상대인가.
 *
 * 같은 사람을 나와 상대로 동시에 고를 수 없다. 상대로 골라 둔 사람을 "나" 로 바꾸면
 * 그 사람은 상대 후보 목록에서 빠지는데, 선택값이 그대로 남으면 아무 줄도 강조되지
 * 않은 채 제출이 열려 있고 서버가 "다른 사람을 선택해 주세요" 로 되돌린다.
 *
 * 즉석 입력(kind==='new')은 프로필 id 가 없어 "나" 와 겹칠 수 없으므로 그대로 둔다.
 */
export function counterpartAfterSubjectChange(
  counterpart: CounterpartValue | null,
  subjectId: string,
): CounterpartValue | null {
  if (counterpart?.kind === "saved" && counterpart.profileId === subjectId) return null;
  return counterpart;
}
