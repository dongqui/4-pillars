import type { CreateProfileBody } from "@/lib/profiles/input";
import type { ProfileRow } from "@/lib/profiles/store";

/** 선택 목록 한 줄. 화면이 ProfileRow 를 통째로 들고 다니지 않게 좁혀 넘긴다. */
export interface PersonOption {
  id: string;
  name: string;
  initial: string;
  /** "1990.04.05 · 07:20" 또는 "1990.04.05 · 시간 모름" */
  birthLabel: string;
  /**
   * 목록에 남는 사람인가. 서버에서 온 줄은 언제나 true 이고(listProfiles 가 temp 를
   * 이미 걸러낸다), false 는 이번 화면에서 "저장 안 함" 으로 방금 넣은 줄뿐이다.
   * 그 줄에만 "· 저장 안 함" 이 붙는다.
   *
   * ⚠️ "나 칸이냐 상대 칸이냐" 는 여기 없다. 두 칸이 같은 목록을 쓴다 — 같은 사람을
   * 어느 문으로 넣었는지로 고를 수 있는 칸을 가르던 구분은 없앴다.
   */
  saved: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 목록 두 번째 줄. 생년월일만으로는 동명이인을 가를 수 없어 시각까지 붙인다. */
export function birthLabelOf(profile: {
  birth: { year: number; month: number; day: number };
  time: { hour: number; minute: number } | null;
}): string {
  const { year, month, day } = profile.birth;
  const date = `${year}.${pad(month)}.${pad(day)}`;
  return profile.time
    ? `${date} · ${pad(profile.time.hour)}:${pad(profile.time.minute)}`
    : `${date} · 시간 모름`;
}

export function toPersonOption(profile: ProfileRow): PersonOption {
  const name = profile.name.trim();
  return {
    id: profile.id,
    name,
    // 빈 이름은 DB 제약이 막지만, 막히지 않은 값이 아바타를 비우게 두지 않는다
    // (home/_lib/to-home-entry.ts 의 initialOf 와 같은 판단).
    initial: Array.from(name)[0] ?? "?",
    birthLabel: birthLabelOf(profile),
    saved: profile.kind === "saved",
  };
}

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
