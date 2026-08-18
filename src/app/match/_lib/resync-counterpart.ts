import type { CreateProfileBody } from "@/lib/profiles/input";
import { toCounterpart, type Draft } from "./to-counterpart";
import type { PersonOption } from "./to-person-option";

/**
 * 상대 선택값. "saved" 는 이미 있는 프로필 id 하나, "new" 는 즉석 입력 —
 * MatchForm 이 이 kind 로 submit 본문의 두 필드(counterpartProfileId | counterpart) 중
 * 정확히 하나만 채운다. name 은 두 갈래 모두에 둬서 RelationPicker 가 프로필을
 * 다시 조회하지 않고 라벨에 바로 쓸 수 있게 한다.
 */
export type CounterpartValue =
  | { kind: "saved"; profileId: string; name: string }
  | { kind: "new"; input: CreateProfileBody; name: string };

/** 상대를 고르는 두 갈래 */
export type CounterpartSegment = "saved" | "new";

/**
 * 상대 선택값을 "지금 화면에 보이는 것" 에서 다시 계산한다.
 *
 * 이 규칙이 컴포넌트 밖의 순수 함수로 나와 있는 이유: 같은 상태 기계에서 화면과
 * 제출값이 어긋나는 버그가 세 번 났다. 컴포넌트 테스트 하네스가 없어(RTL 없음)
 * 규칙이 JSX 안에 있으면 회귀를 잡을 방법이 없다.
 *
 * 세 번의 어긋남이 모두 "무엇이 보이느냐" 와 "무엇이 제출되느냐" 가 서로 다른
 * 원천에서 나왔기 때문이라, 원천을 이 함수 하나로 못박는다.
 */
export function resyncCounterpart(args: {
  segment: CounterpartSegment;
  draft: Draft;
  /** 지금 선택돼 있다고 알고 있는 저장된 프로필 id */
  selectedSavedId: string | null;
  /** "나" 로 고른 사람을 뺀 목록 — 여기 없는 id 는 화면에 보이지 않는다 */
  candidates: PersonOption[];
}): CounterpartValue | null {
  if (args.segment === "new") {
    const input = toCounterpart(args.draft);
    return input ? { kind: "new", input, name: input.name } : null;
  }
  // candidates 에서 찾는다 — 목록에 없는 사람이 선택값으로 남는 일을 여기서 끊는다.
  const person = args.candidates.find((p) => p.id === args.selectedSavedId);
  return person ? { kind: "saved", profileId: person.id, name: person.name } : null;
}

/**
 * "나" 가 바뀐 뒤에도 유효한 상대인가.
 *
 * 같은 사람을 나와 상대로 동시에 고를 수 없다. 상대로 골라 둔 사람을 "나" 로 바꾸면
 * 그 사람은 상대 후보 목록에서 빠지는데, 선택값이 그대로 남으면 아무 카드도 강조되지
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
