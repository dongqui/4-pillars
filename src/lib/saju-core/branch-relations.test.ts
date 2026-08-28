import { describe, expect, it } from "vitest";
import { pairRelations, setRelations } from "./branch-relations";

describe("pairRelations", () => {
  it("자오는 충이다", () => {
    expect(pairRelations("자", "오")).toContain("충");
  });

  it("자축은 육합이다", () => {
    expect(pairRelations("자", "축")).toContain("육합");
  });

  it("한 쌍이 둘 이상 걸릴 수 있다 — 자미는 해이자 원진이다", () => {
    const kinds = pairRelations("자", "미");
    expect(kinds).toContain("해");
    expect(kinds).toContain("원진");
  });

  it("삼합은 여기서 나오지 않는다 — 두 글자로 판정할 관계가 아니다", () => {
    expect(pairRelations("인", "오")).not.toContain("삼합");
  });

  it("관계가 없으면 빈 배열", () => {
    expect(pairRelations("자", "자")).toEqual([]);
  });
});

describe("setRelations", () => {
  it("세 지지가 다 모이면 삼합이다", () => {
    const out = setRelations(["인", "오", "술"]);
    expect(out).toEqual([{ kind: "삼합", branches: ["인", "오", "술"] }]);
  });

  it("둘만 있으면 반합이다 — 삼합이 아니다", () => {
    const out = setRelations(["인", "오"]);
    expect(out).toEqual([{ kind: "반합", branches: ["인", "오"] }]);
  });

  it("하나만 있으면 아무것도 아니다", () => {
    expect(setRelations(["인"])).toEqual([]);
  });

  it("같은 세트를 한 번만 센다 — 세 글자가 서로를 세 번 가리켜도 하나다", () => {
    expect(setRelations(["인", "오", "술"])).toHaveLength(1);
  });

  it("중복된 지지가 있어도 세트는 하나다 — 인이 둘이어도 삼합은 하나", () => {
    expect(setRelations(["인", "인", "오", "술"])).toEqual([
      { kind: "삼합", branches: ["인", "오", "술"] },
    ]);
  });

  it("두 세트가 동시에 성립하면 둘 다 낸다", () => {
    const out = setRelations(["인", "오", "술", "신", "자", "진"]);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.kind === "삼합")).toBe(true);
  });
});
