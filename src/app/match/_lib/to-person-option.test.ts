import { describe, expect, it } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import { personOptionFromInput, toPersonOption } from "./to-person-option";

const base: ProfileRow = {
  id: "1", name: "김동진", gender: "male", calendar: "solar", isLeapMonth: false,
  birth: { year: 1990, month: 4, day: 5 }, timeKnown: true, time: { hour: 9, minute: 0 },
  birthPlace: null, trueSolar: true, createdAt: "2026-01-01", isUnlocked: false, kind: "saved",
};

describe("toPersonOption", () => {
  // 생년월일만으로는 동명이인을 가를 수 없다 — 목록에서 두 줄이 똑같아 보이면
  // 어느 쪽이 내가 넣은 사람인지 알 방법이 없다.
  it("생년월일과 시각을 0 채움으로 한 줄에 보여준다", () => {
    expect(toPersonOption(base).birthLabel).toBe("1990.04.05 · 09:00");
  });

  it("시간을 모르는 사람은 시각 자리에 '시간 모름' 이 선다", () => {
    expect(toPersonOption({ ...base, timeKnown: false, time: null }).birthLabel).toBe(
      "1990.04.05 · 시간 모름",
    );
  });

  it("이니셜은 첫 글자다", () => {
    expect(toPersonOption(base).initial).toBe("김");
  });

  it("이름이 비면 물음표로 물러선다 — 아바타를 통째로 비우지 않는다", () => {
    expect(toPersonOption({ ...base, name: "  " }).initial).toBe("?");
  });

  // 두 칸(나·상대)이 같은 목록을 쓰므로 줄에 "어느 칸이냐" 를 실을 이유가 없다.
  // 남는 질문은 "목록에 남는가" 하나뿐이고, 서버에서 온 줄은 언제나 그렇다.
  it("서버에서 온 줄은 늘 saved 다 — listProfiles 가 temp 를 이미 걸렀다", () => {
    expect(toPersonOption(base).saved).toBe(true);
  });
});

describe("personOptionFromInput", () => {
  const input = {
    name: "새사람",
    gender: "female" as const,
    calendar: "solar" as const,
    isLeapMonth: false,
    birth: { year: 1993, month: 5, day: 4 },
    timeKnown: true,
    time: { hour: 7, minute: 20 },
    birthPlace: null,
    trueSolar: true,
  };

  it("방금 입력한 값으로 목록 줄을 만든다 — 서버를 다시 부르지 않는다", () => {
    expect(personOptionFromInput("42", input, true)).toEqual({
      id: "42",
      name: "새사람",
      initial: "새",
      birthLabel: "1993.05.04 · 07:20",
      saved: true,
    });
  });

  it("저장하지 않기로 했으면 saved=false — 목록이 '· 저장 안 함' 을 붙인다", () => {
    expect(personOptionFromInput("42", input, false).saved).toBe(false);
  });

  // timeKnown=false 인데 time 값이 남아 있을 수 있다(칸을 채운 뒤 '시간 몰라요' 를
  // 누른 경우). toProfileRow 와 같은 판단으로 timeKnown 쪽을 믿는다.
  it("시간을 모른다고 했으면 남아 있는 시각을 쓰지 않는다", () => {
    expect(personOptionFromInput("42", { ...input, timeKnown: false }, true).birthLabel).toBe(
      "1993.05.04 · 시간 모름",
    );
  });
});
