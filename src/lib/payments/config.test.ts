import { describe, it, expect } from "vitest";
import { availableMethods, getChannel, getStoreId } from "./config";

const full = {
  PORTONE_STORE_ID: "store-1",
  PORTONE_CHANNEL_KEY_CARD: "ch-card",
  PORTONE_CHANNEL_KEY_NAVERPAY: "ch-naver",
  PORTONE_CHANNEL_KEY_KAKAOPAY: "ch-kakao",
} as unknown as NodeJS.ProcessEnv;

describe("getChannel", () => {
  it("카드는 CARD, 간편결제는 EASY_PAY 로 짝지어진다", () => {
    expect(getChannel("card", full)).toEqual({ channelKey: "ch-card", payMethod: "CARD" });
    expect(getChannel("naver", full)).toEqual({ channelKey: "ch-naver", payMethod: "EASY_PAY" });
    expect(getChannel("kakao", full)).toEqual({ channelKey: "ch-kakao", payMethod: "EASY_PAY" });
  });

  it("키가 없으면 null", () => {
    expect(getChannel("card", {} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("공백만 있는 키는 없는 것으로 친다 — .env 의 빈 줄이 채널로 살아나면 안 된다", () => {
    expect(getChannel("card", { ...full, PORTONE_CHANNEL_KEY_CARD: "   " })).toBeNull();
  });
});

describe("availableMethods", () => {
  it("설정된 수단만 화면 순서대로 돌려준다", () => {
    expect(availableMethods(full)).toEqual(["card", "naver", "kakao"]);
    expect(availableMethods({ ...full, PORTONE_CHANNEL_KEY_NAVERPAY: "" })).toEqual([
      "card",
      "kakao",
    ]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(availableMethods({} as unknown as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("storeId 가 없으면 채널이 다 있어도 빈 배열 — 상점 없이는 결제창이 열리지 않는다", () => {
    expect(availableMethods({ ...full, PORTONE_STORE_ID: "" })).toEqual([]);
  });
});

describe("getStoreId", () => {
  it("없으면 null (빈 문자열이 아니다)", () => {
    expect(getStoreId({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(getStoreId(full)).toBe("store-1");
  });
});
