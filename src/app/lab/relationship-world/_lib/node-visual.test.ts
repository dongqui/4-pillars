import { describe, expect, it } from "vitest";
import {
  ALPHA_SCALE,
  CORE_RADIUS,
  DIFFUSE_HALO_RADIUS,
  HALO_TEXTURE_SIZE,
  STATE_VISUAL,
  SELF_NODE_SCALE,
  radialFalloff,
  stateLight,
} from "./node-visual";
import type { Feature } from "../_data/roles";
import { FRIENDS } from "../_data/mock-people";
import { SELF_POSITION, placePeople, type Vec3 } from "./layout";

const SIZE = HALO_TEXTURE_SIZE;
const alphaAt = (data: Uint8Array, x: number, y: number) => data[(y * SIZE + x) * 4 + 3];

describe("radialFalloff", () => {
  const data = radialFalloff(SIZE);

  it("RGBA 한 장 크기다", () => {
    expect(data).toHaveLength(SIZE * SIZE * 4);
  });

  it("RGB 는 전부 흰색이다 — 색은 spriteMaterial.color 가 입힌다", () => {
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(255);
      expect(data[i + 1]).toBe(255);
      expect(data[i + 2]).toBe(255);
    }
  });

  it("중심이 가장 불투명하고 모서리는 완전히 투명하다", () => {
    const c = Math.floor(SIZE / 2);
    expect(alphaAt(data, c, c)).toBeGreaterThan(250);
    expect(alphaAt(data, 0, 0)).toBe(0);
    expect(alphaAt(data, SIZE - 1, SIZE - 1)).toBe(0);
  });

  it("중심에서 바깥으로 알파가 단조 감소한다 — 링이 생기면 halo 가 아니라 도넛이다", () => {
    const c = Math.floor(SIZE / 2);
    for (let x = c; x < SIZE - 1; x++) {
      expect(alphaAt(data, x + 1, c), `x=${x}`).toBeLessThanOrEqual(alphaAt(data, x, c));
    }
  });

  it("네 방향이 대칭이다", () => {
    // 중심은 (SIZE-1)/2 = 31.5 라 인덱스 32 를 기준으로 잡으면 좌우 거리가
    // 16.5 대 15.5 로 어긋난다. 31.5 를 기준으로 정확히 마주보는 인덱스끼리
    // 비교한다 — 그래야 오차 허용치 없이 딱 같아야 한다.
    for (const [x, y] of [
      [10, 32],
      [20, 18],
      // falloff 범위(정규화 거리 <=1) 안쪽이어야 한다. [5,5]는 거리 1.19라
      // 알파가 항상 0 이라 미러/전치 단언이 0 === 0 으로만 통과했다.
      [12, 24],
    ]) {
      const base = alphaAt(data, x, y);
      expect(alphaAt(data, SIZE - 1 - x, y), `x 미러 (${x},${y})`).toBe(base);
      expect(alphaAt(data, x, SIZE - 1 - y), `y 미러 (${x},${y})`).toBe(base);
      expect(alphaAt(data, y, x), `전치 (${x},${y})`).toBe(base);
    }
  });

  it("가장자리가 딱 끊기지 않는다 — 스프라이트 사각형이 보이면 안 된다", () => {
    const c = Math.floor(SIZE / 2);
    // 반지름 90% 지점의 알파가 이미 아주 낮아야 한다.
    expect(alphaAt(data, c + Math.floor(SIZE * 0.45), c)).toBeLessThan(12);
  });
});

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

