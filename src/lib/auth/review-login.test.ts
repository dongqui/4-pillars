import { describe, it, expect, afterEach, vi } from "vitest";
import { reviewLoginConfig, verifyReviewLogin } from "./review-login";

const CONFIG = { id: "pgreview", password: "dummy-Pass#1", email: "guest@example.com" };

describe("reviewLoginConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("셋이 다 있으면 설정을 돌려준다", () => {
    vi.stubEnv("REVIEW_LOGIN_ID", "pgreview");
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
    vi.stubEnv("REVIEW_LOGIN_EMAIL", "guest@example.com");
    expect(reviewLoginConfig()).toEqual(CONFIG);
  });

  // 심사가 끝나면 env 를 지워 닫는다 — 하나만 지워도 닫혀야 실수로 반쯤 열린 상태가 없다.
  it.each(["REVIEW_LOGIN_ID", "REVIEW_LOGIN_PASSWORD", "REVIEW_LOGIN_EMAIL"])(
    "%s 가 비면 null — 기능이 꺼진다",
    (missing) => {
      vi.stubEnv("REVIEW_LOGIN_ID", "pgreview");
      vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
      vi.stubEnv("REVIEW_LOGIN_EMAIL", "guest@example.com");
      vi.stubEnv(missing, "");
      expect(reviewLoginConfig()).toBeNull();
    },
  );

  it("아이디·이메일의 앞뒤 공백은 걷어낸다 — 호스팅 콘솔에 붙여 넣다 딸려 온 공백", () => {
    vi.stubEnv("REVIEW_LOGIN_ID", " pgreview ");
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
    vi.stubEnv("REVIEW_LOGIN_EMAIL", " guest@example.com ");
    expect(reviewLoginConfig()).toEqual(CONFIG);
  });
});

describe("verifyReviewLogin", () => {
  it("아이디·비밀번호가 둘 다 맞으면 true", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#1")).toBe(true);
  });

  it("담당자가 아이디 뒤에 공백을 붙여 넣어도 통과한다", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview ", "dummy-Pass#1")).toBe(true);
  });

  it("비밀번호는 공백까지 그대로 비교한다", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#1 ")).toBe(false);
  });

  it("비밀번호가 틀리면 false", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#2")).toBe(false);
  });

  it("아이디가 틀리면 false", () => {
    expect(verifyReviewLogin(CONFIG, "admin", "dummy-Pass#1")).toBe(false);
  });

  it("길이가 다른 입력에도 throw 하지 않는다 — timingSafeEqual 은 길이가 다르면 던진다", () => {
    expect(verifyReviewLogin(CONFIG, "p", "")).toBe(false);
  });

  // 카드사에는 이메일을 계정으로 알려 준다. 아이디와 이메일 어느 쪽으로 들어와도 같은 계정이다.
  it("아이디 자리에 이메일을 넣어도 통과한다", () => {
    expect(verifyReviewLogin(CONFIG, "guest@example.com", "dummy-Pass#1")).toBe(true);
  });

  it("이메일은 대소문자를 가리지 않는다 — 모바일 키보드가 첫 글자를 올린다", () => {
    expect(verifyReviewLogin(CONFIG, " Guest@Example.COM ", "dummy-Pass#1")).toBe(true);
  });

  it("아이디는 대소문자를 가린다 — 느슨하게 받는 것은 이메일뿐이다", () => {
    expect(verifyReviewLogin(CONFIG, "PGREVIEW", "dummy-Pass#1")).toBe(false);
  });

  it("이메일이 맞아도 비밀번호가 틀리면 false", () => {
    expect(verifyReviewLogin(CONFIG, "guest@example.com", "dummy-Pass#2")).toBe(false);
  });

  it("남의 이메일은 false", () => {
    expect(verifyReviewLogin(CONFIG, "someone@example.com", "dummy-Pass#1")).toBe(false);
  });
});
