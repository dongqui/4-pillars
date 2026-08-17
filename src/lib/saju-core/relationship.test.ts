import { describe, expect, it } from "vitest";

import {
  BRANCH_CHUNG,
  BRANCH_HAP,
  BRANCH_ORDER,
  type Branch,
} from "./data/branches";
import { STEM_ORDER, type Stem } from "./data/stems";
import {
  RELATION_LABELS,
  getRelation,
  type RelationKind,
} from "./relationship";

function pillar(key: string) {
  const [stem, branch] = Array.from(key) as [Stem, Branch];
  return { stem, branch };
}

/** 나 → 친구 관계 분류만 뽑는다 */
function kindOf(me: string, friend: string): RelationKind {
  return getRelation(pillar(me), pillar(friend)).kind;
}

describe("5분류 — 나(일간) 기준 친구 일간", () => {
  it("갑목이 보는 10천간", () => {
    // 목: 동일 / 화: 내가 생 / 토: 내가 극 / 금: 나를 극 / 수: 나를 생
    expect(kindOf("갑자", "갑자")).toBe("비아");
    expect(kindOf("갑자", "을축")).toBe("비아");
    expect(kindOf("갑자", "병인")).toBe("아생");
    expect(kindOf("갑자", "정묘")).toBe("아생");
    expect(kindOf("갑자", "무진")).toBe("아극");
    expect(kindOf("갑자", "기사")).toBe("아극");
    expect(kindOf("갑자", "경오")).toBe("극아");
    expect(kindOf("갑자", "신미")).toBe("극아");
    expect(kindOf("갑자", "임신")).toBe("생아");
    expect(kindOf("갑자", "계유")).toBe("생아");
  });

  it("일간 10×10 전수 — 관계가 뒤집히면 짝이 되는 분류로 돌아온다", () => {
    const opposite: Record<RelationKind, RelationKind> = {
      비아: "비아",
      생아: "아생",
      아생: "생아",
      극아: "아극",
      아극: "극아",
    };
    for (const a of STEM_ORDER) {
      for (const b of STEM_ORDER) {
        const forward = getRelation({ stem: a, branch: "자" }, { stem: b, branch: "자" });
        const backward = getRelation({ stem: b, branch: "자" }, { stem: a, branch: "자" });
        expect(backward.kind).toBe(opposite[forward.kind]);
      }
    }
  });

  it("5분류가 모두 나온다", () => {
    const kinds = new Set<RelationKind>();
    for (const a of STEM_ORDER) {
      for (const b of STEM_ORDER) {
        kinds.add(getRelation({ stem: a, branch: "자" }, { stem: b, branch: "자" }).kind);
      }
    }
    expect(kinds.size).toBe(5);
  });

  it("노출명은 데이터로 분리되어 있다", () => {
    expect(RELATION_LABELS.생아.name).toBe("귀인");
    expect(getRelation(pillar("갑자"), pillar("임신")).label).toBe("귀인");
  });
});

