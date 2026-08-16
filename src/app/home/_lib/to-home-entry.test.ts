import { test, expect, vi } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import { characterById } from "@/lib/saju-core/character";
import { toAnonEntry, toHomeEntry } from "./to-home-entry";

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

test("이름 없는 익명 캐릭터는 '나'로 선다", () => {
  const entry = toAnonEntry(characterById(0), null);
  expect(entry.name).toBe("나");
  expect(entry.initial).toBe("나");
  expect(entry.profileId).toBeNull();
  expect(entry.character?.key).toBe("갑자");
});
