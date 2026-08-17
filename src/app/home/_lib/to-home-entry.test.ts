import { test, expect, vi } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import { createProfileSchema } from "@/lib/profiles/input";
import { toDraftEntry, toHomeEntry } from "./to-home-entry";

function row(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "p1",
    name: "동진",
    gender: "male",
    calendar: "solar",
    isLeapMonth: false,
    birth: { year: 1990, month: 10, day: 25 },
    timeKnown: false,
    time: null,
    birthPlace: null,
    trueSolar: true,
    createdAt: "2026-08-16T00:00:00.000Z",
    isPaid: false,
    ...overrides,
  };
}

test("프로필의 생년월일로 캐릭터를 세운다", () => {
  const entry = toHomeEntry(row());
  expect(entry.character?.key).toBe("계해");
  expect(entry.initial).toBe("동");
  expect(entry.profileId).toBe("p1");
});

test("시간을 몰라도 캐릭터는 나온다 — 일주는 날짜로 정해진다", () => {
  const withTime = toHomeEntry(row({ timeKnown: true, time: { hour: 15, minute: 20 } }));
  expect(withTime.character?.key).toBe(toHomeEntry(row()).character?.key);
});

test("계산할 수 없는 생년월일이면 캐릭터만 비우고 프로필은 남긴다", () => {
  // 만세력 지원 범위(1900~2050) 밖 — 홈 전체가 무너지면 안 된다
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const entry = toHomeEntry(row({ birth: { year: 2400, month: 1, day: 1 } }));
  expect(entry.character).toBeNull();
  expect(entry.name).toBe("동진");
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

test("드래프트도 프로필과 같은 줄로 선다 — 저장 전이라 profileId 만 없다", () => {
  const draft = createProfileSchema.parse({
    name: "지우",
    gender: "female",
    birth: { year: 1988, month: 3, day: 7 },
  });
  const entry = toDraftEntry(draft);

  expect(entry.name).toBe("지우");
  expect(entry.initial).toBe("지");
  expect(entry.character?.key).toBe("신유");
  expect(entry.profileId).toBeNull();
});
