import type { CreateProfileBody } from "@/lib/profiles/input";
import { birthLabelOf, type PersonOption } from "@/lib/profiles/option";

/**
 * 사람 한 줄의 모양은 궁합만의 것이 아니다 — 상담의 "상담에 쓰는 사주" 도 같은 줄을
 * 쓴다. 그래서 타입과 서버 행 변환은 `@/lib/profiles/option` 에 있고, 여기서 다시
 * 내보낸다(기존 import 경로를 그대로 둔다). 이 파일에 남은 것은 궁합에만 있는 것 —
 * 아직 행이 없는, 방금 입력한 사람의 줄이다.
 */
export { birthLabelOf, toPersonOption } from "@/lib/profiles/option";
export type { PersonOption } from "@/lib/profiles/option";

/**
 * 방금 입력한 사람의 줄. 서버가 돌려준 행을 다시 조회하지 않고 화면이 들고 있는
 * 입력값으로 만든다 — 화면에 이미 있는 정보라 왕복이 필요 없다.
 *
 * 즉석 입력한 상대는 아직 행이 없어 id 가 없다(NEW_COUNTERPART_ID 가 그 자리를
 * 대신한다). 내 사주는 이미 만들어진 뒤라 진짜 id 가 들어온다.
 */
export function personOptionFromInput(
  id: string,
  input: CreateProfileBody,
  saved: boolean,
): PersonOption {
  const name = input.name.trim();
  return {
    id,
    name,
    initial: Array.from(name)[0] ?? "?",
    birthLabel: birthLabelOf({ birth: input.birth, time: input.timeKnown ? input.time : null }),
    saved,
  };
}
