import { describe, expect, it } from "vitest";
import {
  DISPLAY_TITLES,
  FEATURE_NOTE,
  ROLE_LABELS,
  ROLE_ORDER,
  type Feature,
} from "./roles";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

describe("DISPLAY_TITLES", () => {
  it("15칸이 전부 채워져 있다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        expect(DISPLAY_TITLES[role][feature], `${role}/${feature}`).toBeTruthy();
      }
    }
  });

  it("15개가 서로 다르다 — 겹치면 어느 칸인지 알 수 없다", () => {
    const all = ROLE_ORDER.flatMap((r) => FEATURES.map((f) => DISPLAY_TITLES[r][f]));
    expect(new Set(all).size).toBe(15);
  });

  it("전부 짧은 명사다 — 캡처해서 공유할 이름이다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        const title = DISPLAY_TITLES[role][feature];
        expect(title.length, `${role}/${feature} "${title}"`).toBeLessThanOrEqual(6);
        expect(title, `${role}/${feature}`).not.toMatch(/\s/);
      }
    }
  });
});

describe("六合 과 沖 의 무게", () => {
  // 한쪽 설명만 길거나 따뜻하면 그 순간 좋은 관계 / 나쁜 관계가 된다.
  it("표시명 길이 총합이 六合 과 沖 사이에 기울지 않는다", () => {
    // 역할마다 정확히 같기를 요구할 수는 없다 — 찰떡(2)/불쏘시개(4) 처럼
    // 자연스러운 이름의 길이는 제각각이다. 한쪽 계열이 **전체적으로** 더 길거나
    // 짧아지는 것만 막는다. 현재 값: 六合 12자, 沖 14자, 차 2.
    const sum = (f: "yukhap" | "chung") =>
      ROLE_ORDER.reduce((n, r) => n + DISPLAY_TITLES[r][f].length, 0);
    expect(Math.abs(sum("yukhap") - sum("chung"))).toBeLessThanOrEqual(3);
  });

  it("설명 문구 길이 차가 3자 이내다", () => {
    expect(Math.abs(FEATURE_NOTE.yukhap.length - FEATURE_NOTE.chung.length)).toBeLessThanOrEqual(3);
  });

  it("기본 상태에는 설명 문구가 없다 — 배지도 문구도 붙지 않는다", () => {
    expect(FEATURE_NOTE.none).toBe("");
  });
});

describe("ROLE_LABELS", () => {
  it("5개 역할 전부에 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_LABELS[role]).toBeTruthy();
  });
});