describe("시각 상수", () => {
  it("코어 < 근접 halo < 확산 halo 순으로 커진다", () => {
    for (const f of FEATURES) {
      expect(CORE_RADIUS, f).toBeLessThan(STATE_VISUAL[f].nearRadius);
      expect(STATE_VISUAL[f].nearRadius, f).toBeLessThan(DIFFUSE_HALO_RADIUS);
    }
  });

  it("나는 다른 사람보다 2배 이상 크다", () => {
    expect(SELF_NODE_SCALE).toBeGreaterThanOrEqual(2);
  });

  it("확산 halo 는 최근접 거리 중앙값을 넘어 이웃과 실제로 겹친다", () => {
    // 겹치지 않으면 "사람들이 Field 를 만든다"가 성립하지 않는다.
    //
    // 예전에는 두 리터럴(DIFFUSE_HALO_RADIUS*2 와 1.93)을 비교했다 — 양쪽 다
    // 상수라 layout.ts 의 SPREAD 가 넓어지거나 앵커가 멀어져 실제 겹침이
    // 깨져도 이 테스트는 통과했다(1.93 은 그 시점의 중앙값을 손으로 옮겨 적은
    // 값일 뿐 layout.ts 와 아무 연결이 없었다). 대신 placePeople(FRIENDS) 에서
    // 최근접 거리 중앙값을 직접 계산해 비교한다 — layout 이 바뀌면 이 값도
    // 같이 바뀌어 겹침이 실제로 깨지는 순간 실패한다.
    const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const placed: Vec3[] = [...placePeople(FRIENDS).values(), SELF_POSITION];
    const nearestNeighborDistances = placed.map((p, i) =>
      Math.min(...placed.filter((_, j) => j !== i).map((q) => dist3(p, q))),
    );
    const sorted = [...nearestNeighborDistances].sort((a, b) => a - b);
    const mid = sorted.length / 2;
    const median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[Math.floor(mid)];

    expect(DIFFUSE_HALO_RADIUS * 2, `최근접 거리 중앙값 = ${median}`).toBeGreaterThan(median);
  });
});

describe("광량 불변식", () => {
  // 설계 문서 4.3. 브리프 §3.2 가 "沖이 가장 강하고 六合이 가장 약한 등급처럼
  // 읽힐 수 있다"고 직접 경고한 것을, 부탁이 아니라 숫자로 막는다.
  it("세 상태의 적분 광량이 서로 2% 이내다", () => {
    // 실측 spread 는 0.00027%(none 0.222320 / yukhap 0.222319 / chung
    // 0.222320) 다. 설계 문서의 상한은 2% 지만, 그 값을 그대로 쓰면 이 테스트
    // 하나만으로는 회귀를 못 잡는다 — stateLight() 에서 breatheAmplitude 보정
    // (1 + d²/2) 을 통째로 빼도 spread 가 1.28% 로, 2% 밑을 통과해버린다.
    // 0.5% 로 조이면 실측치 대비 네 자릿수 여유를 남기면서도(정당한 상수
    // 재조정은 통과) 1.28% 짜리 회귀는 반드시 잡는다. "호흡의 시간 평균이
    // 광량에 반영된다" 테스트가 같은 회귀를 직접 검사하지만, 이 테스트도
    // 독립적으로 걸리도록 조인다.
    // Array.prototype.map 은 (요소, 인덱스, 배열) 을 콜백에 넘긴다. stateLight
    // 가 이제 두 번째 인자로 alphaScale 을 받으므로, stateLight 를 그대로
    // map 에 넘기면 인덱스(0/1/2)가 alphaScale 로 새어 들어간다. 화살표로
    // feature 하나만 넘긴다.
    const lights = FEATURES.map((f) => stateLight(f));
    const spread = (Math.max(...lights) - Math.min(...lights)) / Math.min(...lights);
    expect(spread, `T = ${lights.map((v) => v.toFixed(6)).join(" / ")}`).toBeLessThan(0.005);
  });

  it("호흡의 시간 평균이 광량에 반영된다", () => {
    // scale(t) = 1 + d·sin(ωt) → <scale²> = 1 + d²/2.
    // 이걸 빼먹으면 六合 이 평균적으로 더 밝아진다. 진폭이 있는 상태가
    // 정확히 그만큼 보정돼 있는지 직접 확인한다.
    const v = STATE_VISUAL.yukhap;
    expect(v.breatheAmplitude).toBeGreaterThan(0);
    const raw = v.nearAlpha * v.nearRadius ** 2 + v.diffuseAlpha * DIFFUSE_HALO_RADIUS ** 2;
    expect(stateLight("yukhap")).toBeCloseTo(raw * (1 + v.breatheAmplitude ** 2 / 2), 10);
  });

  it("확산 halo 반지름은 세 상태가 같다 — 상태마다 바꾸면 빛 번짐이 승인폭을 넘는다", () => {
    expect(DIFFUSE_HALO_RADIUS).toBe(1.6);
  });

  it("모든 알파가 0 초과 1 이하다", () => {
    for (const f of FEATURES) {
      const v = STATE_VISUAL[f];
      expect(v.nearAlpha, `${f} near`).toBeGreaterThan(0);
      expect(v.nearAlpha, `${f} near`).toBeLessThanOrEqual(1);
      expect(v.diffuseAlpha, `${f} diffuse`).toBeGreaterThan(0);
      expect(v.diffuseAlpha, `${f} diffuse`).toBeLessThanOrEqual(1);
    }
  });

  it("확산 halo 가 6겹 쌓여도 화면을 덮지 않는다", () => {
    // 이 상한을 넘으면 직전 스파이크의 '흰 덩어리'가 색만 바뀐 채 돌아온다.
    for (const f of FEATURES) {
      expect(STATE_VISUAL[f].diffuseAlpha * 6, f).toBeLessThan(0.5);
    }
  });

  it("六合 은 넓고 옅게, 沖 은 좁고 진하게 퍼진다", () => {
    // 광량이 같아도 성격은 달라야 한다. 방향이 뒤집히면 잡는다.
    expect(STATE_VISUAL.yukhap.nearRadius).toBeGreaterThan(STATE_VISUAL.none.nearRadius);
    expect(STATE_VISUAL.yukhap.nearAlpha).toBeLessThan(STATE_VISUAL.none.nearAlpha);
    expect(STATE_VISUAL.chung.nearRadius).toBeLessThan(STATE_VISUAL.none.nearRadius);
    expect(STATE_VISUAL.chung.nearAlpha).toBeGreaterThan(STATE_VISUAL.none.nearAlpha);
  });

  it("움직이는 상태는 六合 하나뿐이다", () => {
    // 沖 에는 미세한 떨림(6Hz)이 있었지만 화면에서 고장으로 읽혀 걷어냈다.
    // 지금 움직임은 六合 의 느린 호흡 하나이고, stateLight 의 시간 평균 보정을
    // 받는 것도 그 하나뿐이다. 두 번째 움직임이 붙으면 보정도 함께 들어와야
    // 하므로, 그 순간 이 테스트가 먼저 걸린다.
    expect(STATE_VISUAL.yukhap.breatheAmplitude).toBeGreaterThan(0);
    expect(STATE_VISUAL.none.breatheAmplitude).toBe(0);
    expect(STATE_VISUAL.chung.breatheAmplitude).toBe(0);
  });
});

