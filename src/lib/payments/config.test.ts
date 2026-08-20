import { describe, it, expect } from "vitest";
import {
  availableMethods,
  enabledMethods,
  getClientKey,
  getMethod,
  getSecretKey,
  PAYMENT_METHOD_IDS,
} from "./config";

const full = {
  TOSS_CLIENT_KEY: "test_ck_1",
  TOSS_SECRET_KEY: "test_sk_1",
  TOSS_METHODS: "card,naver,kakao,toss",
} as unknown as NodeJS.ProcessEnv;

const none = {} as unknown as NodeJS.ProcessEnv;

describe("getMethod", () => {
  it("카드는 통합결제창(DEFAULT), 간편결제는 자체창(DIRECT) + 결제사 코드로 짝지어진다", () => {
    expect(getMethod("card", full)).toEqual({ flowMode: "DEFAULT" });
    expect(getMethod("naver", full)).toEqual({ flowMode: "DIRECT", easyPay: "NAVERPAY" });
    expect(getMethod("kakao", full)).toEqual({ flowMode: "DIRECT", easyPay: "KAKAOPAY" });
    expect(getMethod("toss", full)).toEqual({ flowMode: "DIRECT", easyPay: "TOSSPAY" });
  });

  it("간편결제 셋만 DIRECT 다 — 카드에 easyPay 가 붙으면 고른 것과 다른 창이 열린다", () => {
    const direct = PAYMENT_METHOD_IDS.filter((id) => getMethod(id, full)?.flowMode === "DIRECT");
    expect(direct).toEqual(["naver", "kakao", "toss"]);
  });

  it("클라이언트 키가 없으면 null", () => {
    expect(getMethod("card", none)).toBeNull();
    expect(getMethod("card", { ...full, TOSS_CLIENT_KEY: "" })).toBeNull();
  });

  it("공백만 있는 키는 없는 것으로 친다 — .env 의 빈 줄이 키로 살아나면 안 된다", () => {
    expect(getMethod("card", { ...full, TOSS_CLIENT_KEY: "   " })).toBeNull();
  });

  it("꺼진 수단은 키가 있어도 null — 화면에서만 숨기면 API 를 직접 두드릴 수 있다", () => {
    const onlyCard = { ...full, TOSS_METHODS: "card" };
    expect(getMethod("card", onlyCard)).not.toBeNull();
    expect(getMethod("kakao", onlyCard)).toBeNull();
  });
});

describe("enabledMethods", () => {
  it("미설정·빈 문자열이면 아무것도 켜지 않는다 — 빠뜨린 env 로 결제창이 열리면 안 된다", () => {
    expect(enabledMethods(none)).toEqual([]);
    expect(enabledMethods({ ...full, TOSS_METHODS: "" })).toEqual([]);
    expect(enabledMethods({ ...full, TOSS_METHODS: "   " })).toEqual([]);
  });

  it("공백과 대소문자를 흡수한다", () => {
    expect(enabledMethods({ ...full, TOSS_METHODS: " Card , KAKAO " })).toEqual(["card", "kakao"]);
  });

  it("모르는 값은 버린다 — 오타가 다른 수단을 켜지 않는다", () => {
    expect(enabledMethods({ ...full, TOSS_METHODS: "card,kakaopay" })).toEqual(["card"]);
    expect(enabledMethods({ ...full, TOSS_METHODS: "paypal" })).toEqual([]);
  });

  it("중복을 접고 화면 순서를 지킨다 — env 작성 순서에 흔들리지 않는다", () => {
    expect(enabledMethods({ ...full, TOSS_METHODS: "kakao,card,kakao" })).toEqual([
      "card",
      "kakao",
    ]);
    expect(enabledMethods({ ...full, TOSS_METHODS: "toss,naver" })).toEqual(["naver", "toss"]);
  });
});

describe("availableMethods", () => {
  it("켜진 수단만 화면 순서대로 돌려준다", () => {
    expect(availableMethods(full)).toEqual(["card", "naver", "kakao", "toss"]);
    expect(availableMethods({ ...full, TOSS_METHODS: "card,toss" })).toEqual(["card", "toss"]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(availableMethods(none)).toEqual([]);
  });

  it("클라이언트 키가 없으면 빈 배열 — 열 결제창이 없다", () => {
    expect(availableMethods({ ...full, TOSS_CLIENT_KEY: "" })).toEqual([]);
  });

  it("시크릿 키가 없으면 빈 배열 — 승인 못 할 결제를 열 수는 없다", () => {
    expect(availableMethods({ ...full, TOSS_SECRET_KEY: "" })).toEqual([]);
  });
});

describe("getClientKey / getSecretKey", () => {
  it("없으면 null (빈 문자열이 아니다)", () => {
    expect(getClientKey(none)).toBeNull();
    expect(getClientKey(full)).toBe("test_ck_1");
    expect(getSecretKey(none)).toBeNull();
    expect(getSecretKey(full)).toBe("test_sk_1");
  });
});
