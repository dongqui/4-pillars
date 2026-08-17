import { describe, expect, it } from "vitest";

import {
  ALL_CHARACTERS,
  characterById,
  characterFromChart,
  characterOf,
} from "./character";
import { buildChart } from "./chart";
import { CHARACTER_KEYS } from "./data/characters-60";

describe("characterOf", () => {
  it("갑자 → 0번 깊은 물가의 큰나무", () => {
    const c = characterOf("갑", "자");
    expect(c.id).toBe(0);
    expect(c.key).toBe("갑자");
    expect(c.hanja).toBe("甲子");
    expect(c.family.name).toBe("큰나무형");
    expect(c.family.element).toBe("목");
    expect(c.family.yinYang).toBe("양");
    expect(c.scene.name).toBe("깊은 물가의 큰나무");
    expect(c.scene.principle).toBe("깊은 물·한밤");
  });

  it("계해 → 59번, 60갑자의 끝", () => {
    const c = characterOf("계", "해");
    expect(c.id).toBe(59);
    expect(c.key).toBe("계해");
    expect(c.hanja).toBe("癸亥");
  });

  it("카드 카피를 그대로 실어 준다", () => {
    const c = characterOf("경", "신");
    expect(c.scene.name).toBe("단단히 벼린 무쇠");
    expect(c.copy.hook).toMatch(/사람$/);
    expect(c.copy.chips).toHaveLength(3);
    expect(c.copy.desc).not.toBe("");
    expect(c.copy.shadow).not.toBe("");
  });

  it("내부 근거는 internal에 따로 담는다 (카드 비노출)", () => {
    const c = characterOf("갑", "자");
    expect(c.internal.tenGodGroup).toBe("인성");
    expect(c.internal.seatMeaning).toBe("지원받는 자리");
    expect(c.internal.keywords).toBe("안정·수용");
    expect(c.internal.basis).toBe("갑목 일간이 자(인성, 깊은 물·한밤) 위에 앉은 구조");
  });

  it("성립하지 않는 간지 조합은 거부한다", () => {
    // 갑(양) + 축(음) — 음양이 어긋나 60갑자에 없는 조합
    expect(() => characterOf("갑", "축")).toThrow(/60갑자/);
  });
});

describe("characterById", () => {
  it("id와 60갑자 순번이 일치한다", () => {
    for (const [index, key] of CHARACTER_KEYS.entries()) {
      const c = characterById(index);
      expect(c.id).toBe(index);
      expect(c.key).toBe(key);
    }
  });

  it("범위 밖 id는 거부한다", () => {
    expect(() => characterById(-1)).toThrow();
    expect(() => characterById(60)).toThrow();
    expect(() => characterById(1.5)).toThrow();
  });
});

describe("ALL_CHARACTERS", () => {
  it("60종을 순번대로 담는다", () => {
    expect(ALL_CHARACTERS).toHaveLength(60);
    expect(ALL_CHARACTERS.map((c) => c.key)).toEqual([...CHARACTER_KEYS]);
  });
});

describe("characterFromChart", () => {
  it("일주로 매핑한다 — 1990-05-15 14:30 서울(일주 경진)", () => {
    const chart = buildChart({
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      gender: "male",
    });
    const c = characterFromChart(chart);
    expect(chart.day.korean).toBe("경진");
    expect(c.key).toBe("경진");
    expect(c.family.name).toBe("무쇠형");
  });

  it("연주·월주·시주가 아니라 일주를 쓴다", () => {
    const chart = buildChart({
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      gender: "male",
    });
    const c = characterFromChart(chart);
    expect(c.key).not.toBe(chart.year.korean);
    expect(c.key).not.toBe(chart.month.korean);
    expect(c.key).not.toBe(chart.hour?.korean);
  });

  it("라이트 퍼널: 시간 미입력이어도 캐릭터가 나온다", () => {
    const chart = buildChart({
      year: 1990,
      month: 5,
      day: 15,
      gender: "female",
    });
    expect(chart.hour).toBeNull();
    expect(characterFromChart(chart).key).toBe("경진");
  });

  it("음력 입력도 같은 경로로 매핑된다", () => {
    const lunar = buildChart({
      year: 1990,
      month: 4,
      day: 21,
      calendar: "lunar",
      gender: "male",
    });
    const solar = buildChart({
      year: 1990,
      month: 5,
      day: 15,
      gender: "male",
    });
    expect(characterFromChart(lunar).key).toBe(characterFromChart(solar).key);
  });

  it("윤달과 평달은 다른 캐릭터로 갈린다 (2020 음력 4월 1일)", () => {
    const plain = buildChart({
      year: 2020,
      month: 4,
      day: 1,
      calendar: "lunar",
      gender: "male",
    });
    const leap = buildChart({
      year: 2020,
      month: 4,
      day: 1,
      calendar: "lunar",
      isLeapMonth: true,
      gender: "male",
    });
    expect(characterFromChart(leap).key).not.toBe(characterFromChart(plain).key);
  });

  it("연속 60일이면 60갑자가 한 바퀴 돈다", () => {
    const start = new Date(Date.UTC(1990, 4, 15));
    const keys = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(start.getTime() + i * 86_400_000);
      return characterFromChart(
        buildChart({
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1,
          day: d.getUTCDate(),
          gender: "male",
        }),
      ).key;
    });

    expect(new Set(keys).size).toBe(60);
    const offset = CHARACTER_KEYS.indexOf(keys[0]);
    expect(keys).toEqual(
      Array.from({ length: 60 }, (_, i) => CHARACTER_KEYS[(offset + i) % 60]),
    );
  });
});

describe("알려진 일주 대조", () => {
  // 만세력 결과를 기준일(1990-05-15=경진)로부터의 일수 산출과 교차 검증한 값.
  // 윤년·세기 경계에서 날짜 계산이 어긋나면 여기서 잡힌다.
  const KNOWN = [
    [1900, 1, 1, "갑술"],
    [1936, 2, 29, "신사"],
    [1960, 6, 15, "갑술"],
    [1987, 12, 31, "갑인"],
    [1990, 5, 15, "경진"],
    [1990, 10, 25, "계해"],
    [2000, 2, 29, "정사"],
    [2000, 3, 1, "무오"],
    [2024, 1, 1, "갑자"],
    [2050, 12, 31, "을유"],
  ] as const;

  it.each(KNOWN)("%s-%s-%s → %s", (year, month, day, key) => {
    const chart = buildChart({ year, month, day, gender: "male" });
    expect(characterFromChart(chart).key).toBe(key);
  });

  it("만세력 지원 범위(1900~2050) 밖은 원국 단계에서 거부된다", () => {
    for (const year of [1899, 2051]) {
      expect(() =>
        buildChart({ year, month: 6, day: 1, gender: "male" }),
      ).toThrow(/out of supported range/);
    }
  });
});
