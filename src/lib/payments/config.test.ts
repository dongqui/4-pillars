import { describe, it, expect } from "vitest";
import {
  availableMethods,
  enabledMethods,
  getChannel,
  getChannelKey,
  getStoreId,
} from "./config";

const full = {
  PORTONE_STORE_ID: "store-1",
  PORTONE_API_SECRET: "secret-1",
  PORTONE_CHANNEL_KEY_INICIS: "ch-inicis",
  PORTONE_METHODS: "card,naver,kakao,toss",
} as unknown as NodeJS.ProcessEnv;

const none = {} as unknown as NodeJS.ProcessEnv;

describe("getChannel", () => {
  it("카드는 CARD 하나로, 간편결제는 EASY_PAY + provider 로 짝지어진다", () => {
    expect(getChannel("card", full)).toEqual({ channelKey: "ch-inicis", payMethod: "CARD" });
    expect(getChannel("naver", full)).toEqual({
      channelKey: "ch-inicis",
      payMethod: "EASY_PAY",
      easyPayProvider: "NAVERPAY",
    });
    expect(getChannel("kakao", full)).toEqual({
      channelKey: "ch-inicis",
      payMethod: "EASY_PAY",
      easyPayProvider: "KAKAOPAY",
    });
    expect(getChannel("toss", full)).toEqual({
      channelKey: "ch-inicis",
      payMethod: "EASY_PAY",
      easyPayProvider: "TOSSPAY",
    });
  });

  it("네 수단이 같은 채널키를 쓴다 — 이니시스 채널 하나가 전부를 연다", () => {
    const keys = ["card", "naver", "kakao", "toss"].map(
      (id) => getChannel(id as "card", full)?.channelKey,
    );
    expect(new Set(keys)).toEqual(new Set(["ch-inicis"]));
  });

  it("채널키가 없으면 null", () => {
    expect(getChannel("card", none)).toBeNull();
    expect(getChannel("card", { ...full, PORTONE_CHANNEL_KEY_INICIS: "" })).toBeNull();
  });

  it("공백만 있는 채널키는 없는 것으로 친다 — .env 의 빈 줄이 채널로 살아나면 안 된다", () => {
    expect(getChannel("card", { ...full, PORTONE_CHANNEL_KEY_INICIS: "   " })).toBeNull();
  });

  it("꺼진 수단은 채널키가 있어도 null — 화면에서만 숨기면 API 를 직접 두드릴 수 있다", () => {
    const onlyCard = { ...full, PORTONE_METHODS: "card" };
    expect(getChannel("card", onlyCard)).not.toBeNull();
    expect(getChannel("kakao", onlyCard)).toBeNull();
  });
});

describe("enabledMethods", () => {
  it("미설정·빈 문자열이면 아무것도 켜지 않는다 — 빠뜨린 env 로 결제창이 열리면 안 된다", () => {
    expect(enabledMethods(none)).toEqual([]);
    expect(enabledMethods({ ...full, PORTONE_METHODS: "" })).toEqual([]);
    expect(enabledMethods({ ...full, PORTONE_METHODS: "   " })).toEqual([]);
  });

  it("공백과 대소문자를 흡수한다", () => {
    expect(enabledMethods({ ...full, PORTONE_METHODS: " Card , KAKAO " })).toEqual([
      "card",
      "kakao",
    ]);
  });

  it("모르는 값은 버린다 — 오타가 다른 수단을 켜지 않는다", () => {
    expect(enabledMethods({ ...full, PORTONE_METHODS: "card,kakaopay" })).toEqual(["card"]);
    expect(enabledMethods({ ...full, PORTONE_METHODS: "paypal" })).toEqual([]);
  });

  it("중복을 접고 화면 순서를 지킨다 — env 작성 순서에 흔들리지 않는다", () => {
    expect(enabledMethods({ ...full, PORTONE_METHODS: "kakao,card,kakao" })).toEqual([
      "card",
      "kakao",
    ]);
    expect(enabledMethods({ ...full, PORTONE_METHODS: "toss,naver" })).toEqual(["naver", "toss"]);
  });
});

describe("availableMethods", () => {
  it("켜진 수단만 화면 순서대로 돌려준다", () => {
    expect(availableMethods(full)).toEqual(["card", "naver", "kakao", "toss"]);
    expect(availableMethods({ ...full, PORTONE_METHODS: "card,toss" })).toEqual(["card", "toss"]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(availableMethods(none)).toEqual([]);
  });

  it("storeId 가 없으면 빈 배열 — 상점 없이는 결제창이 열리지 않는다", () => {
    expect(availableMethods({ ...full, PORTONE_STORE_ID: "" })).toEqual([]);
  });

  it("API 시크릿이 없으면 빈 배열 — 확정 못 할 결제를 열 수는 없다", () => {
    expect(availableMethods({ ...full, PORTONE_API_SECRET: "" })).toEqual([]);
  });

  it("채널키가 없으면 빈 배열 — 켠 수단이 있어도 열 채널이 없다", () => {
    expect(availableMethods({ ...full, PORTONE_CHANNEL_KEY_INICIS: "" })).toEqual([]);
  });
});

describe("getChannelKey / getStoreId", () => {
  it("없으면 null (빈 문자열이 아니다)", () => {
    expect(getChannelKey(none)).toBeNull();
    expect(getChannelKey(full)).toBe("ch-inicis");
    expect(getStoreId(none)).toBeNull();
    expect(getStoreId(full)).toBe("store-1");
  });
});
