import { describe, it, expect } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import {
  FREE_SECTIONS,
  TOTAL_SECTIONS,
  countCaption,
  toProfileCard,
} from "./to-profile-card";

const base: ProfileRow = {
  id: "3",
  name: "김동진",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
  createdAt: "2026-07-31T00:00:00.000Z",
  isPaid: false,
};

describe("섹션 개수", () => {
  // 레지스트리에서 파생되므로 하드코딩이 아니다. 이 테스트는 티어가 실수로
  // 바뀌었을 때(무료 섹션을 유료로 돌리는 등) 알아채기 위한 핀이다.
  it("현재 레지스트리는 총 13개 / 무료 5개", () => {
    expect(TOTAL_SECTIONS).toBe(13);
    expect(FREE_SECTIONS).toBe(5);
  });
});

describe("toProfileCard", () => {
  it("이니셜은 이름 첫 글자", () => {
    expect(toProfileCard(base).initial).toBe("김");
  });

  it("오후 시각을 12시간제로 표기", () => {
    expect(toProfileCard(base).birthLabel).toBe("1990.10.25 · 오후 3시 20분");
  });

  it("자정은 오전 12시", () => {
    const card = toProfileCard({ ...base, time: { hour: 0, minute: 5 } });
    expect(card.birthLabel).toBe("1990.10.25 · 오전 12시 5분");
  });

  it("정오는 오후 12시", () => {
    const card = toProfileCard({ ...base, time: { hour: 12, minute: 0 } });
    expect(card.birthLabel).toBe("1990.10.25 · 오후 12시 0분");
  });

  it("시간을 모르면 시각 자리에 안내를 넣는다", () => {
    const card = toProfileCard({ ...base, timeKnown: false, time: null });
    expect(card.birthLabel).toBe("1990.10.25 · 시간 모름");
  });

  it("음력 프로필은 입력한 날짜에 (음력)을 붙인다", () => {
    const card = toProfileCard({ ...base, calendar: "lunar" });
    expect(card.birthLabel).toBe("1990.10.25 (음력) · 오후 3시 20분");
  });

  it("월/일을 두 자리로 채운다", () => {
    const card = toProfileCard({ ...base, birth: { year: 1963, month: 4, day: 2 } });
    expect(card.birthLabel).toContain("1963.04.02");
  });

  it("미결제는 무료 섹션만 열린다", () => {
    const card = toProfileCard(base);
    expect(card.isPaid).toBe(false);
    expect(card.openedSections).toBe(FREE_SECTIONS);
    expect(card.totalSections).toBe(TOTAL_SECTIONS);
  });

  it("결제 완료는 전체 섹션이 열린다", () => {
    const card = toProfileCard({ ...base, isPaid: true });
    expect(card.openedSections).toBe(TOTAL_SECTIONS);
  });

  it("리포트 링크에 프로필 id를 붙인다", () => {
    expect(toProfileCard(base).reportHref).toBe("/report?profile=3");
  });
});

describe("countCaption", () => {
  it("전체 개수와 결제된 개수를 함께 센다", () => {
    const cards = [
      toProfileCard(base),
      toProfileCard({ ...base, id: "4", isPaid: true }),
      toProfileCard({ ...base, id: "5", isPaid: true }),
    ];
    expect(countCaption(cards)).toBe("3개 · 전체 리포트 2개");
  });

  it("비어 있으면 0개", () => {
    expect(countCaption([])).toBe("0개 · 전체 리포트 0개");
  });
});