describe("배지 — 일지 관계", () => {
  const HAP: [Branch, Branch][] = [
    ["자", "축"],
    ["인", "해"],
    ["묘", "술"],
    ["진", "유"],
    ["사", "신"],
    ["오", "미"],
  ];
  const CHUNG: [Branch, Branch][] = [
    ["자", "오"],
    ["축", "미"],
    ["인", "신"],
    ["묘", "유"],
    ["진", "술"],
    ["사", "해"],
  ];

  it("육합 6쌍이 양방향으로 발화한다", () => {
    for (const [a, b] of HAP) {
      expect(getRelation({ stem: "갑", branch: a }, { stem: "갑", branch: b }).badges).toContain("육합");
      expect(getRelation({ stem: "갑", branch: b }, { stem: "갑", branch: a }).badges).toContain("육합");
    }
  });

  it("충 6쌍이 양방향으로 발화한다", () => {
    for (const [a, b] of CHUNG) {
      expect(getRelation({ stem: "갑", branch: a }, { stem: "갑", branch: b }).badges).toContain("충");
      expect(getRelation({ stem: "갑", branch: b }, { stem: "갑", branch: a }).badges).toContain("충");
    }
  });

  it("합·충 대상이 아닌 지지 쌍은 배지가 없다", () => {
    const isPaired = (a: Branch, b: Branch) =>
      [...HAP, ...CHUNG].some(([x, y]) => (x === a && y === b) || (x === b && y === a));

    for (const a of BRANCH_ORDER) {
      for (const b of BRANCH_ORDER) {
        if (a === b || isPaired(a, b)) continue;
        expect(getRelation({ stem: "갑", branch: a }, { stem: "을", branch: b }).badges).toEqual([]);
      }
    }
  });

  it("일주가 완전히 같으면 동일일주 배지", () => {
    const r = getRelation(pillar("경오"), pillar("경오"));
    expect(r.badges).toEqual(["동일일주"]);
    expect(r.kind).toBe("비아");
  });

  it("천간만 같고 지지가 다르면 동일일주가 아니다", () => {
    expect(getRelation(pillar("경오"), pillar("경자")).badges).not.toContain("동일일주");
  });

  it("v1 스코프 — 삼합·형·해·파는 배지로 나오지 않는다", () => {
    const allowed = new Set(["육합", "충", "동일일주"]);
    for (const a of BRANCH_ORDER) {
      for (const b of BRANCH_ORDER) {
        for (const badge of getRelation({ stem: "갑", branch: a }, { stem: "갑", branch: b }).badges) {
          expect(allowed.has(badge)).toBe(true);
        }
      }
    }
  });

  it("한 쌍에 배지가 둘 이상 붙지 않는다", () => {
    for (const s1 of STEM_ORDER) {
      for (const b1 of BRANCH_ORDER) {
        for (const b2 of BRANCH_ORDER) {
          const r = getRelation({ stem: s1, branch: b1 }, { stem: s1, branch: b2 });
          expect(r.badges.length).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("지지 관계 테이블", () => {
  it("육합·충은 서로를 가리키고 자기 자신과 짝이 되지 않는다", () => {
    for (const b of BRANCH_ORDER) {
      expect(BRANCH_HAP[BRANCH_HAP[b]]).toBe(b);
      expect(BRANCH_CHUNG[BRANCH_CHUNG[b]]).toBe(b);
      expect(BRANCH_HAP[b]).not.toBe(b);
      expect(BRANCH_CHUNG[b]).not.toBe(b);
    }
  });

  it("충은 12지지에서 마주 보는 자리(6칸 차이)다", () => {
    for (const [i, b] of BRANCH_ORDER.entries()) {
      expect(BRANCH_ORDER.indexOf(BRANCH_CHUNG[b])).toBe((i + 6) % 12);
    }
  });

  it("육합은 자축을 축으로 접었을 때 마주 보는 자리다", () => {
    // 자(0)+축(1)=1, 인(2)+해(11)=13 … 모두 12로 나눈 나머지가 1
    for (const [i, b] of BRANCH_ORDER.entries()) {
      expect((i + BRANCH_ORDER.indexOf(BRANCH_HAP[b])) % 12).toBe(1);
    }
  });

  it("육합과 충은 같은 짝을 지목하지 않는다", () => {
    for (const b of BRANCH_ORDER) {
      expect(BRANCH_HAP[b]).not.toBe(BRANCH_CHUNG[b]);
    }
  });
});

describe("일간 10×10 전수 매트릭스", () => {
  it("행=나, 열=친구", () => {
    const header = `      ${STEM_ORDER.map((s) => s.padEnd(4)).join("")}`;
    const rows = STEM_ORDER.map((me) => {
      const cells = STEM_ORDER.map((friend) =>
        getRelation({ stem: me, branch: "자" }, { stem: friend, branch: "자" }).kind.padEnd(4),
      );
      return `${me}    ${cells.join("")}`;
    });
    expect([header, ...rows].join("\n")).toMatchInlineSnapshot(`
      "      갑   을   병   정   무   기   경   신   임   계   
      갑    비아  비아  아생  아생  아극  아극  극아  극아  생아  생아  
      을    비아  비아  아생  아생  아극  아극  극아  극아  생아  생아  
      병    생아  생아  비아  비아  아생  아생  아극  아극  극아  극아  
      정    생아  생아  비아  비아  아생  아생  아극  아극  극아  극아  
      무    극아  극아  생아  생아  비아  비아  아생  아생  아극  아극  
      기    극아  극아  생아  생아  비아  비아  아생  아생  아극  아극  
      경    아극  아극  극아  극아  생아  생아  비아  비아  아생  아생  
      신    아극  아극  극아  극아  생아  생아  비아  비아  아생  아생  
      임    아생  아생  아극  아극  극아  극아  생아  생아  비아  비아  
      계    아생  아생  아극  아극  극아  극아  생아  생아  비아  비아  "
    `);
  });
});
