import type { ProfileKind, ProfileRow } from "@/lib/profiles/store";

/** 선택 목록 한 줄. 화면이 ProfileRow 를 통째로 들고 다니지 않게 좁혀 넘긴다. */
export interface PersonOption {
  id: string;
  name: string;
  initial: string;
  /** "1990.04.05" */
  birthLabel: string;
  kind: ProfileKind;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toPersonOption(profile: ProfileRow): PersonOption {
  const { year, month, day } = profile.birth;
  const name = profile.name.trim();
  return {
    id: profile.id,
    name,
    // 빈 이름은 DB 제약이 막지만, 막히지 않은 값이 아바타를 비우게 두지 않는다
    // (checkout/_lib/to-order.ts 와 같은 판단).
    initial: Array.from(name)[0] ?? "?",
    birthLabel: `${year}.${pad(month)}.${pad(day)}`,
    kind: profile.kind,
  };
}
