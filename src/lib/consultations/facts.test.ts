import { describe, it, expect } from "vitest";
import { factsForProfile } from "./facts";
import type { ProfileRow } from "@/lib/profiles/store";

const profile: ProfileRow = {
  id: "12",
  name: "김동진",
  kind: "saved",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
  createdAt: "2026-07-31T00:00:00.000Z",
  isUnlocked: false,
};

describe("factsForProfile", () => {
  it("사실 블록을 만든다", () => {
    const facts = factsForProfile(profile);
    // string | null 이라 타입가드 없이 facts.length 를 쓰면 strict 모드에서 막힌다.
    expect(facts).not.toBeNull();
    expect(facts?.length ?? 0).toBeGreaterThan(0);
  });

  it("이름을 담지 않는다 — 사실 블록에 개인정보가 새면 안 된다", () => {
    expect(factsForProfile(profile)).not.toContain("김동진");
  });

  it("생년을 담지 않는다", () => {
    expect(factsForProfile(profile)).not.toContain("1990");
  });

  it("계산할 수 없는 생년월일이면 null 이다 — 상담 하나 때문에 500 이 되면 안 된다", () => {
    const broken = { ...profile, birth: { year: 1700, month: 1, day: 1 } };
    expect(factsForProfile(broken)).toBeNull();
  });

  // ─── 원국과 요즘 흐름 (대화 설계 §12·§16) ───
  const AT = new Date("2026-08-31T03:00:00.000Z");

  it("원국과 요즘 흐름을 라벨로 갈라 함께 세운다", () => {
    const facts = factsForProfile(profile, AT);
    expect(facts).toContain("[사실 · 원국]");
    expect(facts).toContain("[사실 · 요즘 흐름]");
  });

  it("원국이 흐름보다 앞에 선다 — 성향이 먼저, 지나가는 것이 나중이다", () => {
    const facts = factsForProfile(profile, AT) ?? "";
    expect(facts.indexOf("[사실 · 원국]")).toBeLessThan(facts.indexOf("[사실 · 요즘 흐름]"));
  });

  it("흐름을 잴 수 없어도 원국은 남는다 — 세 줄 때문에 상담이 막히면 안 된다", () => {
    // 만세력 범위 밖 시각이라 luckFacts 가 null 을 준다.
    const facts = factsForProfile(profile, new Date("2400-01-01T00:00:00.000Z"));
    expect(facts).toContain("[사실 · 원국]");
    expect(facts).not.toContain("[사실 · 요즘 흐름]");
  });

  it("흐름 블록에도 나이가 새지 않는다", () => {
    expect(factsForProfile(profile, AT)).not.toMatch(/\d+세/);
  });
});