describe("ALPHA_SCALE", () => {
  // selected(1.5)가 沖 의 nearAlpha(0.758)를 1.137 로 밀어 Math.min(1, ...)에
  // 클램프됐던 회귀. 클램프된 상태만 실효 배율이 깎여 광량 불변식이
  // 0.5% 문턱을 3배 넘게(1.67%) 벌어졌었다 — stateLight() 는 정지 상태만
  // 검사해서 이 회귀를 못 잡았다. 이 두 테스트가 배율이 걸린 뒤까지 지킨다.
  const scales = Object.values(ALPHA_SCALE);

  it("어떤 배율도 어떤 상태의 알파를 포화시키지 않는다", () => {
    for (const scale of scales) {
      for (const f of FEATURES) {
        const v = STATE_VISUAL[f];
        expect(v.nearAlpha * scale, `${f} near ×${scale}`).toBeLessThanOrEqual(1);
        expect(v.diffuseAlpha * scale, `${f} diffuse ×${scale}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("배율이 걸린 뒤에도 세 상태의 광량이 0.5% 이내로 일치한다", () => {
    for (const scale of scales) {
      const lights = FEATURES.map((f) => stateLight(f, scale));
      const spread = (Math.max(...lights) - Math.min(...lights)) / Math.min(...lights);
      expect(
        spread,
        `scale=${scale}, T = ${lights.map((v) => v.toFixed(6)).join(" / ")}`,
      ).toBeLessThan(0.005);
    }
  });
});
