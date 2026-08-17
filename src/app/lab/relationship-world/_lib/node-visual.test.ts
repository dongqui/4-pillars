import { describe, expect, it } from "vitest";
import {
  CORE_RADIUS,
  DIFFUSE_HALO_RADIUS,
  HALO_ALPHA,
  HALO_TEXTURE_SIZE,
  NEAR_HALO_RADIUS,
  radialFalloff,
} from "./node-visual";

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
      [5, 5],
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

describe("시각 상수", () => {
  it("코어 < 근접 halo < 확산 halo 순으로 커진다", () => {
    expect(CORE_RADIUS).toBeLessThan(NEAR_HALO_RADIUS);
    expect(NEAR_HALO_RADIUS).toBeLessThan(DIFFUSE_HALO_RADIUS);
  });

  it("확산 halo 는 사람 간 최소 간격(0.4354)보다 커서 이웃과 겹친다", () => {
    // 겹치지 않으면 '사람들이 Field 를 만든다'가 성립하지 않는다.
    expect(DIFFUSE_HALO_RADIUS).toBeGreaterThan(0.4354);
  });

  it("확산 halo 는 근접 halo 보다 훨씬 옅다", () => {
    expect(HALO_ALPHA.diffuse.base).toBeLessThan(HALO_ALPHA.near.base / 4);
  });

  it("두 halo 모두 선택 > 기본 > dim 순으로 진하다", () => {
    for (const layer of [HALO_ALPHA.near, HALO_ALPHA.diffuse]) {
      expect(layer.selected).toBeGreaterThan(layer.base);
      expect(layer.base).toBeGreaterThan(layer.dimmed);
    }
  });

  it("가장 붐비는 fill 그룹 6명이 다 겹쳐도 확산 halo 가 화면을 덮지 않는다", () => {
    // additive 라 합이 그대로 쌓인다. 0.5 를 넘으면 직전 스파이크의 '흰 덩어리'가
    // 색깔만 바뀐 채 돌아온다.
    expect(HALO_ALPHA.diffuse.base * 6).toBeLessThan(0.5);
  });
});
