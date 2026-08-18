import { describe, it, expect } from "vitest";
import { buildPillars } from "@/lib/saju-core";
import type { BirthLite, MapPersonRow } from "@/lib/maps/types";
import { centerOf, dayPillarOf, toMapPerson } from "./to-map-people";

const BASE = { year: 1990, month: 5, day: 15 } as const;

function solar(year: number, month: number, day: number): BirthLite {
  return { year, month, day, calendar: "solar", isLeapMonth: false };
}

/** 기준일에서 n 일 뒤. 일주는 하루에 한 칸씩 도므로 60일이면 60갑자를 한 바퀴 돈다. */
function shift(n: number): BirthLite {
  const d = new Date(Date.UTC(BASE.year, BASE.month - 1, BASE.day + n));
  return solar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function row(id: string, birth: BirthLite): MapPersonRow {
  return { id, name: `p${id}`, ...birth };
}

/** 일지가 branch 인 첫 날. 지지는 12일마다 돌아오므로 60일 안에 반드시 있다. */
function firstWithBranch(branch: string): BirthLite {
  for (let n = 0; n < 60; n++) {
    const b = shift(n);
    if (buildPillars(b).day.branch === branch) return b;
  }
  throw new Error(`일지 ${branch} 를 60일 안에서 못 찾았다`);
}

/** 일간이 stem 인 첫 날. 천간은 10일마다 돌아오므로 60일 안에 반드시 있다. */
function firstWithStem(stem: string): BirthLite {
  for (let n = 0; n < 60; n++) {
    const b = shift(n);
    if (buildPillars(b).day.stem === stem) return b;
  }
  throw new Error(`일간 ${stem} 를 60일 안에서 못 찾았다`);
}

// 1990-5-15 은 경진(庚辰)이다 — 브레인스토밍에서 실측했다.
// 일간 경은 금(金)·양(陽)이고, 일지 진(辰)의 육합은 유(酉), 충은 술(戌)이다
// (src/lib/saju-core/data/branches.ts 의 BRANCH_HAP·BRANCH_CHUNG).
const CENTER = dayPillarOf(solar(BASE.year, BASE.month, BASE.day))!;

describe("dayPillarOf", () => {
  it("양력 생년월일에서 일주를 세운다", () => {
    expect(CENTER).toEqual({ stem: "경", branch: "진" });
  });

  it("음력을 양력으로 옮겨 세운다", () => {
    // 만세력 실측: 음력 1990-2-30 은 양력 1990-3-26 이고 일주는 경인이다
    const lunar: BirthLite = { year: 1990, month: 2, day: 30, calendar: "lunar", isLeapMonth: false };
    expect(dayPillarOf(lunar)).toEqual({ stem: "경", branch: "인" });
  });

  it("없는 날짜면 null", () => {
    // 만세력이 "Invalid solar date" 로 던진다. 던지지 않고 null 로 접는 것이
    // 이 함수의 존재 이유다 — 한 명 때문에 지도 전체가 500 이 되면 안 된다.
    expect(dayPillarOf(solar(1990, 2, 31))).toBeNull();
  });

  it("만세력 지원 범위(1900~2050) 밖이면 null", () => {
    expect(dayPillarOf(solar(1899, 1, 1))).toBeNull();
  });

  it("없는 윤달이면 null", () => {
    const bad: BirthLite = { year: 1990, month: 2, day: 1, calendar: "lunar", isLeapMonth: true };
    expect(dayPillarOf(bad)).toBeNull();
  });
});

describe("toMapPerson", () => {
  it("60일을 돌면 다섯 Role 이 모두 나온다", () => {
    const roles = new Set<string>();
    for (let n = 0; n < 60; n++) {
      const person = toMapPerson(CENTER, row(String(n), shift(n)));
      if (person) roles.add(person.role);
    }
    expect(roles).toEqual(new Set(["fill", "beside", "express", "move", "refine"]));
  });

  // 위 테스트는 다섯 Role 이 "어딘가에" 다 나오는지만 본다 — RelationKind 는
  // 두 일간 오행의 생극만으로 갈리고 오행은 10일 주기로 도니 ROLE_OF 안의
  // 짝을 통째로 바꿔치기해도(예: 생아↔비아) 같은 다섯 값의 집합이 나와 그
  // 테스트를 통과한다. 아래는 중심 경진(일간 경, 金)을 기준으로 각 일간이
  // 어느 Role 로 가는지 하나씩 못박는다 — ROLE_OF 항목 하나가 바뀌면 이름
  // 붙은 테스트 하나가 정확히 진다.
  it("일간 무·기(土, 금을 생함)는 fill", () => {
    expect(toMapPerson(CENTER, row("mu", firstWithStem("무")))!.role).toBe("fill");
    expect(toMapPerson(CENTER, row("gi", firstWithStem("기")))!.role).toBe("fill");
  });

  it("일간 경·신(金, 중심과 같은 오행)은 beside", () => {
    expect(toMapPerson(CENTER, row("gyeong", firstWithStem("경")))!.role).toBe("beside");
    expect(toMapPerson(CENTER, row("sin", firstWithStem("신")))!.role).toBe("beside");
  });

  it("일간 임·계(水, 금이 생함)는 express", () => {
    expect(toMapPerson(CENTER, row("im", firstWithStem("임")))!.role).toBe("express");
    expect(toMapPerson(CENTER, row("gye", firstWithStem("계")))!.role).toBe("express");
  });

  it("일간 갑·을(木, 금이 극함)은 move", () => {
    expect(toMapPerson(CENTER, row("gap", firstWithStem("갑")))!.role).toBe("move");
    expect(toMapPerson(CENTER, row("eul", firstWithStem("을")))!.role).toBe("move");
  });

  it("일간 병·정(火, 금을 극함)은 refine", () => {
    expect(toMapPerson(CENTER, row("byeong", firstWithStem("병")))!.role).toBe("refine");
    expect(toMapPerson(CENTER, row("jeong", firstWithStem("정")))!.role).toBe("refine");
  });

  it("일지가 육합(유)이면 feature 가 yukhap", () => {
    const person = toMapPerson(CENTER, row("h", firstWithBranch("유")))!;
    expect(person.feature).toBe("yukhap");
  });

  it("일지가 충(술)이면 feature 가 chung", () => {
    const person = toMapPerson(CENTER, row("c", firstWithBranch("술")))!;
    expect(person.feature).toBe("chung");
  });

  it("그 밖의 일지는 feature 가 none", () => {
    const person = toMapPerson(CENTER, row("n", firstWithBranch("자")))!;
    expect(person.feature).toBe("none");
  });

  it("일주가 통째로 같으면 feature 는 none 이고 sameDayPillar 가 true", () => {
    // 동일일주는 saju-core 의 네 번째 배지라 Feature 셋 중 갈 자리가 없다.
    // 배치는 기본으로 접고 사실만 따로 싣는다.
    const person = toMapPerson(CENTER, row("s", solar(BASE.year, BASE.month, BASE.day)))!;
    expect(person.feature).toBe("none");
    expect(person.sameDayPillar).toBe(true);
  });

  it("육합·충인 사람의 sameDayPillar 는 false", () => {
    expect(toMapPerson(CENTER, row("h", firstWithBranch("유")))!.sameDayPillar).toBe(false);
  });

  it("일주 캐릭터의 간지와 장면명을 싣는다", () => {
    const person = toMapPerson(CENTER, row("x", solar(BASE.year, BASE.month, BASE.day)))!;
    expect(person.pillarKey).toBe("경진");
    expect(person.sceneName.length).toBeGreaterThan(0);
  });

  it("id 와 name 을 그대로 옮긴다", () => {
    const person = toMapPerson(CENTER, { id: "42", name: "민수", ...shift(1) })!;
    expect(person.id).toBe("42");
    expect(person.name).toBe("민수");
  });

  it("없는 날짜면 null", () => {
    expect(toMapPerson(CENTER, row("bad", solar(1990, 2, 31)))).toBeNull();
  });
});

describe("centerOf", () => {
  it("이름과 일주 캐릭터를 담는다", () => {
    const center = centerOf("김동진", solar(BASE.year, BASE.month, BASE.day));
    expect(center).toEqual({
      name: "김동진",
      pillarKey: "경진",
      sceneName: expect.any(String),
    });
  });

  it("없는 날짜면 null", () => {
    expect(centerOf("김동진", solar(1990, 2, 31))).toBeNull();
  });
});
