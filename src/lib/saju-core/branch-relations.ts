// 지지(地支)끼리의 관계 — 서비스 중립 모듈.
//
// 두 종류를 명시적으로 가른다:
//   쌍 관계  충·형·해·파·원진·육합 — 두 글자로 판정이 끝난다
//   집합 관계 삼합·반합           — 세 글자가 있어야 완성된다
//
// 가르는 이유: 삼합을 2항 함수로 다루면(BRANCH_SAMHAP[a].includes(b)) 실제로는
// 반합인 것을 삼합으로 세어 과대평가한다. 궁합은 역사적으로 그 근사를 써 왔고
// 결과가 박제돼 있어 지금 고치지 않는다 — synastry.ts 를 볼 것.

import {
  BRANCH_CHUNG,
  BRANCH_HAE,
  BRANCH_HAP,
  BRANCH_HYEONG,
  BRANCH_PA,
  BRANCH_SAMHAP,
  BRANCH_WONJIN,
  type Branch,
} from "./data/branches";

export type PairKind = "육합" | "충" | "형" | "해" | "파" | "원진";

/** 지지 두 글자 사이의 관계 전부. 한 쌍이 둘 이상 걸릴 수 있다(자미는 해이자 원진). */
export function pairRelations(a: Branch, b: Branch): PairKind[] {
  const kinds: PairKind[] = [];
  if (BRANCH_HAP[a] === b) kinds.push("육합");
  if (BRANCH_CHUNG[a] === b) kinds.push("충");
  if (BRANCH_HYEONG[a].includes(b)) kinds.push("형");
  if (BRANCH_HAE[a] === b) kinds.push("해");
  if (BRANCH_PA[a] === b) kinds.push("파");
  if (BRANCH_WONJIN[a] === b) kinds.push("원진");
  return kinds;
}

export type SetKind = "삼합" | "반합";

export interface SetRelation {
  kind: SetKind;
  /** 실제로 모인 지지들. 삼합이면 3개, 반합이면 2개 */
  branches: Branch[];
}

/**
 * 주어진 지지 무리 안에서 성립하는 삼합·반합.
 *
 * 한 세트를 한 번만 낸다. 인·오·술 셋이 각자 서로를 가리키므로 그냥 훑으면 같은
 * 세트가 세 번 나온다 — 정렬한 키로 접는다.
 *
 * 중복된 지지(인이 둘)는 세트를 늘리지 않는다. 같은 글자가 두 장 있다고 삼합이
 * 두 벌 성립하지는 않는다.
 */
export function setRelations(branches: Branch[]): SetRelation[] {
  const present = new Set(branches);
  const seen = new Set<string>();
  const out: SetRelation[] = [];

  for (const b of present) {
    const [x, y] = BRANCH_SAMHAP[b];
    const full = [b, x, y];
    const key = [...full].sort().join("");
    if (seen.has(key)) continue;

    const found = full.filter((v) => present.has(v));
    if (found.length === 3) {
      seen.add(key);
      out.push({ kind: "삼합", branches: found });
    } else if (found.length === 2) {
      // 반합은 짝마다 다르므로 세트 키가 아니라 짝 키로 접는다.
      const halfKey = [...found].sort().join("");
      if (seen.has(halfKey)) continue;
      seen.add(halfKey);
      out.push({ kind: "반합", branches: found });
    }
  }

  return out;
}
