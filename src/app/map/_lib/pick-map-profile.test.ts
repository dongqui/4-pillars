import { describe, expect, it } from "vitest";
import { pickMapProfile } from "./pick-map-profile";

// 일주가 서는 생년월일(만세력 1900~2050 안)과 안 서는 것(2200년).
const ok = (id: string) => ({ id, birth: { year: 1990, month: 10, day: 25 }, calendar: "solar" as const, isLeapMonth: false });
const bad = (id: string) => ({ id, birth: { year: 2200, month: 1, day: 1 }, calendar: "solar" as const, isLeapMonth: false });
const toBirth = (p: ReturnType<typeof ok>) => ({ ...p.birth, calendar: p.calendar, isLeapMonth: p.isLeapMonth });

describe("pickMapProfile", () => {
  it("요청한 id 가 목록에 있으면 그것을 고른다", () => {
    const list = [ok("7"), ok("2")];
    expect(pickMapProfile({ asked: "7", primaryId: "2", profiles: list, toBirth })?.id).toBe("7");
  });

  // 남의 프로필, temp 프로필, 지워진 프로필은 전부 listProfiles 결과에 없다 —
  // 세 경우가 여기서 한 갈래로 합쳐진다. 404 로 끊지 않고 내 지도로 보낸다.
  it("요청한 id 가 목록에 없으면 primary 로 떨어진다", () => {
    const list = [ok("7"), ok("2")];
    expect(pickMapProfile({ asked: "999", primaryId: "2", profiles: list, toBirth })?.id).toBe("2");
  });

  it("asked 가 없으면 primary", () => {
    const list = [ok("7"), ok("2")];
    expect(pickMapProfile({ asked: null, primaryId: "2", profiles: list, toBirth })?.id).toBe("2");
  });

  // primary 의 생년월일로 일주가 안 서면 지도를 세울 수 없다. 영구 404 가 되는
  // 지도를 만들어 두면 되돌릴 방법이 없으므로, 중심이 실제로 서는 프로필로 간다.
  it("primary 의 중심이 안 서면 중심이 서는 프로필로 물러선다", () => {
    const list = [ok("7"), bad("2")];
    expect(pickMapProfile({ asked: null, primaryId: "2", profiles: list, toBirth })?.id).toBe("7");
  });

  // listProfiles 는 최신순이라 가장 오래된 것이 마지막이다. 퍼널을 처음 끝냈을 때
  // 만들어진 것이 그 계정의 첫 프로필이고, 그게 나일 확률이 가장 높다.
  it("물러설 때는 가장 오래된 것부터 본다", () => {
    const list = [ok("9"), ok("7")];
    expect(pickMapProfile({ asked: null, primaryId: null, profiles: list, toBirth })?.id).toBe("7");
  });

  it("하나도 중심이 안 서면 null", () => {
    expect(pickMapProfile({ asked: null, primaryId: null, profiles: [bad("2")], toBirth })).toBeNull();
  });

  it("목록이 비면 null", () => {
    expect(pickMapProfile({ asked: null, primaryId: null, profiles: [], toBirth })).toBeNull();
  });

  // 요청한 id 의 중심이 안 서면 그 프로필로는 지도를 만들 수 없다 — primary 로 간다.
  it("요청한 id 의 중심이 안 서면 primary 로 떨어진다", () => {
    const list = [bad("7"), ok("2")];
    expect(pickMapProfile({ asked: "7", primaryId: "2", profiles: list, toBirth })?.id).toBe("2");
  });
});
