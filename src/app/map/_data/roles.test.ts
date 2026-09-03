import { describe, expect, it } from "vitest";
import {
  DISPLAY_TITLES,
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

  it("전부 3자 이내다 — 52px 고정 배지 폭이 그 이상을 못 그린다", () => {
    // 배지는 w-[52px] 고정이고, 15칸이 다 찬 지도에서 이웃 배지 중심 사이의
    // 화면 거리는 모바일 375px 에서 54.7px 뿐이다(radial.ts BADGE_PX 주석
    // 참고) — 그 안에 들어가야 다음 배지와 겹치지 않으므로 글자 수 자체를
    // 여기서 막는다.
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        const title = DISPLAY_TITLES[role][feature];
        expect(title.length, `${role}/${feature} "${title}"`).toBeLessThanOrEqual(3);
        expect(title, `${role}/${feature}`).not.toMatch(/\s/);
      }
    }
  });
});

describe("六合 과 沖 의 무게", () => {
  // 한쪽 설명만 길거나 따뜻하면 그 순간 좋은 관계 / 나쁜 관계가 된다.
  it("표시명 길이 총합이 六合 과 沖 사이에 기울지 않는다", () => {
    // 역할마다 정확히 같기를 요구할 수는 없다 — 찰떡(2)/부싯돌(3) 처럼
    // 자연스러운 이름의 길이는 제각각이다. 한쪽 계열이 **전체적으로** 더 길거나
    // 짧아지는 것만 막는다. 현재 값: 六合 12자, 沖 13자, 차 1.
    const sum = (f: "yukhap" | "chung") =>
      ROLE_ORDER.reduce((n, r) => n + DISPLAY_TITLES[r][f].length, 0);
    expect(Math.abs(sum("yukhap") - sum("chung"))).toBeLessThanOrEqual(3);
  });
});

describe("ROLE_LABELS", () => {
  it("5개 역할 전부에 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_LABELS[role]).toBeTruthy();
  });
});
